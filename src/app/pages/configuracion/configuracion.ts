import {Component, LOCALE_ID} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PDFDocument, rgb, StandardFonts} from 'pdf-lib';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import moment from 'moment';
import 'moment/locale/es';
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
  providers: [
    { provide: LOCALE_ID, useValue: 'es' }
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

  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  horariosServicio = [
    { entrada: '07:00', salida: '11:00' },
    { entrada: '12:00', salida: '16:00' },
    { entrada: '10:00', salida: '14:00' },
    { entrada: '07:00', salida: '11:00' },
    { entrada: '16:00', salida: '20:00' },
  ];

  pdfUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {
  }

  formatearFechaEspanol(fecha: string): string {
    // Configurar moment a español y formatear
    moment.locale('es');
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

  calcularHorasAcumuladas(): string {
    // Suma las horas de todos los reportes generados hasta el actual
    let acumulado = 0;
    for (let i = 1; i <= this.config.reporteActual; i++) {
      const periodo = this.reportePeriodos.find(r => r.numero === i);
      if (periodo) {
        const fechasLaborables = this.generarFechasLaborables(periodo.del, periodo.al);
        fechasLaborables.forEach(fecha => {
          const fechaEspecial = this.esFechaEspecial(fecha);
          if (!fechaEspecial) {
            // Día normal, calcula el horario según el día de la semana
            const diaSemana = moment(fecha).isoWeekday();
            const idx = Math.max(0, Math.min(4, diaSemana - 1));
            const horario = this.horariosServicio[idx];
            acumulado += parseFloat(this.calcularHorasPorDia(horario.entrada, horario.salida));
          }
        });
      }
    }
    return acumulado.toString();
  }

  async generateReport() {
    // Determina el PDF según el número de fechas a mostrar
    const maxCamposDefault = 24; // Ajusta según los campos que soporte el PDF normal
    const usarTestPdf = this.config.asistencia.length > maxCamposDefault;
    const url = usarTestPdf
      ? 'assets/control-asistencia-test.pdf'
      : 'assets/control-asistencia.pdf';

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

    // Campos de la Tabla de Asistencia - Limitar a los campos disponibles
    const maxCampos = this.obtenerMaximoCamposDisponibles(form);
    const diasAMostrar = Math.min(this.config.asistencia.length, maxCampos);

    console.log(`PDF soporta máximo ${maxCampos} campos. Días a mostrar: ${diasAMostrar} de ${this.config.asistencia.length}`);

    for (let i = 0; i < diasAMostrar; i++) {
      const dia = this.config.asistencia[i];
      try {
        const campoFecha = `Fecha${i + 1}`;
        const campoEntrada = `Hora de Entrada${i + 1}`;
        const campoSalida = `Hora de Salida${i + 1}`;
        const campoHoras = `Horas por día${i + 1}`;

        // Verificar y escribir cada campo si existe
        if (this.campoExiste(form, campoFecha)) {
          form.getTextField(campoFecha).setText(this.formatearFechaEspanol(dia.fecha));
        }
        if (this.campoExiste(form, campoEntrada)) {
          form.getTextField(campoEntrada).setText(dia.horaEntrada);
        }
        if (this.campoExiste(form, campoSalida)) {
          form.getTextField(campoSalida).setText(dia.horaSalida);
        }
        if (this.campoExiste(form, campoHoras)) {
          form.getTextField(campoHoras).setText(dia.horasPorDia);
        }
      } catch (error) {
        console.warn(`Error al escribir día ${i + 1}:`, error);
        break;
      }
    }

    // Mostrar advertencia si hay más días que campos disponibles
    if (this.config.asistencia.length > maxCampos) {
      const diasFaltantes = this.config.asistencia.length - maxCampos;
      console.warn(`El PDF solo soporta ${maxCampos} días, faltan ${diasFaltantes} días por mostrar.`);
      alert(`Advertencia: El PDF actual solo puede mostrar ${maxCampos} días.\n\nSe necesitan ${diasFaltantes} campos adicionales para mostrar todos los días del período.\n\n¿Te gustaría que se cree un nuevo PDF con más campos?`);
    }

    // Totales
    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS POR MES').setText(this.config.totalHorasMes);
    this.config.totalHorasAcumuladas = this.calcularHorasAcumuladas();
    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS ACUMULADAS').setText(this.config.totalHorasAcumuladas);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], {type: 'application/pdf'});
    const urlBlob = URL.createObjectURL(blob);

    // Propiedad pdfUrl para que el iframe lo use
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(urlBlob);
  }

  // Método auxiliar para verificar si un campo existe
  campoExiste(form: any, nombreCampo: string): boolean {
    try {
      form.getField(nombreCampo);
      return true;
    } catch {
      return false;
    }
  }

  // Método para determinar el máximo número de campos disponibles
  obtenerMaximoCamposDisponibles(form: any): number {
    let maxCampos = 0;

    // Probar hasta encontrar el máximo número de campos Fecha disponibles
    for (let i = 1; i <= 50; i++) { // Probar hasta 50 campos
      if (this.campoExiste(form, `Fecha${i}`)) {
        maxCampos = i;
      } else {
        break;
      }
    }

    console.log(`Máximo de campos detectados: ${maxCampos}`);
    return maxCampos;
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

        // Si es el reporte 7, extender hasta la fecha final del servicio
        if (numeroReporte === 7) {
          periodoFin = fechaFin.clone();
        }

        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD')
        });

        // Limitar a máximo 7 reportes
        if (numeroReporte >= 7) {
          break;
        }

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

        // Si es el reporte 7, extender hasta la fecha final del servicio
        if (numeroReporte === 7) {
          periodoFin = fechaFin.clone();
        }

        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD')
        });

        // Limitar a máximo 7 reportes
        if (numeroReporte >= 7) {
          break;
        }

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

    // Actualizar array de asistencia con las fechas laborables y horarios según el día de la semana
    this.config.asistencia = this.fechasLaborables.map(fecha => {
      const fechaEspecial = this.esFechaEspecial(fecha);

      if (fechaEspecial) {
        // Si es fecha especial, usar el tipo como hora entrada y salida
        return {
          fecha: fecha,
          horaEntrada: fechaEspecial.tipoFecha,
          horaSalida: fechaEspecial.tipoFecha,
          horasPorDia: '0'
        };
      } else {
        // Día normal de trabajo: asignar horario según el día de la semana
        const diaSemana = moment(fecha).isoWeekday(); // 1=Lunes ... 5=Viernes
        // Ajustar índice para array (Lunes=0, ..., Viernes=4)
        const idx = Math.max(0, Math.min(4, diaSemana - 1));
        const horario = this.horariosServicio[idx];
        const horasPorDia = this.calcularHorasPorDia(horario.entrada, horario.salida);

        return {
          fecha: fecha,
          horaEntrada: horario.entrada,
          horaSalida: horario.salida,
          horasPorDia: horasPorDia
        };
      }
    });

    // Calcular total de horas del mes (solo días normales)
    const horasNormales = this.config.asistencia
      .filter(dia => dia.horasPorDia !== '0')
      .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);

    this.config.totalHorasMes = horasNormales.toString();
  }

  // Método público para obtener la URL segura del PDF
  getPdfUrl(): SafeResourceUrl {
    if (this.pdfUrl) {
      return this.pdfUrl;
    }
    const pdfPath = this.config.asistencia.length > 24
      ? 'assets/control-asistencia-test.pdf'
      : 'assets/control-asistencia.pdf';
    return this.sanitizer.bypassSecurityTrustResourceUrl(pdfPath);
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
