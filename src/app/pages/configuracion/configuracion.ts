import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PDFDocument, rgb, StandardFonts} from 'pdf-lib';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import moment from 'moment';
import {DatePipe, registerLocaleData} from '@angular/common';
import localeEs from '@angular/common/locales/es';

// Registrar el locale español
registerLocaleData(localeEs);
moment.locale('es');

export interface ReportConfig {
  startDate: string;
  endDate: string;
  unavailableDates: string[];
  vacationDates: string[];
  reportType: string;
  department: string;
  includeStatistics: boolean;

  // Nuevos campos
  reporteNo: string;
  nombrePrestador: string;
  unidadAcademica: string;
  carrera: string;
  boleta: string;
  noReporteMensual: string;
  periodoDel: string;
  periodoAl: string;
  asistencia: AsistenciaDia[];
  totalHorasMes: string;
  totalHorasAcumuladas: string;

  // Fechas del servicio social (carta compromiso)
  fechaInicioServicio: string;
  fechaFinServicio: string;
  reporteActual: number;
}

export interface FechaEspecial {
  fecha: string;
  tipoFecha: string;
}

@Component({
  selector: 'app-configuracion',
  imports: [
    FormsModule,
    DatePipe
  ],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss'
})
export class Configuracion {
  config: ReportConfig = config;

  formFields: string[] = [];
  reportePeriodos: { numero: number, del: string, al: string }[] = [];
  fechasLaborables: string[] = [];
  fechasEspeciales: FechaEspecial[] = [];
  csvFile: File | null = null;

  constructor(private sanitizer: DomSanitizer) {
  }

  formatearFechaEspanol(fecha: string): string {
    return moment(fecha).format('DD [de] MMMM [de] YYYY');
  }

  contarDiasEspeciales(): number {
    if (!this.config.asistencia) return 0;
    return this.config.asistencia.filter(dia => dia.horasPorDia === '0').length;
  }

  calcularHorasPorDia(horaEntrada: string, horaSalida: string): string {
    if (!horaEntrada || !horaSalida) return '0';

    const entrada = moment(horaEntrada, 'HH:mm');
    const salida = moment(horaSalida, 'HH:mm');

    if (!entrada.isValid() || !salida.isValid()) return '0';

    const diferencia = salida.diff(entrada, 'hours', true);
    return Math.max(0, diferencia).toString();
  }

  async generateReport() {
    const url = 'assets/control-asistencia.pdf';
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Información del Prestador y el Reporte
    form.getTextField('Correspondiente al reporte mensual de actividades No').setText(this.config.noReporteMensual);
    form.getTextField('Periodo del').setText(this.formatearFechaEspanol(this.config.periodoDel));
    form.getTextField('al').setText(this.formatearFechaEspanol(this.config.periodoAl));
    form.getTextField('Nombre del Prestador').setText(this.config.nombrePrestador);
    form.getTextField('Unidad Académica').setText(this.config.unidadAcademica);
    form.getTextField('Carrera').setText(this.config.carrera);
    form.getTextField('Boleta').setText(this.config.boleta);

    // Campos de la Tabla de Asistencia
    this.config.asistencia.forEach((dia, i) => {
      form.getTextField(`Fecha${i + 1}`).setText(this.formatearFechaEspanol(dia.fecha));
      form.getTextField(`Hora de Entrada${i + 1}`).setText(dia.horaEntrada);
      form.getTextField(`Hora de Salida${i + 1}`).setText(dia.horaSalida);
      form.getTextField(`Horas por día${i + 1}`).setText(dia.horasPorDia);
    });

    // Totales
    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS POR MES').setText(this.config.totalHorasMes);
    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS ACUMULADAS').setText(this.config.totalHorasAcumuladas);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], {type: 'application/pdf'});
    const urlBlob = URL.createObjectURL(blob);

    const iframe = document.querySelector('iframe');
    if (iframe) iframe.src = urlBlob;
  }

  async listFormFields() {
    try {
      const url = 'assets/control-asistencia.pdf';
      const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();

      const fields = form.getFields();
      this.formFields = fields.map(field => field.getName());

      console.log('Campos del formulario PDF:', this.formFields);
    } catch (error) {
      console.error('Error al leer los campos del PDF:', error);
    }
  }

  calcularPeriodosReporte() {
    if (!this.config.fechaInicioServicio || !this.config.fechaFinServicio) {
      return;
    }

    const fechaInicio = moment(this.config.fechaInicioServicio);
    const fechaFin = moment(this.config.fechaFinServicio);
    const diaInicio = fechaInicio.date();

    this.reportePeriodos = [];
    let numeroReporte = 1;
    let fechaActual = fechaInicio.clone();

    if (diaInicio <= 10) {
      // Si inició en los primeros días del mes (1-10)
      while (fechaActual.isBefore(fechaFin) || fechaActual.isSame(fechaFin)) {
        let periodoInicio: moment.Moment;
        let periodoFin: moment.Moment;

        if (numeroReporte === 1) {
          // Primer reporte: fecha inicio hasta último día del mes
          periodoInicio = fechaInicio.clone();
          periodoFin = fechaInicio.clone().endOf('month');
        } else {
          // Reportes siguientes: del 1° al último día del mes
          periodoInicio = fechaActual.clone().startOf('month');
          periodoFin = fechaActual.clone().endOf('month');
        }

        // Si es el último reporte, ajustar fecha final
        if (periodoFin.isAfter(fechaFin)) {
          periodoFin = fechaFin.clone();
        }

        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD')
        });

        numeroReporte++;
        fechaActual = fechaActual.add(1, 'month').startOf('month');
      }
    } else {
      // Si inició a mediados del mes (después del día 10)
      while (fechaActual.isBefore(fechaFin) || fechaActual.isSame(fechaFin)) {
        let periodoInicio: moment.Moment;
        let periodoFin: moment.Moment;

        if (numeroReporte === 1) {
          // Primer reporte: fecha inicio hasta día 15 del siguiente mes
          periodoInicio = fechaInicio.clone();
          periodoFin = fechaInicio.clone().add(1, 'month').date(15);
        } else {
          // Reportes siguientes: del 16 del mes actual al 15 del siguiente
          periodoInicio = fechaActual.clone().date(16);
          periodoFin = fechaActual.clone().add(1, 'month').date(15);
        }

        // Si es el último reporte, ajustar fecha final
        if (periodoFin.isAfter(fechaFin)) {
          periodoFin = fechaFin.clone();
        }

        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD')
        });

        numeroReporte++;

        if (numeroReporte === 2) {
          fechaActual = fechaInicio.clone().add(1, 'month');
        } else {
          fechaActual = fechaActual.add(1, 'month');
        }
      }
    }
  }

  generarFechasLaborables(fechaInicio: string, fechaFin: string): string[] {
    const inicio = moment(fechaInicio);
    const fin = moment(fechaFin);
    const fechasLaborables: string[] = [];

    const fechaActual = inicio.clone();
    while (fechaActual.isSameOrBefore(fin)) {
      // 0 = Domingo, 6 = Sábado - excluir fines de semana
      if (fechaActual.day() !== 0 && fechaActual.day() !== 6) {
        fechasLaborables.push(fechaActual.format('YYYY-MM-DD'));
      }
      fechaActual.add(1, 'day');
    }

    return fechasLaborables;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.csvFile = file;
      this.procesarArchivoCSV(file);
    } else {
      alert('Por favor selecciona un archivo CSV válido');
    }
  }

  procesarArchivoCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      this.parsearCSV(csv);
    };
    reader.readAsText(file);
  }

  parsearCSV(csv: string) {
    const lines = csv.split('\n');
    this.fechasEspeciales = [];

    if (lines.length < 2) {
      console.error('El archivo CSV debe tener al menos una línea de datos');
      return;
    }

    // Detectar el separador basándose en la primera línea de datos
    let separador = '\t'; // Por defecto tabulación
    if (lines.length > 1) {
      const primeraLineaDatos = lines[1].trim();
      if (primeraLineaDatos.includes(',') && !primeraLineaDatos.includes('\t')) {
        separador = ',';
      }
    }

    // Omitir la primera línea (headers)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const partes = line.split(separador);
        if (partes.length >= 2) {
          const fecha = partes[0].trim();
          const tipoFecha = partes[1].trim();

          if (fecha && tipoFecha) {
            // Convertir fecha de DD/MM/YYYY a YYYY-MM-DD
            const fechaParts = fecha.split('/');
            if (fechaParts.length === 3) {
              const fechaFormateada = `${fechaParts[2]}-${fechaParts[1].padStart(2, '0')}-${fechaParts[0].padStart(2, '0')}`;
              this.fechasEspeciales.push({
                fecha: fechaFormateada,
                tipoFecha: tipoFecha
              });
            }
          }
        }
      }
    }
  }

  esFechaEspecial(fecha: string): FechaEspecial | null {
    return this.fechasEspeciales.find(fe => fe.fecha === fecha) || null;
  }

  seleccionarPeriodo(periodo: { numero: number, del: string, al: string }) {
    this.config.reporteActual = periodo.numero;
    this.config.noReporteMensual = periodo.numero.toString();
    this.config.periodoDel = periodo.del;
    this.config.periodoAl = periodo.al;

    // Generar fechas laborables para el periodo seleccionado
    this.fechasLaborables = this.generarFechasLaborables(periodo.del, periodo.al);

    // Actualizar array de asistencia con las fechas laborables
    this.config.asistencia = this.fechasLaborables.map(fecha => {
      const fechaEspecial = this.esFechaEspecial(fecha);
      // console.log('Fecha Especial:', fecha, this.esFechaEspecial(fecha));
      if (fechaEspecial) {
        // Si es fecha especial, usar el tipo como hora entrada y salida
        return {
          fecha: fecha,
          horaEntrada: fechaEspecial.tipoFecha,
          horaSalida: fechaEspecial.tipoFecha,
          horasPorDia: '0'
        };
      } else {
        // Día normal de trabajo
        const horaEntrada = '08:00';
        const horaSalida = '12:00';
        return {
          fecha: fecha,
          horaEntrada: horaEntrada,
          horaSalida: horaSalida,
          horasPorDia: this.calcularHorasPorDia(horaEntrada, horaSalida)
        };
      }
    });

    // Calcular total de horas del mes (solo días normales)
    const horasNormales = this.config.asistencia
      .filter(dia => dia.horasPorDia !== '0')
      .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);

    this.config.totalHorasMes = horasNormales.toString();

    console.log('Fechas laborables del periodo:', this.fechasLaborables);
    console.log('Días laborables:', this.fechasLaborables.length);
  }

}


export interface AsistenciaDia {
  fecha: string;
  horaEntrada: string;
  horaSalida: string;
  horasPorDia: string;
}

// Datos dummy
const config: ReportConfig = {
  startDate: '2024-06-01',
  endDate: '2024-06-30',
  unavailableDates: ['2024-06-10'],
  vacationDates: ['2024-06-15'],
  reportType: 'mensual',
  department: 'Ingeniería',
  includeStatistics: true,

  reporteNo: '001',
  nombrePrestador: 'Juan Pérez',
  unidadAcademica: 'Facultad de Ciencias',
  carrera: 'Ingeniería en Sistemas',
  boleta: '2020123456',
  noReporteMensual: '1',
  periodoDel: '2024-06-01',
  periodoAl: '2024-06-30',
  fechaInicioServicio: '2024-11-04',
  fechaFinServicio: '2024-11-30',
  reporteActual: 1,
  asistencia: [
    {fecha: '2024-06-01', horaEntrada: '08:00', horaSalida: '12:00', horasPorDia: '4'},
    {fecha: '2024-06-02', horaEntrada: '08:00', horaSalida: '12:00', horasPorDia: '4'},
    {fecha: '2024-06-03', horaEntrada: '08:00', horaSalida: '12:00', horasPorDia: '4'},
    {fecha: '2024-06-04', horaEntrada: '08:00', horaSalida: '12:00', horasPorDia: '4'},
    {fecha: '2024-06-05', horaEntrada: '08:00', horaSalida: '12:00', horasPorDia: '4'},
  ],
  totalHorasMes: '88',
  totalHorasAcumuladas: '120',
};
