import {Component, computed, LOCALE_ID, model, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PDFDocument, PDFFont, PDFForm, rgb, StandardFonts} from 'pdf-lib';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import moment from 'moment';
import 'moment/locale/es';
import {NgClass, registerLocaleData} from '@angular/common';
import localeEs from '@angular/common/locales/es';
import {StepIndicator} from '../../shared/components/step-indicator/step-indicator';
import JSZip from 'jszip';
import {ReportRequest, ReportsService} from '../../../libs/republica-cafe-management';

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
  isLoading = signal(false);

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

  reports = signal<ReporteGenerado[]>([]);
  selectedReports = signal<Set<string>>(new Set());
  selectedReportsMonth = signal<Set<string>>(new Set());
  isGenerating = signal(false);

  // Señales para controlar la UI del autocompletar con IA por reporte
  iaEditorOpen = signal<Record<string, boolean>>({});
  iaActivities = signal<Record<string, string[]>>({});

  constructor(
    private sanitizer: DomSanitizer,
    private _reportsService: ReportsService
  ) {
    // Cargar datos guardados de todos los pasos al inicializar
    this.loadStep1FromLocalStorage();
    this.loadStep2FromLocalStorage();
    this.loadStep3FromLocalStorage();
    // Cargar paso 4 y 5 si existen
    this.loadStep4FromLocalStorage();
    this.loadStep5FromLocalStorage();
  }

  // --- Validaciones y navegación ---
  canProceed = computed(() => {
    switch (this.currentStep()) {
      case 1:
        const s = this.config();
        return !!(
          s.boleta?.trim() &&
          s.nombrePrestador?.trim() &&
          s.unidadAcademica?.trim() &&
          s.carrera?.trim() &&
          s.startDate?.trim() &&
          s.endDate?.trim()
        );
      case 2:
        return this.horariosServicio.every(day => day.entrada?.trim() && day.salida?.trim());
      case 3:
        return true;
      case 4:
        return this.reports().length > 0;
      default:
        return false;
    }
  });

  nextStep() {
    if (this.currentStep() < this.totalSteps) {
      // Guardar datos del paso actual antes de avanzar
      this.saveCurrentStepData();

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

  // --- Horarios ---
  handleTimeChange(day: string, field: 'entrada' | 'salida', value: string) {
    const idx = this.days.findIndex(d => d.key === day);
    if (idx !== -1) {
      this.horariosServicio[idx][field] = value;
      this.saveStep2ToLocalStorage();
    }
  }

  applyToAllDays(type: 'entrada' | 'salida') {
    const referenceTime = this.horariosServicio[0][type];
    if (!referenceTime) return;
    this.horariosServicio.forEach(horario => {
      horario[type] = referenceTime;
    });
    this.saveStep2ToLocalStorage();
  }

  // --- Fechas especiales ---
  addSpecialDate() {
    if (this.newDate().fecha && this.newDate().tipoFecha) {
      const exists = this.config().asistencia.some(dia => dia.fecha === this.newDate().fecha);
      if (exists) {
        alert('La fecha ya existe en la lista de asistencia.');
        return;
      }
      const specialDateExists = this.fechasEspeciales.some(dia => dia.fecha === this.newDate().fecha);
      if (specialDateExists) {
        alert('La fecha ya existe en la lista de fechas especiales.');
        return;
      }
      this.fechasEspeciales.push({...this.newDate()});
      this.newDate.set({fecha: '', tipoFecha: ''});
      this.saveStep3ToLocalStorage();
    }
  }

  removeSpecialDate(index: number) {
    this.fechasEspeciales = this.fechasEspeciales.filter((_, i) => i !== index);
    this.saveStep3ToLocalStorage();
  }

  esFechaEspecial(fecha: string): FechaEspecial | null {
    return this.fechasEspeciales.find((fe) => fe.fecha === fecha) || null;
  }

  // --- Fechas y periodos ---
  formatearFechaEspanol(fecha: string): string {
    moment.locale('es');
    return moment(fecha).format('DD [de] MMMM [de] YYYY');
  }

  generarFechasLaborables(fechaInicio: string, fechaFin: string): string[] {
    const inicio = moment(fechaInicio);
    const fin = moment(fechaFin);
    const fechasLaborables: string[] = [];
    const fechaActual = inicio.clone();
    while (fechaActual.isSameOrBefore(fin)) {
      if (fechaActual.day() !== 0 && fechaActual.day() !== 6) {
        fechasLaborables.push(fechaActual.format('YYYY-MM-DD'));
      }
      fechaActual.add(1, 'day');
    }
    return fechasLaborables;
  }

  calcularPeriodosReporte() {
    if (!this.config().startDate || !this.config().endDate) return;
    const fechaInicio = moment(this.config().startDate);
    const fechaFin = moment(this.config().endDate);
    const diaInicio = fechaInicio.date();
    this.reportePeriodos = [];
    let numeroReporte = 1;
    let fechaActual = fechaInicio.clone();

    if (diaInicio <= 10) {
      while (fechaActual.isBefore(fechaFin) || fechaActual.isSame(fechaFin)) {
        let periodoInicio: moment.Moment;
        let periodoFin: moment.Moment;
        if (numeroReporte === 1) {
          periodoInicio = fechaInicio.clone();
          periodoFin = fechaInicio.clone().endOf('month');
        } else {
          periodoInicio = fechaActual.clone().startOf('month');
          periodoFin = fechaActual.clone().endOf('month');
        }
        if (periodoFin.isAfter(fechaFin)) periodoFin = fechaFin.clone();
        if (numeroReporte === 7) periodoFin = fechaFin.clone();
        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD'),
        });
        if (numeroReporte >= 7) break;
        numeroReporte++;
        fechaActual = fechaActual.add(1, 'month').startOf('month');
      }
    } else {
      while (fechaActual.isBefore(fechaFin) || fechaActual.isSame(fechaFin)) {
        let periodoInicio: moment.Moment;
        let periodoFin: moment.Moment;
        if (numeroReporte === 1) {
          periodoInicio = fechaInicio.clone();
          periodoFin = fechaInicio.clone().add(1, 'month').date(15);
        } else {
          periodoInicio = fechaActual.clone().date(16);
          periodoFin = fechaActual.clone().add(1, 'month').date(15);
        }
        if (periodoFin.isAfter(fechaFin)) periodoFin = fechaFin.clone();
        if (numeroReporte === 7) periodoFin = fechaFin.clone();
        this.reportePeriodos.push({
          numero: numeroReporte,
          del: periodoInicio.format('YYYY-MM-DD'),
          al: periodoFin.format('YYYY-MM-DD'),
        });
        if (numeroReporte >= 7) break;
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

  calcularHorasPorDia(horaEntrada: string, horaSalida: string): string {
    if (!horaEntrada || !horaSalida) return '0';
    const entrada = moment(horaEntrada, 'HH:mm');
    const salida = moment(horaSalida, 'HH:mm');
    if (!entrada.isValid() || !salida.isValid()) return '0';
    const diferencia = salida.diff(entrada, 'hours', true);
    return Math.max(0, diferencia).toString();
  }

  // --- CSV ---
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
    if (lines.length < 2) return;
    let separador = '\t';
    if (lines.length > 1) {
      const primeraLineaDatos = lines[1].trim();
      if (primeraLineaDatos.includes(',') && !primeraLineaDatos.includes('\t')) {
        separador = ',';
      }
    }
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const partes = line.split(separador);
        if (partes.length >= 2) {
          const fecha = partes[0].trim();
          const tipoFecha = partes[1].trim();
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
    this.saveStep3ToLocalStorage();
    this.generateAllReports();
  }

  // --- Reportes ---
  generateAllReports() {
    const reportes: ReporteGenerado[] = [];
    const periodos = this.reportePeriodos.slice(0, 7);
    periodos.forEach((periodo, idx) => {
      const fechas = this.generarFechasLaborables(periodo.del, periodo.al);
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
    // Persistir paso 4
    try {
      this.saveStep4ToLocalStorage();
    } catch (e) { /* ignore */
    }
  }

  // --- Métodos para selección y descarga ---
  toggleReportSelection(id: string) {
    const set = new Set(this.selectedReports());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedReports.set(set);
  }

  toggleReportSelectionMonth(id: string) {
    const set = new Set(this.selectedReportsMonth());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedReportsMonth.set(set);
  }

  selectAllReports() {
    this.selectedReports.set(new Set(this.reports().map(r => r.id)));
  }

  selectAllReportsMonth() {
    this.selectedReportsMonth.set(new Set(this.reports().map(r => r.id)));
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

  async generateSingleReportPdf(report: ReporteGenerado) {
    try {
      const maxCamposDefault = 24;
      const usarTestPdf = report.asistencia.length > maxCamposDefault;
      const url = usarTestPdf
        ? 'assets/control-asistencia-test.pdf'
        : 'assets/control-asistencia.pdf';

      const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();

      //CustomFont para aceptar Ñ
      const customFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

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
          color: rgb(0, 0, 0),
          font: customFont
        });
      }

      if (this.config().cargoResponsableDirecto) {
        firstPage.drawText(`${this.config().cargoResponsableDirecto}`, {
          x: usarTestPdf ? 28 : 28,
          y: usarTestPdf ? 25 : 45,
          size: 12,
          color: rgb(0, 0, 0),
          font: customFont
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
            this.setTextWithAutoFontSize(form, campoFecha, this.formatearFechaEspanol(dia.fecha), customFont);
          }
          if (this.campoExiste(form, campoEntrada)) {
            this.setTextWithAutoFontSize(form, campoEntrada, dia.horaEntrada, customFont);
          }
          if (this.campoExiste(form, campoSalida)) {
            this.setTextWithAutoFontSize(form, campoSalida, dia.horaSalida, customFont);
          }
          if (this.campoExiste(form, campoHoras)) {
            this.setTextWithAutoFontSize(form, campoHoras, dia.horasPorDia, customFont);
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

  private setTextWithAutoFontSize(form: PDFForm, fieldName: string, text: string, customFont: PDFFont): void {
    if (this.campoExiste(form, fieldName)) {
      const field = form.getTextField(fieldName);

      // Obtener las dimensiones del campo
      const widgets = field.acroField.getWidgets();
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle();
        const fieldWidth = rect.width;
        const fieldHeight = rect.height;

        // Calcular el tamaño de fuente apropiado
        const fontSize = this.calculateOptimalFontSize(text, fieldWidth, fieldHeight);

        field.updateAppearances(customFont);
        field.setFontSize(fontSize);
        field.setText(text);
      } else {
        // Fallback si no se pueden obtener las dimensiones
        field.updateAppearances(customFont);
        field.setFontSize(10);
        field.setText(text);
      }
    }
  }

  private calculateOptimalFontSize(text: string, fieldWidth: number, fieldHeight: number): number {
    const maxFontSize = 14;
    const minFontSize = 9;

    // Aproximación del ancho de caracteres (varía según la fuente)
    const charWidthRatio = 0.6; // Para Helvetica aproximadamente

    // Calcular tamaño basado en el ancho
    let fontSize = (fieldWidth * 0.9) / (text.length * charWidthRatio);

    // Calcular tamaño basado en la altura (con margen)
    const maxFontSizeByHeight = fieldHeight * 0.7;

    // Tomar el menor de los dos límites
    fontSize = Math.min(fontSize, maxFontSizeByHeight);

    // Aplicar límites mínimos y máximos
    fontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));

    return Math.floor(fontSize);
  }

  async generateAllReportsPdf(reportType: 'single' | 'month' = 'single') {
    this.isGenerating.set(true);
    try {
      for (const report of this.reports()) {
        if (reportType === 'single') {
          await this.generateSingleReportPdf(report);
        } else {
          await this.generateSingleReportMonthPdf(report);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error generando PDFs:', error);
    } finally {
      this.isGenerating.set(false);
    }
  }

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

    //CustomFont para aceptar Ñ
    const customFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

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
        color: rgb(0, 0, 0),
        font: customFont
      });
    }

    if (this.config().cargoResponsableDirecto) {
      firstPage.drawText(`${this.config().cargoResponsableDirecto}`, {
        x: usarTestPdf ? 28 : 28,
        y: usarTestPdf ? 25 : 45,
        size: 12,
        color: rgb(0, 0, 0),
        font: customFont
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
          this.setTextWithAutoFontSize(form, campoFecha, this.formatearFechaEspanol(dia.fecha), customFont);
        }
        if (this.campoExiste(form, campoEntrada)) {
          this.setTextWithAutoFontSize(form, campoEntrada, dia.horaEntrada, customFont);
        }
        if (this.campoExiste(form, campoSalida)) {
          this.setTextWithAutoFontSize(form, campoSalida, dia.horaSalida, customFont);
        }
        if (this.campoExiste(form, campoHoras)) {
          this.setTextWithAutoFontSize(form, campoHoras, dia.horasPorDia, customFont);
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

  // --- Actualización de campos con guardado automático ---
  updateBoleta(value: string) {
    this.config.set({...this.config(), boleta: value});
    this.saveStep1ToLocalStorage();
  }

  updateNombrePrestador(value: string) {
    this.config.set({...this.config(), nombrePrestador: value});
    this.saveStep1ToLocalStorage();
  }

  updateUnidadAcademica(value: string) {
    this.config.set({...this.config(), unidadAcademica: value});
    this.saveStep1ToLocalStorage();
  }

  updateCarrera(value: string) {
    this.config.set({...this.config(), carrera: value});
    this.saveStep1ToLocalStorage();
  }

  updateStartDate(value: string) {
    this.config.set({...this.config(), startDate: value});
    this.saveStep1ToLocalStorage();
  }

  updateReportDateMonth(value: string) {
    this.config.set({...this.config(), reportDateMonth: value});
    this.saveStep1ToLocalStorage();
  }

  updateReportSemestre(value: string) {
    this.config.set({...this.config(), semestre: value});
    this.saveStep1ToLocalStorage();
  }

  updateReportprestatario(value: string) {
    this.config.set({...this.config(), prestatario: value});
    this.saveStep1ToLocalStorage();
  }

  updateEndDate(value: string) {
    this.config.set({...this.config(), endDate: value});
    this.saveStep1ToLocalStorage();
  }

  updateNombreResponsableDirecto(value: string) {
    this.config.set({...this.config(), nombreResponsableDirecto: value});
    this.saveStep1ToLocalStorage();
  }

  updateCargoResponsableDirecto(value: string) {
    this.config.set({...this.config(), cargoResponsableDirecto: value});
    this.saveStep1ToLocalStorage();
  }

  updateCorreo(value: string) {
    this.config.set({...this.config(), correo: value});
    this.saveStep1ToLocalStorage();
  }

  updateTelefono(value: string) {
    this.config.set({...this.config(), telefono: value});
    this.saveStep1ToLocalStorage();
  }

  updateResumeActivities(reportId: string, value: string) {
    const updatedReports = this.reports().map(report =>
      report.id === reportId
        ? {...report, resumeActivities: value}
        : report
    );
    this.reports.set(updatedReports);
  }

  obtenerInfo() {
    console.log(this.config());
  }

  // --- Métodos para localStorage ---
  private saveStep1ToLocalStorage() {
    const currentConfig = this.config();
    const step1Data = {
      boleta: currentConfig.boleta,
      nombrePrestador: currentConfig.nombrePrestador,
      unidadAcademica: currentConfig.unidadAcademica,
      carrera: currentConfig.carrera,
      startDate: currentConfig.startDate,
      endDate: currentConfig.endDate,
      nombreResponsableDirecto: currentConfig.nombreResponsableDirecto,
      cargoResponsableDirecto: currentConfig.cargoResponsableDirecto,
      correo: currentConfig.correo,
      telefono: currentConfig.telefono,
      reportDateMonth: currentConfig.reportDateMonth,
      semestre: currentConfig.semestre,
      prestatario: currentConfig.prestatario
    };

    try {
      localStorage.setItem('reportes-ss-step1', JSON.stringify(step1Data));
    } catch (error) {
      console.warn('Error guardando datos en localStorage:', error);
    }
  }

  private loadStep1FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-ss-step1');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Combinar datos guardados con la configuración actual
        this.config.set({
          ...this.config(),
          ...parsedData
        });
      }
    } catch (error) {
      console.warn('Error cargando datos de localStorage:', error);
    }
  }

  // Paso 2: Horarios
  private saveStep2ToLocalStorage() {
    const step2Data = {
      horariosServicio: this.horariosServicio,
      syncHorarios: this.syncHorarios
    };

    try {
      localStorage.setItem('reportes-ss-step2', JSON.stringify(step2Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 2 en localStorage:', error);
    }
  }

  private loadStep2FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-ss-step2');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.horariosServicio && Array.isArray(parsedData.horariosServicio)) {
          this.horariosServicio = parsedData.horariosServicio;
        }
        if (parsedData.syncHorarios !== undefined) {
          this.syncHorarios = parsedData.syncHorarios;
        }
      }
    } catch (error) {
      console.warn('Error cargando datos del paso 2 de localStorage:', error);
    }
  }

  // Paso 3: Fechas especiales
  private saveStep3ToLocalStorage() {
    const step3Data = {
      fechasEspeciales: this.fechasEspeciales
    };

    try {
      localStorage.setItem('reportes-ss-step3', JSON.stringify(step3Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 3 en localStorage:', error);
    }
  }

  private loadStep3FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-ss-step3');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.fechasEspeciales && Array.isArray(parsedData.fechasEspeciales)) {
          this.fechasEspeciales = parsedData.fechasEspeciales;
        }
      }
    } catch (error) {
      console.warn('Error cargando datos del paso 3 de localStorage:', error);
    }
  }


  private loadStep4FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-ss-step4');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.reports && Array.isArray(parsedData.reports)) {
          this.reports.set(parsedData.reports);
        }
        if (parsedData.selectedReports && Array.isArray(parsedData.selectedReports)) {
          this.selectedReports.set(new Set(parsedData.selectedReports));
        }
      }
    } catch (error) {
      console.warn('Error cargando datos del paso 4 de localStorage:', error);
    }
  }

  // Paso 5: Reportes mensuales
  private saveStep5ToLocalStorage() {
    const step5Data = {
      selectedReportsMonth: Array.from(this.selectedReportsMonth()),
      reportActivities: this.reports().map(report => ({
        id: report.id,
        resumeActivities: report.resumeActivities
      })),
      // Guardar estado y actividades creadas con IA
      iaActivities: this.iaActivities(),
      iaEditorOpen: this.iaEditorOpen()
    };

    try {
      localStorage.setItem('reportes-ss-step5', JSON.stringify(step5Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 5 en localStorage:', error);
    }
  }

  private loadStep5FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-ss-step5');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.selectedReportsMonth && Array.isArray(parsedData.selectedReportsMonth)) {
          this.selectedReportsMonth.set(new Set(parsedData.selectedReportsMonth));
        }
        if (parsedData.reportActivities && Array.isArray(parsedData.reportActivities)) {
          const currentReports = this.reports();
          const updatedReports = currentReports.map(report => {
            const savedActivity = parsedData.reportActivities.find((activity: any) => activity.id === report.id);
            return savedActivity ? {...report, resumeActivities: savedActivity.resumeActivities} : report;
          });
          this.reports.set(updatedReports);
        }

        // Restaurar actividades y estado del editor IA si existen
        if (parsedData.iaActivities && typeof parsedData.iaActivities === 'object') {
          try {
            this.iaActivities.set(parsedData.iaActivities);
          } catch (e) {
            // ignore malformed data
          }
        }
        if (parsedData.iaEditorOpen && typeof parsedData.iaEditorOpen === 'object') {
          try {
            this.iaEditorOpen.set(parsedData.iaEditorOpen);
          } catch (e) {
            // ignore malformed data
          }
        }
      }
    } catch (error) {
      console.warn('Error cargando datos del paso 5 de localStorage:', error);
    }
  }

  // --- Nuevo método para guardar datos del paso actual ---
  private saveCurrentStepData() {
    switch (this.currentStep()) {
      case 1:
        this.saveStep1ToLocalStorage();
        break;
      case 2:
        this.saveStep2ToLocalStorage();
        break;
      case 3:
        this.saveStep3ToLocalStorage();
        break;
    }
  }

  // --- Nuevos métodos para guardar pasos 4 y 5 ---
  private saveStep4ToLocalStorage() {
    const step4Data = {
      reports: this.reports(),
      selectedReports: Array.from(this.selectedReports())
    };

    try {
      localStorage.setItem('reportes-ss-step4', JSON.stringify(step4Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 4 en localStorage:', error);
    }
  }

  // Método público para limpiar datos guardados si es necesario
  clearSavedData() {
    try {
      localStorage.removeItem('reportes-ss-step1');
      localStorage.removeItem('reportes-ss-step2');
      localStorage.removeItem('reportes-ss-step3');
      // Resetear a los valores por defecto
      this.config.set(config);
      this.horariosServicio = [
        {day: 'monday', entrada: '07:00', salida: '11:00'},
        {day: 'tuesday', entrada: '12:00', salida: '16:00'},
        {day: 'wednesday', entrada: '10:00', salida: '14:00'},
        {day: 'thursday', entrada: '07:00', salida: '11:00'},
        {day: 'friday', entrada: '16:00', salida: '20:00'},
      ];
      this.fechasEspeciales = [];
      this.syncHorarios = false;
      this.reports.set([]);
      this.selectedReports.set(new Set());
      this.selectedReportsMonth.set(new Set());
    } catch (error) {
      console.warn('Error limpiando datos de localStorage:', error);
    }
  }

  campoExiste(form: any, nombreCampo: string): boolean {
    try {
      form.getField(nombreCampo);
      return true;
    } catch {
      return false;
    }
  }

  autocompletarResumenIA(reportId: string) {
    // Abrir el editor IA para el reporte y inicializar la lista de actividades
    try {
      const openState = {...this.iaEditorOpen()};
      openState[reportId] = true;
      this.iaEditorOpen.set(openState);

      const activitiesState = {...this.iaActivities()};
      // Si ya tenemos actividades cargadas, no sobreescribir; sino inicializar con una línea vacía
      if (!activitiesState[reportId] || activitiesState[reportId].length === 0) {
        // Si ya existe resumeActivities en el reporte, usarlo para inicializar
        const rpt = this.reports().find(r => r.id === reportId);
        if (rpt && rpt.resumeActivities && rpt.resumeActivities.trim()) {
          activitiesState[reportId] = rpt.resumeActivities.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        } else {
          activitiesState[reportId] = [''];
        }
        this.iaActivities.set(activitiesState);
      }

      // Persistir inmediatamente que se abrió el editor IA y las actividades iniciales
      try {
        this.saveStep5ToLocalStorage();
      } catch (e) { /* ignore */
      }
    } catch (e) {
      console.error('Error abriendo editor IA:', e);
    }
  }

  addActivity(reportId: string) {
    const activitiesState = {...this.iaActivities()};
    const list = activitiesState[reportId] ? [...activitiesState[reportId]] : [];
    list.push('');
    activitiesState[reportId] = list;
    this.iaActivities.set(activitiesState);
    // Persistir cambio
    try {
      this.saveStep5ToLocalStorage();
    } catch (e) { /* ignore */
    }
  }

  removeActivity(reportId: string, index: number) {
    const activitiesState = {...this.iaActivities()};
    const list = activitiesState[reportId] ? [...activitiesState[reportId]] : [];
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
      activitiesState[reportId] = list;
      this.iaActivities.set(activitiesState);
      // Persistir cambio
      try {
        this.saveStep5ToLocalStorage();
      } catch (e) { /* ignore */
      }
    }
  }

  updateActivity(reportId: string, index: number, value: string) {
    const activitiesState = {...this.iaActivities()};
    const list = activitiesState[reportId] ? [...activitiesState[reportId]] : [];
    if (index >= 0) {
      list[index] = value;
      activitiesState[reportId] = list;
      this.iaActivities.set(activitiesState);
      // Persistir cambio
      try {
        this.saveStep5ToLocalStorage();
      } catch (e) { /* ignore */
      }
    }
  }

  applyActivities(reportId: string) {
    this.isLoading.set(true);
    const activities = this.iaActivities()[reportId] || [];
    const reportRequest: ReportRequest = {
      actividades: activities ?? []
    }
    this._reportsService.crearReporteReportsPost(reportRequest).subscribe({
      next: (response) => {
        const updated = this.reports().map(r => {
          if (r.id === reportId) {
            return {...r, resumeActivities: response.report};
          }
          return r;
        });
        this.isLoading.set(false);
        this.reports.set(updated);
        const openState = {...this.iaEditorOpen()};
        openState[reportId] = false;
        this.iaEditorOpen.set(openState);
      },
      error: (error) => {
        console.error('Error aplicando actividades:', error);
        this.isLoading.set(false);
      }
    })

    try {
      this.saveStep5ToLocalStorage();
    } catch (e) {
    }
  }

  cancelIAEditor(reportId: string) {
    try {
      const openState = {...this.iaEditorOpen()};
      openState[reportId] = false;
      this.iaEditorOpen.set(openState);
    } catch (e) {
      console.error('Error cerrando editor IA:', e);
    }
  }

  obtenerMaximoCamposDisponibles(form: any): number {
    let maxCampos = 0;
    for (let i = 1; i <= 50; i++) {
      if (this.campoExiste(form, `Fecha${i}`)) {
        maxCampos = i;
      } else {
        break;
      }
    }
    return maxCampos;
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
