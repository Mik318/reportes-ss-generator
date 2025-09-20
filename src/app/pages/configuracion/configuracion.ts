import {Component, computed, LOCALE_ID, model, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PDFDocument, rgb, StandardFonts} from 'pdf-lib';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import moment from 'moment';
import 'moment/locale/es';
import {NgClass, registerLocaleData} from '@angular/common';
import localeEs from '@angular/common/locales/es';
import {StepIndicator} from './step-indicator/step-indicator';
import JSZip from 'jszip';

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
  reporteNo: string;
  nombrePrestador: string;
  unidadAcademica: string;
  carrera: string;
  boleta: string;
  noReporteMensual: string;
  periodoDel: string;
  periodoAl: string;
  nombreResponsableDirecto: string;
  cargoResponsableDirecto: string;
  correo: string;
  telefono: string;
  reportDateMonth: string;
  semestre: string;
  prestatario: string;
  asistencia: AsistenciaDia[];
  totalHorasMes: string;
  totalHorasAcumuladas: string;
  reporteActual: number;
}

export interface FechaEspecial {
  fecha: string;
  tipoFecha: string;
}

export interface daysOfWeek {
  key: string;
  label: string;
}

export interface ServiceSchedule {
  [key: string]: hosrariosServicio;
}

export interface hosrariosServicio {
  day: string;
  entrada: string;
  salida: string
}

interface ReporteGenerado {
  id: string;
  period: {
    weekNumber: number;
    startDate: string;
    endDate: string;
  };
  student: {
    name: string;
    career: string;
    correo: string;
    telefono: string;
  };
  leadPersonal: {
    name: string;
    position: string;
  },
  specialDates: FechaEspecial[];
  asistencia: AsistenciaDia[];
  reportDateMonth: string;
  pdfUrl?: SafeResourceUrl;
  pdfMonthUrl?: SafeResourceUrl;
  resumeActivities: string;
}

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, StepIndicator, NgClass],
  providers: [{provide: LOCALE_ID, useValue: 'es'}],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion {
  currentStep = signal(1);
  config = signal<ReportConfig>(config);

  newDate = model<FechaEspecial>({fecha: '', tipoFecha: ''});

  formFields: string[] = [];
  reportePeriodos: { numero: number; del: string; al: string }[] = [];
  fechasLaborables: string[] = [];
  fechasEspeciales: FechaEspecial[] = [];
  csvFile: File | null = null;
  syncHorarios: boolean = false;
  stepTitles = ['Información', 'Horarios', 'Fechas', 'Previsualizar reportes de asistencia', 'Previsualizar reportes mensuales'];
  totalSteps = 5;

  horariosServicio: hosrariosServicio[] = [
    {day: 'monday', entrada: '07:00', salida: '11:00'},
    {day: 'tuesday', entrada: '12:00', salida: '16:00'},
    {day: 'wednesday', entrada: '10:00', salida: '14:00'},
    {day: 'thursday', entrada: '07:00', salida: '11:00'},
    {day: 'friday', entrada: '16:00', salida: '20:00'},
  ];

  days: daysOfWeek[] = [
    {key: 'monday', label: 'Lunes'},
    {key: 'tuesday', label: 'Martes'},
    {key: 'wednesday', label: 'Miércoles'},
    {key: 'thursday', label: 'Jueves'},
    {key: 'friday', label: 'Viernes'},
  ];

  pdfUrl: SafeResourceUrl | null = null;

  // Señales para reportes y selección
  reports = signal<ReporteGenerado[]>([]);
  selectedReports = signal<Set<string>>(new Set());
  selectedReportsMonth = signal<Set<string>>(new Set());
  isGenerating = signal(false);

  constructor(private sanitizer: DomSanitizer) {
  }


  canProceed = computed(() => {
    switch (this.currentStep()) {
      case 1:
        const s = this.config();
        // Verifica que todos los campos requeridos estén llenos y válidos
        return !!(
          s.boleta?.trim() &&
          s.nombrePrestador?.trim() &&
          s.unidadAcademica?.trim() &&
          s.carrera?.trim() &&
          s.startDate?.trim() &&
          s.endDate?.trim()
        );
      case 2:
        // Verifica que todos los días tengan entrada y salida válidas
        return this.horariosServicio.every(day => day.entrada?.trim() && day.salida?.trim());
      case 3:
        // No es obligatorio tener fechas especiales, siempre puede continuar
        return true;
      case 4:
        // Verifica que existan reportes generados
        return this.reports().length > 0;
      default:
        return false;
    }
  });

  nextStep() {
    if (this.currentStep() < this.totalSteps) {
      // Si el siguiente paso es el 4, recalcula los periodos de reporte
      if (this.currentStep() + 1 === 4) {
        this.calcularPeriodosReporte();
      }
      this.currentStep.set(this.currentStep() + 1);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }


  helpText = computed(() => {
    switch (this.currentStep()) {
      case 1:
        return 'Complete la información básica del prestador de servicio social.';
      case 2:
        return 'Configure los horarios de entrada y salida para cada día de la semana.';
      case 3:
        return 'Agregue fechas especiales como días festivos o vacaciones (opcional).';
      case 4:
        return 'Revise la configuración y genere los reportes PDF. Máximo 7 reportes por generación.';
      case 5:
        return 'Seleccione los reportes que desea descargar en un archivo ZIP.';
      default:
        return '';
    }
  });

  addSpecialDate() {
    if (this.newDate().fecha && this.newDate().tipoFecha) {
      const exists = this.config().asistencia.some(dia =>
        dia.fecha === this.newDate().fecha);
      if (exists) {
        alert('La fecha ya existe en la lista de asistencia.');
        return;
      }
      const specialDateExists = this.fechasEspeciales.some(dia =>
        dia.fecha === this.newDate().fecha);
      if (specialDateExists) {
        alert('La fecha ya existe en la lista de fechas especiales.');
        return;
      }
      this.fechasEspeciales.push({...this.newDate()});
      this.newDate.set({fecha: '', tipoFecha: ''});
    }
  }

  removeSpecialDate(index: number) {
    const updated = this.fechasEspeciales.filter((_, i) => i !== index);
    this.fechasEspeciales = updated;
  }

  handleTimeChange(day: string, field: 'entrada' | 'salida', value: string) {
    // Encuentra el índice del día en diasSemana
    const idx = this.days.findIndex(d => d.key === day);
    if (idx !== -1) {
      if (field === 'entrada') {
        this.horariosServicio[idx].entrada = value;
      } else {
        this.horariosServicio[idx].salida = value;
      }
    }
  }

  applyToAllDays(type: 'entrada' | 'salida') {
    // Usa el primer horario como referencia
    const referenceTime = this.horariosServicio[0][type];
    if (!referenceTime) return;

    this.horariosServicio.forEach(horario => {
      horario[type] = referenceTime;
    });
  }


  formatearFechaEspanol(fecha: string): string {
    // Configurar moment a español y formatear
    moment.locale('es');
    return moment(fecha).format('DD [de] MMMM [de] YYYY');
  }

  contarDiasEspeciales(): number {
    if (!this.config().asistencia) return 0;
    return this.config().asistencia.filter((dia) => dia.horasPorDia === '0').length;
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
    for (let i = 1; i <= this.config().reporteActual; i++) {
      const periodo = this.reportePeriodos.find((r) => r.numero === i);
      if (periodo) {
        const fechasLaborables = this.generarFechasLaborables(periodo.del, periodo.al);
        fechasLaborables.forEach((fecha) => {
          const fechaEspecial = this.esFechaEspecial(fecha);
          if (!fechaEspecial) {
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
    const usarTestPdf = this.config().asistencia.length > maxCamposDefault;
    const url = usarTestPdf
      ? 'assets/control-asistencia-test.pdf'
      : 'assets/control-asistencia.pdf';

    const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Información del Prestador y el Reporte
    form
      .getTextField('Correspondiente al reporte mensual de actividades No')
      .setText(this.config().noReporteMensual);
    form.getTextField('Periodo del').setText(this.formatearFechaEspanol(this.config().periodoDel));
    form.getTextField('al').setText(this.formatearFechaEspanol(this.config().periodoAl));
    form.getTextField('Nombre del Prestador').setText(this.config().nombrePrestador);
    form.getTextField('Unidad Académica').setText(this.config().unidadAcademica);
    form.getTextField('Carrera').setText(this.config().carrera);
    form.getTextField('Boleta').setText(this.config().boleta);

    // Agregar texto directamente por coordenadas (parte inferior izquierda)
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    if (this.config().nombreResponsableDirecto) {
      firstPage.drawText(`${this.config().nombreResponsableDirecto}`, {
        x: -20,
        y: 10,
        size: 12,
        color: rgb(0, 0, 0)
      });
    }
    // }

    // if (this.campoExiste(form, 'Cargo Responsable')) {
    //   form.getTextField('Cargo Responsable').setText(this.config().cargoResponsableDirecto);
    // } else {
    // Agregar texto directamente por coordenadas (debajo del nombre)
    // const pages = pdfDoc.getPages();
    // const firstPage = pages[0];

    if (this.config().cargoResponsableDirecto) {
      firstPage.drawText(`Cargo: ${this.config().cargoResponsableDirecto}`, {
        x: -20,
        y: -5,
        size: 12,
        color: rgb(0, 0, 0)
      });
    }
    // }

    // Campos de la Tabla de Asistencia - Limitar a los campos disponibles
    const maxCampos = this.obtenerMaximoCamposDisponibles(form);
    const diasAMostrar = Math.min(this.config().asistencia.length, maxCampos);

    console.log(
      `PDF soporta máximo ${maxCampos} campos. Días a mostrar: ${diasAMostrar} de ${this.config().asistencia.length}`,
    );

    for (let i = 0; i < diasAMostrar; i++) {
      const dia = this.config().asistencia[i];
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
    if (this.config().asistencia.length > maxCampos) {
      const diasFaltantes = this.config().asistencia.length - maxCampos;
      console.warn(
        `El PDF solo soporta ${maxCampos} días, faltan ${diasFaltantes} días por mostrar.`,
      );
      alert(
        `Advertencia: El PDF actual solo puede mostrar ${maxCampos} días.\n\nSe necesitan ${diasFaltantes} campos adicionales para mostrar todos los días del período.\n\n¿Te gustaría que se cree un nuevo PDF con más campos?`,
      );
    }

    // Totales
    form
      .getTextField('Horas por díaTOTAL DE HORAS PRESTADAS POR MES')
      .setText(this.config().totalHorasMes);
    // Actualiza el acumulado usando set
    this.config.set({
      ...this.config(),
      totalHorasAcumuladas: this.calcularHorasAcumuladas(),
    });
    form
      .getTextField('Horas por díaTOTAL DE HORAS PRESTADAS ACUMULADAS')
      .setText(this.config().totalHorasAcumuladas);

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
    for (let i = 1; i <= 50; i++) {
      // Probar hasta 50 campos
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
      const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();

      const fields = form.getFields();
      this.formFields = fields.map((field) => field.getName());

      console.log('Campos del formulario PDF:', this.formFields);
    } catch (error) {
      console.error('Error al leer los campos del PDF:', error);
    }
  }

  // Métodos para selección y vista previa
  toggleReportSelection(id: string) {
    const set = new Set(this.selectedReports());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedReports.set(set);
  }

  toggleReportSelectionMonth(id: string) {
    const set = new Set(this.selectedReportsMonth());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id)
    }
    this.selectedReportsMonth.set(set)
  }

  selectAllReports() {
    const allIds = this.reports().map(r => r.id);
    this.selectedReports.set(new Set(allIds));
  }

  selectAllReportsMonth() {
    const allIds = this.reports().map(r => r.id);
    this.selectedReportsMonth.set(new Set(allIds));
  }

  deselectAllReports() {
    this.selectedReports.set(new Set());
  }

  deselectAllReportsMoth() {
    this.selectedReportsMonth.set(new Set());
  }

  previewReport(report: ReporteGenerado) {
    this.config.set({
      ...this.config(),
      periodoDel: report.period.startDate,
      periodoAl: report.period.endDate,
      asistencia: report.asistencia,
      noReporteMensual: report.period.weekNumber.toString(),
      reporteActual: report.period.weekNumber,
    });
  }

  async downloadSelectedReports() {
    if (this.selectedReports().size === 0) {
      alert('No hay reportes seleccionados para descargar.');
      return;
    }

    this.isGenerating.set(true);

    try {
      const zip = new JSZip();
      const reportesSeleccionados = this.reports().filter(report =>
        this.selectedReports().has(report.id)
      );

      for (const report of reportesSeleccionados) {
        try {
          const pdfBytes = await this.generateReportPdfBytes(report);
          const fileName = `Reporte_${report.period.weekNumber}_${this.config().nombrePrestador.replace(/\s+/g, '_')}.pdf`;
          zip.file(fileName, pdfBytes);
        } catch (error) {
          console.error(`Error generando PDF para reporte ${report.period.weekNumber}:`, error);
        }
      }

      const zipBlob = await zip.generateAsync({type: 'blob'});

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reportes_ServicioSocial_${this.config().nombrePrestador.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Se descargaron ${reportesSeleccionados.length} reportes en formato ZIP.`);
    } catch (error) {
      console.error('Error generando ZIP:', error);
      alert('Error al generar el archivo ZIP. Por favor intenta de nuevo.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  async downloadSelectedReportsMonth() {
    if (this.selectedReportsMonth().size === 0) {
      alert('No hay reportes seleccionados para descargar.');
      return;
    }

    this.isGenerating.set(true);

    try {
      const zip = new JSZip();
      const reportesSeleccionados = this.reports().filter(report =>
        this.selectedReportsMonth().has(report.id)
      );

      for (const report of reportesSeleccionados) {
        try {
          const pdfBytes = await this.generateReportMonthPdfBytes(report);
          const fileName = `Reporte_mensual_${report.period.weekNumber}_${this.config().nombrePrestador.replace(/\s+/g, '_')}.pdf`;
          zip.file(fileName, pdfBytes);
        } catch (error) {
          console.error(`Error generando PDF para reporte ${report.period.weekNumber}:`, error);
        }
      }

      const zipBlob = await zip.generateAsync({type: 'blob'});

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reportes_ServicioSocial_Mensual${this.config().nombrePrestador.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Se descargaron ${reportesSeleccionados.length} reportes en formato ZIP.`);
    } catch (error) {
      console.error('Error generando ZIP:', error);
      alert('Error al generar el archivo ZIP. Por favor intenta de nuevo.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  // Genera los reportes según los periodos calculados
  generateAllReports() {
    const reportes: ReporteGenerado[] = [];
    const periodos = this.reportePeriodos.slice(0, 7); // máximo 7 reportes

    periodos.forEach((periodo, idx) => {
      const fechas = this.generarFechasLaborables(periodo.del, periodo.al);

      // Filtra fechas especiales que caen en el periodo del reporte
      const specialDatesPeriodo = this.fechasEspeciales.filter(fe =>
        moment(fe.fecha).isSameOrAfter(periodo.del) && moment(fe.fecha).isSameOrBefore(periodo.al)
      );

      const asistencia = fechas.map(fecha => {
        const fechaEspecial = specialDatesPeriodo.find(fe => fe.fecha === fecha);
        if (fechaEspecial) {
          return {
            fecha: fecha,
            horaEntrada: fechaEspecial.tipoFecha,
            horaSalida: fechaEspecial.tipoFecha,
            horasPorDia: '0',
          };
        } else {
          const diaSemana = moment(fecha).isoWeekday();
          const i = Math.max(0, Math.min(4, diaSemana - 1));
          const horario = this.horariosServicio[i];
          const horasPorDia = this.calcularHorasPorDia(horario.entrada, horario.salida);
          return {
            fecha: fecha,
            horaEntrada: horario.entrada,
            horaSalida: horario.salida,
            horasPorDia: horasPorDia,
          };
        }
      });

      // Procesa los días especiales para este reporte
      const specialDatesEnAsistencia = asistencia
        .filter(a => a.horasPorDia === '0')
        .map(a => ({
          fecha: a.fecha,
          tipoFecha: a.horaEntrada,
        }));

      reportes.push({
        id: `reporte-${idx + 1}`,
        period: {
          weekNumber: idx + 1,
          startDate: this.formatearFechaEspanol(periodo.del),
          endDate: this.formatearFechaEspanol(periodo.al),
        },
        student: {
          name: this.config().nombrePrestador,
          career: this.config().carrera,
          correo: this.config().correo,
          telefono: this.config().telefono
        },
        leadPersonal: {
          name: this.config().nombreResponsableDirecto,
          position: this.config().cargoResponsableDirecto
        },
        specialDates: specialDatesEnAsistencia,
        reportDateMonth: this.formatearFechaEspanol(this.config().reportDateMonth),
        asistencia,
        resumeActivities: ''
      });
    });

    this.reports.set(reportes);
    this.selectedReports.set(new Set());
  }

  // Llama a generateAllReports cuando se calculan los periodos
  calcularPeriodosReporte() {
    // Corrige acceso a las señales
    if (!this.config().startDate || !this.config().endDate) {
      return;
    }

    const fechaInicio = moment(this.config().startDate);
    const fechaFin = moment(this.config().endDate);
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
          al: periodoFin.format('YYYY-MM-DD'),
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
          al: periodoFin.format('YYYY-MM-DD'),
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

    this.generateAllReports();
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
                tipoFecha: tipoFecha,
              });
            }
          }
        }
      }
    }

    // Actualiza los reportes para reflejar las fechas especiales recién cargadas
    this.generateAllReports();
  }

  esFechaEspecial(fecha: string): FechaEspecial | null {
    return this.fechasEspeciales.find((fe) => fe.fecha === fecha) || null;
  }

  seleccionarPeriodo(periodo: { numero: number; del: string; al: string }) {
    // Actualiza config usando set
    this.config.set({
      ...this.config(),
      reporteActual: periodo.numero,
      noReporteMensual: periodo.numero.toString(),
      periodoDel: periodo.del,
      periodoAl: periodo.al,
    });

    // Generar fechas laborables para el periodo seleccionado
    this.fechasLaborables = this.generarFechasLaborables(periodo.del, periodo.al);

    // Actualizar array de asistencia con las fechas laborables y horarios según el día de la semana
    const asistencia = this.fechasLaborables.map((fecha) => {
      const fechaEspecial = this.esFechaEspecial(fecha);

      if (fechaEspecial) {
        return {
          fecha: fecha,
          horaEntrada: fechaEspecial.tipoFecha,
          horaSalida: fechaEspecial.tipoFecha,
          horasPorDia: '0',
        };
      } else {
        const diaSemana = moment(fecha).isoWeekday();
        const idx = Math.max(0, Math.min(4, diaSemana - 1));
        const horario = this.horariosServicio[idx];
        const horasPorDia = this.calcularHorasPorDia(horario.entrada, horario.salida);

        return {
          fecha: fecha,
          horaEntrada: horario.entrada,
          horaSalida: horario.salida,
          horasPorDia: horasPorDia,
        };
      }
    });

    // Calcular total de horas del mes (solo días normales)
    const horasNormales = asistencia
      .filter((dia) => dia.horasPorDia !== '0')
      .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);

    // Actualiza config con asistencia y totalHorasMes
    this.config.set({
      ...this.config(),
      asistencia,
      totalHorasMes: horasNormales.toString(),
    });
  }

  // Add this new method
  onHorarioInput(event: Event, type: 'entrada' | 'salida') {
    if (!this.syncHorarios) {
      return;
    }

    const target = event.target as HTMLInputElement;
    const newValue = target.value;

    this.horariosServicio.forEach((horario) => {
      horario[type] = newValue;
    });
  }

  // Método público para obtener la URL segura del PDF
  getPdfUrl(): SafeResourceUrl {
    if (this.pdfUrl) {
      return this.pdfUrl;
    }
    const pdfPath =
      this.config().asistencia.length > 24
        ? 'assets/control-asistencia-test.pdf'
        : 'assets/control-asistencia.pdf';
    return this.sanitizer.bypassSecurityTrustResourceUrl(pdfPath);
  }

  // Genera un PDF individual para un reporte específico
  async generateSingleReportPdf(report: ReporteGenerado) {
    try {
      // Determina el PDF según el número de fechas a mostrar
      const maxCamposDefault = 24;
      const usarTestPdf = report.asistencia.length > maxCamposDefault;
      const url = usarTestPdf
        ? 'assets/control-asistencia-test.pdf'
        : 'assets/control-asistencia.pdf';

      const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();

      // Información del Prestador y el Reporte
      form.getTextField('Correspondiente al reporte mensual de actividades No')
        .setText(report.period.weekNumber.toString());
      form.getTextField('Periodo del').setText(report.period.startDate);
      form.getTextField('al').setText(report.period.endDate);
      form.getTextField('Nombre del Prestador').setText(report.student.name);
      form.getTextField('Unidad Académica').setText(this.config().unidadAcademica);
      form.getTextField('Carrera').setText(report.student.career);
      form.getTextField('Boleta').setText(this.config().boleta);


      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      if (this.config().nombreResponsableDirecto) {
        firstPage.drawText(`${this.config().nombreResponsableDirecto}`, {
          x: usarTestPdf ? 28 : 28,
          y: usarTestPdf ? 40 : 60,
          size: 12,
          color: rgb(0, 0, 0)
        });
      }

      if (this.config().cargoResponsableDirecto) {
        firstPage.drawText(`${this.config().cargoResponsableDirecto}`, {
          x: usarTestPdf ? 28 : 28,
          y: usarTestPdf ? 25 : 45,
          size: 12,
          color: rgb(0, 0, 0)
        });
      }

      // Campos de la Tabla de Asistencia
      const maxCampos = this.obtenerMaximoCamposDisponibles(form);
      const diasAMostrar = Math.min(report.asistencia.length, maxCampos);

      for (let i = 0; i < diasAMostrar; i++) {
        const dia = report.asistencia[i];
        try {
          const campoFecha = `Fecha${i + 1}`;
          const campoEntrada = `Hora de Entrada${i + 1}`;
          const campoSalida = `Hora de Salida${i + 1}`;
          const campoHoras = `Horas por día${i + 1}`;

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

      // Calcular totales para este reporte
      const horasMes = report.asistencia
        .filter(dia => dia.horasPorDia !== '0')
        .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);

      form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS POR MES')
        .setText(horasMes.toString());

      // Calcular horas acumuladas hasta este reporte
      const horasAcumuladas = this.calcularHorasAcumuladasHasta(report.period.weekNumber);
      form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS ACUMULADAS')
        .setText(horasAcumuladas.toString());

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {type: 'application/pdf'});
      const urlBlob = URL.createObjectURL(blob);

      // Actualizar el reporte con la nueva URL
      const reportes = this.reports();
      const updatedReportes = reportes.map(r =>
        r.id === report.id
          ? {...r, pdfUrl: this.sanitizer.bypassSecurityTrustResourceUrl(urlBlob)}
          : r
      );
      this.reports.set(updatedReportes);

    } catch (error) {
      console.error('Error generando PDF del reporte:', error);
    }
  }

  async generateSingleReportMonthPdf(report: ReporteGenerado) {
    try {
      const url = 'assets/reporte-mensual.pdf';
      const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      fields.forEach((field) => {
        console.log('Campo:', field.getName());
      });

      form.getTextField('fecha_elaboracion').setText(report.reportDateMonth);
      form.getTextField('nombre_1').setText(report.student.name)
      form.getTextField('nombre_2').setText(report.student.name)
      form.getTextField('periodo_del').setText(report.period.startDate)
      form.getTextField('al').setText(report.period.endDate)
      form.getTextField('responsable_directo').setText(report.leadPersonal.name)
      form.getTextField('cargo_responsable').setText(report.leadPersonal.position)
      form.getTextField('No').setText(report.period.weekNumber.toString())
      form.getTextField('boleta').setText(this.config().boleta)
      form.getTextField('programa_academico').setText(this.config().unidadAcademica)
      form.getTextField('semestre').setText(this.config().semestre)
      form.getTextField('telefono_particular').setText(report.student.telefono)
      form.getTextField('correo_electronico').setText(report.student.correo)
      form.getTextField('prestatario').setText(this.config().prestatario)
      form.getTextField('actividades_realizadas').setText(report.resumeActivities)

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {type: 'application/pdf'});
      const urlBlob = URL.createObjectURL(blob);

      // Actualizar el reporte con la nueva URL
      const reportes = this.reports();
      const updatedReportes = reportes.map(r =>
        r.id === report.id
          ? {...r, pdfMonthUrl: this.sanitizer.bypassSecurityTrustResourceUrl(urlBlob)}
          : r
      );
      this.reports.set(updatedReportes);

    } catch (error) {
      console.error('Error generando PDF del reporte:', error);
    }
  }

  // Genera PDFs para todos los reportes
  async generateAllReportsPdf(reportType: 'single' | 'month' = 'single') {
    this.isGenerating.set(true);
    try {
      for (const report of this.reports()) {
        if (reportType === 'single') {
          await this.generateSingleReportPdf(report);
        } else {
          await this.generateSingleReportMonthPdf(report);
        }
        // Pequeña pausa para evitar bloquear la UI
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error generando PDFs:', error);
    } finally {
      this.isGenerating.set(false);
    }
  }

  // Calcula horas acumuladas hasta un reporte específico
  calcularHorasAcumuladasHasta(numeroReporte: number): number {
    let acumulado = 0;

    for (let i = 1; i <= numeroReporte; i++) {
      const reporte = this.reports().find(r => r.period.weekNumber === i);
      if (reporte) {
        const horasReporte = reporte.asistencia
          .filter(dia => dia.horasPorDia !== '0')
          .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);
        acumulado += horasReporte;
      }
    }

    return acumulado;
  }

  private async generateReportPdfBytes(report: ReporteGenerado): Promise<Uint8Array> {
    const maxCamposDefault = 24;
    const usarTestPdf = report.asistencia.length > maxCamposDefault;
    const url = usarTestPdf
      ? 'assets/control-asistencia-test.pdf'
      : 'assets/control-asistencia.pdf';

    const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    form.getTextField('Correspondiente al reporte mensual de actividades No')
      .setText(report.period.weekNumber.toString());
    form.getTextField('Periodo del').setText(report.period.startDate);
    form.getTextField('al').setText(report.period.endDate);
    form.getTextField('Nombre del Prestador').setText(report.student.name);
    form.getTextField('Unidad Académica').setText(this.config().unidadAcademica);
    form.getTextField('Carrera').setText(report.student.career);
    form.getTextField('Boleta').setText(this.config().boleta);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    if (this.config().nombreResponsableDirecto) {
      firstPage.drawText(`${this.config().nombreResponsableDirecto}`, {
        x: usarTestPdf ? 28 : 28,
        y: usarTestPdf ? 40 : 60,
        size: 12,
        color: rgb(0, 0, 0)
      });
    }

    if (this.config().cargoResponsableDirecto) {
      firstPage.drawText(`${this.config().cargoResponsableDirecto}`, {
        x: usarTestPdf ? 28 : 28,
        y: usarTestPdf ? 25 : 45,
        size: 12,
        color: rgb(0, 0, 0)
      });
    }

    const maxCampos = this.obtenerMaximoCamposDisponibles(form);
    const diasAMostrar = Math.min(report.asistencia.length, maxCampos);

    for (let i = 0; i < diasAMostrar; i++) {
      const dia = report.asistencia[i];
      try {
        const campoFecha = `Fecha${i + 1}`;
        const campoEntrada = `Hora de Entrada${i + 1}`;
        const campoSalida = `Hora de Salida${i + 1}`;
        const campoHoras = `Horas por día${i + 1}`;

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

    const horasMes = report.asistencia
      .filter(dia => dia.horasPorDia !== '0')
      .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);

    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS POR MES')
      .setText(horasMes.toString());

    const horasAcumuladas = this.calcularHorasAcumuladasHasta(report.period.weekNumber);
    form.getTextField('Horas por díaTOTAL DE HORAS PRESTADAS ACUMULADAS')
      .setText(horasAcumuladas.toString());

    const pdfBytes = await pdfDoc.save();
    return new Uint8Array(pdfBytes);
  }

  private async generateReportMonthPdfBytes(report: ReporteGenerado): Promise<Uint8Array> {
    const url = 'assets/reporte-mensual.pdf';
    const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    fields.forEach((field) => {
      console.log('Campo:', field.getName());
    });

    form.getTextField('fecha_elaboracion').setText(report.reportDateMonth);
    form.getTextField('nombre_1').setText(report.student.name)
    form.getTextField('nombre_2').setText(report.student.name)
    form.getTextField('periodo_del').setText(report.period.startDate)
    form.getTextField('al').setText(report.period.endDate)
    form.getTextField('responsable_directo').setText(report.leadPersonal.name)
    form.getTextField('cargo_responsable').setText(report.leadPersonal.position)
    form.getTextField('No').setText(report.period.weekNumber.toString())
    form.getTextField('boleta').setText(this.config().boleta)
    form.getTextField('programa_academico').setText(this.config().unidadAcademica)
    form.getTextField('semestre').setText(this.config().semestre)
    form.getTextField('telefono_particular').setText(report.student.telefono)
    form.getTextField('correo_electronico').setText(report.student.correo)
    form.getTextField('prestatario').setText(this.config().prestatario)
    form.getTextField('actividades_realizadas').setText(report.resumeActivities)

    const pdfBytes = await pdfDoc.save();
    return new Uint8Array(pdfBytes);
  }

  // Métodos para actualizar los campos del config
  updateBoleta(value: string) {
    this.config.set({...this.config(), boleta: value});
  }

  updateNombrePrestador(value: string) {
    this.config.set({...this.config(), nombrePrestador: value});
  }

  updateUnidadAcademica(value: string) {
    this.config.set({...this.config(), unidadAcademica: value});
  }

  updateCarrera(value: string) {
    this.config.set({...this.config(), carrera: value});
  }

  updateStartDate(value: string) {
    this.config.set({...this.config(), startDate: value});
  }

  updateReportDateMonth(value: string) {
    this.config.set({...this.config(), reportDateMonth: value});
  }

  updateReportSemestre(value: string) {
    this.config.set({...this.config(), semestre: value});
  }

  updateReportprestatario(value: string) {
    this.config.set({...this.config(), prestatario: value});
  }

  updateEndDate(value: string) {
    this.config.set({...this.config(), endDate: value});
  }

  updateNombreResponsableDirecto(value: string) {
    this.config.set({...this.config(), nombreResponsableDirecto: value});
  }

  updateCargoResponsableDirecto(value: string) {
    this.config.set({...this.config(), cargoResponsableDirecto: value});
  }

  updateCorreo(value: string) {
    this.config.set({...this.config(), correo: value});
  }

  updateTelefono(value: string) {
    this.config.set({...this.config(), telefono: value});
  }

  updateResumeActivities(reportId: string, value: string) {
    const updatedReports = this.reports().map(report =>
      report.id === reportId
        ? {...report, resumeActivities: value}
        : report
    );
    this.reports.set(updatedReports);
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
  startDate: '',
  endDate: '',
  unavailableDates: [],
  vacationDates: [],
  reportType: '',
  department: '',
  reporteNo: '',
  nombrePrestador: '',
  unidadAcademica: '',
  cargoResponsableDirecto: '',
  nombreResponsableDirecto: '',
  carrera: '',
  boleta: '',
  noReporteMensual: '',
  periodoDel: '',
  periodoAl: '',
  correo: '',
  semestre: '',
  reportDateMonth: '',
  telefono: '',
  prestatario: '',
  reporteActual: 0,
  asistencia: [],
  totalHorasMes: '',
  totalHorasAcumuladas: '',
};
