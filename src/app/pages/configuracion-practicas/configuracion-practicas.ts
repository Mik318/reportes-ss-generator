import { Component, computed, LOCALE_ID, model, signal } from '@angular/core';
import { PDFDocument, StandardFonts, PDFImage } from 'pdf-lib';

import { FormsModule } from '@angular/forms';
import { StepIndicator } from '../../shared/components/step-indicator/step-indicator';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import localeEs from '@angular/common/locales/es';
import { NgClass, registerLocaleData } from '@angular/common';
import moment from 'moment';
import 'moment/locale/es';
import JSZip from 'jszip';
import { PDF_COORDINATES } from './configuracion-practicas.constants';

// Registrar el locale español
registerLocaleData(localeEs);
moment.locale('es');

export interface ReportConfig {
  startDate: string;
  endDate: string;
  unavailableDates: string[];
  vacationDates: string[];
  nombreAlumno: string;
  carrera: string;
  boleta: string;
  periodoDel: string;
  periodoAl: string;
  nombreResponsableDirecto: string;
  cargoResponsableDirecto: string;
  correo: string;
  reportDateMonth: string;
  prestatario: string;
  asistencia: AsistenciaDia[];
  totalHorasMes: string;
  totalHorasAcumuladas: string;
  reporteActual: number;
  signatureImage: string | null;
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
  salida: string;
}

interface ReporteGenerado {
  id: string;
  period: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    startDay: string;
    startMonth: string;
    startYear: string;
    endDay: string;
    endMonth: string;
    endYear: string;
    monthName: string;
  };
  student: {
    name: string;
    career: string;
    correo: string;
  };
  leadPersonal: {
    name: string;
    position: string;
  };
  specialDates: FechaEspecial[];
  asistencia: AsistenciaDia[];
  reportDateMonth: string;
  pdfUrl?: SafeResourceUrl;
  pdfMonthUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-configuracion-practicas',
  imports: [FormsModule, StepIndicator, NgClass],
  providers: [{ provide: LOCALE_ID, useValue: 'es' }],
  templateUrl: './configuracion-practicas.html',
  styleUrl: './configuracion-practicas.css',
})
export class ConfiguracionPracticas {
  currentStep = signal(1);
  config = signal<ReportConfig>(config);
  newDate = model<FechaEspecial>({ fecha: '', tipoFecha: '' });

  reportePeriodos: { numero: number; del: string; al: string }[] = [];
  fechasLaborables: string[] = [];
  fechasEspeciales: FechaEspecial[] = [];
  csvFile: File | null = null;
  syncHorarios: boolean = false;
  stepTitles = [
    'Información',
    'Horarios',
    'Fechas',
    'Previsualizar reportes de asistencia',
    'Previsualizar reportes mensuales',
  ];
  totalSteps = 5;

  horariosServicio: hosrariosServicio[] = [
    { day: 'monday', entrada: '07:00', salida: '11:00' },
    { day: 'tuesday', entrada: '12:00', salida: '16:00' },
    { day: 'wednesday', entrada: '10:00', salida: '14:00' },
    { day: 'thursday', entrada: '07:00', salida: '11:00' },
    { day: 'friday', entrada: '16:00', salida: '20:00' },
  ];

  days: daysOfWeek[] = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
  ];

  pdfUrl: SafeResourceUrl | null = null;

  reports = signal<ReporteGenerado[]>([]);
  selectedReports = signal<Set<string>>(new Set());
  isGenerating = signal(false);
  signatureImage = signal<string | null>(null);

  constructor(private sanitizer: DomSanitizer) {
    // Cargar datos guardados de todos los pasos al inicializar
    this.loadStep1FromLocalStorage();
    this.loadStep2FromLocalStorage();
    this.loadStep3FromLocalStorage();
  }

  // --- Validaciones y navegación ---
  canProceed = computed(() => {
    switch (this.currentStep()) {
      case 1:
        const s = this.config();
        return !!(
          s.boleta?.trim() &&
          s.nombreAlumno?.trim() &&
          s.carrera?.trim() &&
          s.startDate?.trim() &&
          s.endDate?.trim()
        );
      case 2:
        return this.horariosServicio.every((day) => day.entrada?.trim() && day.salida?.trim());
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
    const idx = this.days.findIndex((d) => d.key === day);
    if (idx !== -1) {
      this.horariosServicio[idx][field] = value;
      this.saveStep2ToLocalStorage();
    }
  }

  applyToAllDays(type: 'entrada' | 'salida') {
    const referenceTime = this.horariosServicio[0][type];
    if (!referenceTime) return;
    this.horariosServicio.forEach((horario) => {
      horario[type] = referenceTime;
    });
    this.saveStep2ToLocalStorage();
  }

  // --- Fechas especiales ---
  addSpecialDate() {
    if (this.newDate().fecha && this.newDate().tipoFecha) {
      const exists = this.config().asistencia.some((dia) => dia.fecha === this.newDate().fecha);
      if (exists) {
        alert('La fecha ya existe en la lista de asistencia.');
        return;
      }
      const specialDateExists = this.fechasEspeciales.some(
        (dia) => dia.fecha === this.newDate().fecha,
      );
      if (specialDateExists) {
        alert('La fecha ya existe en la lista de fechas especiales.');
        return;
      }
      this.fechasEspeciales.push({ ...this.newDate() });
      this.newDate.set({ fecha: '', tipoFecha: '' });
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

  removeSignature(): void {
    this.updateReporteState({ signatureImage: null });
    this.generateAllReportsPdf();
  }

  // --- Fechas y periodos ---
  onSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.updateReporteState({ signatureImage: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  }

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
      const specialDatesPeriodo = this.fechasEspeciales.filter(
        (fe) =>
          moment(fe.fecha).isSameOrAfter(periodo.del) &&
          moment(fe.fecha).isSameOrBefore(periodo.al),
      );
      const asistencia = fechas.map((fecha) => {
        const fechaEspecial = specialDatesPeriodo.find((fe) => fe.fecha === fecha);
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
        .filter((a) => a.horasPorDia === '0')
        .map((a) => ({
          fecha: a.fecha,
          tipoFecha: a.horaEntrada,
        }));

      const startDateMoment = moment(periodo.del);
      const endDateMoment = moment(periodo.al);
      const monthName = startDateMoment.format('MMMM');

      reportes.push({
        id: `reporte-${idx + 1}`,
        period: {
          weekNumber: idx + 1,
          startDate: this.formatearFechaEspanol(periodo.del),
          endDate: this.formatearFechaEspanol(periodo.al),
          startDay: startDateMoment.format('DD'),
          startMonth: startDateMoment.format('MM'),
          startYear: startDateMoment.format('YY'),
          endDay: endDateMoment.format('DD'),
          endMonth: endDateMoment.format('MM'),
          endYear: endDateMoment.format('YY'),
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        },
        student: {
          name: this.config().nombreAlumno,
          career: this.config().carrera,
          correo: this.config().correo,
        },
        leadPersonal: {
          name: this.config().nombreResponsableDirecto,
          position: this.config().cargoResponsableDirecto,
        },
        specialDates: specialDatesEnAsistencia,
        reportDateMonth: this.formatearFechaEspanol(this.config().reportDateMonth),
        asistencia,
      });
    });
    this.reports.set(reportes);
    this.selectedReports.set(new Set());
  }

  // --- Métodos para selección y descarga ---
  toggleReportSelection(id: string) {
    const set = new Set(this.selectedReports());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedReports.set(set);
  }

  selectAllReports() {
    this.selectedReports.set(new Set(this.reports().map((r) => r.id)));
  }

  deselectAllReports() {
    this.selectedReports.set(new Set());
  }

  previewReport(report: ReporteGenerado) {
    this.config.set({
      ...this.config(),
      periodoDel: report.period.startDate,
      periodoAl: report.period.endDate,
      asistencia: report.asistencia,
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
      const reportesSeleccionados = this.reports().filter((report) =>
        this.selectedReports().has(report.id),
      );
      for (const report of reportesSeleccionados) {
        try {
          const pdfBytes = await this.generateReportPdfBytes(report);
          const fileName = `Reporte_${report.period.weekNumber}_${this.config().nombreAlumno.replace(/\s+/g, '_')}.pdf`;
          zip.file(fileName, pdfBytes);
        } catch (error) {
          console.error(`Error generando PDF para reporte ${report.period.weekNumber}:`, error);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reportes_PracticasProfesionales_${this.config().nombreAlumno.replace(/\s+/g, '_')}.zip`;
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
      const pdfDoc = await this.fillPdf(report);
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const urlBlob = URL.createObjectURL(blob);

      // Update the report with the new URL
      const reportes = this.reports();
      const updatedReportes = reportes.map((r) =>
        r.id === report.id
          ? { ...r, pdfUrl: this.sanitizer.bypassSecurityTrustResourceUrl(urlBlob) }
          : r,
      );
      this.reports.set(updatedReportes);
    } catch (error) {
      console.error('Error generating PDF del reporte:', error);
    }
  }

  async generateAllReportsPdf() {
    this.isGenerating.set(true);
    try {
      for (const report of this.reports()) {
        await this.generateSingleReportPdf(report);
        await new Promise((resolve) => setTimeout(resolve, 100));
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
      const reporte = this.reports().find((r) => r.period.weekNumber === i);
      if (reporte) {
        const horasReporte = reporte.asistencia
          .filter((dia) => dia.horasPorDia !== '0')
          .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);
        acumulado += horasReporte;
      }
    }
    return acumulado;
  }

  private async fillPdf(report: ReporteGenerado): Promise<PDFDocument> {
    const existingPdfBytes = await fetch('assets/hojas-de-asistencia.pdf').then((res) =>
      res.arrayBuffer(),
    );
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let embeddedSignature: PDFImage | undefined;
    if (this.config().signatureImage) {
      const signatureBytes = this.config().signatureImage as string;
      if (signatureBytes.startsWith('data:image/png')) {
        embeddedSignature = await pdfDoc.embedPng(signatureBytes);
      } else if (signatureBytes.startsWith('data:image/jpeg')) {
        embeddedSignature = await pdfDoc.embedJpg(signatureBytes);
      }
    }

    const pages = pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];

    // --- Calculate Hours ---
    const horasMes = report.asistencia
      .filter((dia) => dia.horasPorDia !== '0')
      .reduce((total, dia) => total + parseFloat(dia.horasPorDia), 0);
    const horasAcumuladas = this.calcularHorasAcumuladasHasta(report.period.weekNumber);

    // --- Fill Page 1 ---
    const p1c = PDF_COORDINATES.page1;
    page1.drawText(report.period.startDay, { ...p1c.startDay, font });
    page1.drawText(report.period.startMonth, { ...p1c.startMonth, font });
    page1.drawText(report.period.startYear, { ...p1c.startYear, font });
    page1.drawText(report.period.endDay, { ...p1c.endDay, font });
    page1.drawText(report.period.endMonth, { ...p1c.endMonth, font });
    page1.drawText(report.period.endYear, { ...p1c.endYear, font });
    page1.drawText(report.student.name, { ...p1c.studentName, font, size: 12 });
    page1.drawText(this.config().boleta, { ...p1c.boleta, font, size: 12 });
    page1.drawText(report.student.career, { ...p1c.carrera, font, size: 12 });
    page1.drawText(report.student.correo, { ...p1c.email, font, size: 12 });

    const nombreX = this.getNombreResponsableX(report.leadPersonal.name);
    page1.drawText(report.leadPersonal.name, {
      ...p1c.nombreResponsable,
      x: nombreX,
      font,
      size: 12,
    });

    const puestoX = this.getPuestoResponsableX(report.leadPersonal.position);
    page1.drawText(report.leadPersonal.position, {
      ...p1c.puestoResponsable,
      x: puestoX,
      font,
      size: 12,
    });

    page1.drawText(moment(this.config().reportDateMonth).format('DD/MM/YYYY'), {
      ...p1c.fechaEntrega,
      font,
      size: 12,
    });

    // --- Fill Page 2 ---
    const p2c = PDF_COORDINATES.page2;
    page2.drawText(report.student.name, { ...p2c.studentName, font });
    page2.drawText(report.period.monthName, { ...p2c.month, font });
    page2.drawText(horasMes.toString(), { ...p2c.totalHoras, font });
    page2.drawText(horasAcumuladas.toString(), { ...p2c.totalHorasAcumuladas, font });

    // --- Fill Page 2 Table (Text & Signature) ---
    if (embeddedSignature) {
      const sigBoxWidth = 65;
      const sigBoxHeight = 27;
      const scaled = this.scaleToFit(
        embeddedSignature.width,
        embeddedSignature.height,
        sigBoxWidth,
        sigBoxHeight,
      );
      let workingDayIndex = 0;

      report.asistencia.forEach((dia) => {
        if (dia.horasPorDia !== '0') {
          const signatureX = 420;
          const firstRowY = 576;
          const signatureY = firstRowY - workingDayIndex * p2c.table.rowStep;
          page2.drawImage(embeddedSignature, {
            x: signatureX,
            y: signatureY,
            width: scaled.width,
            height: scaled.height,
          });
          workingDayIndex++;
        }
      });
    }

    report.asistencia.forEach((dia, index) => {
      if (dia.horasPorDia !== '0') {
        const y = p2c.table.startY - index * p2c.table.rowStep;
        page2.drawText(moment(dia.fecha).format('DD/MM/YY'), {
          x: p2c.table.columns.fecha.x,
          y,
          size: p2c.table.fontSize,
          font,
        });
        page2.drawText(dia.horaEntrada, {
          x: p2c.table.columns.horaEntrada.x,
          y,
          size: p2c.table.fontSize,
          font,
        });
        page2.drawText(dia.horaSalida, {
          x: p2c.table.columns.horaSalida.x,
          y,
          size: p2c.table.fontSize,
          font,
        });
        page2.drawText(dia.horasPorDia, {
          x: p2c.table.columns.horasPorDia.x,
          y,
          size: p2c.table.fontSize,
          font,
        });
      }
    });

    return pdfDoc;
  }

  private scaleToFit(srcWidth: number, srcHeight: number, maxWidth: number, maxHeight: number) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return { width: srcWidth * ratio, height: srcHeight * ratio };
  }

  private getNombreResponsableX(name: string): number {
    if (name.length > 25) {
      return 90;
    } else if (name.length > 20) {
      return 110;
    } else if (name.length > 15) {
      return 120;
    } else {
      return 130;
    }
  }

  private getPuestoResponsableX(position: string): number {
    if (position.length >= 35) {
      return 320;
    } else {
      return 350;
    }
  }

  private async generateReportPdfBytes(report: ReporteGenerado): Promise<Uint8Array> {
    const pdfDoc = await this.fillPdf(report);
    const pdfBytes = await pdfDoc.save();
    return new Uint8Array(pdfBytes);
  }

  // --- Actualización de campos con guardado automático ---
  updateReporteState(updates: Partial<ReportConfig>) {
    this.config.set({ ...this.config(), ...updates });
    this.saveStep1ToLocalStorage();
  }

  updateResumeActivities(reportId: string, value: string) {
    const updatedReports = this.reports().map((report) =>
      report.id === reportId ? { ...report, resumeActivities: value } : report,
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
      nombreAlumno: currentConfig.nombreAlumno,
      boleta: currentConfig.boleta,
      carrera: currentConfig.carrera,
      startDate: currentConfig.startDate,
      endDate: currentConfig.endDate,
      nombreResponsableDirecto: currentConfig.nombreResponsableDirecto,
      cargoResponsableDirecto: currentConfig.cargoResponsableDirecto,
      correo: currentConfig.correo,
      reportDateMonth: currentConfig.reportDateMonth,
      prestatario: currentConfig.prestatario,
    };

    try {
      localStorage.setItem('reportes-pp-step1', JSON.stringify(step1Data));
    } catch (error) {
      console.warn('Error guardando datos en localStorage:', error);
    }
  }

  private loadStep1FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-pp-step1');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Combinar datos guardados con la configuración actual
        this.config.set({
          ...this.config(),
          ...parsedData,
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
      syncHorarios: this.syncHorarios,
    };

    try {
      localStorage.setItem('reportes-pp-step2', JSON.stringify(step2Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 2 en localStorage:', error);
    }
  }

  private loadStep2FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-pp-step2');
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
      fechasEspeciales: this.fechasEspeciales,
    };

    try {
      localStorage.setItem('reportes-pp-step3', JSON.stringify(step3Data));
    } catch (error) {
      console.warn('Error guardando datos del paso 3 en localStorage:', error);
    }
  }

  private loadStep3FromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reportes-pp-step3');
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

  // Método público para limpiar datos guardados si es necesario
  clearSavedData() {
    try {
      localStorage.removeItem('reportes-pp-step1');
      localStorage.removeItem('reportes-pp-step2');
      localStorage.removeItem('reportes-pp-step3');
      // Resetear a los valores por defecto
      this.config.set(config);
      this.horariosServicio = [
        { day: 'monday', entrada: '07:00', salida: '11:00' },
        { day: 'tuesday', entrada: '12:00', salida: '16:00' },
        { day: 'wednesday', entrada: '10:00', salida: '14:00' },
        { day: 'thursday', entrada: '07:00', salida: '11:00' },
        { day: 'friday', entrada: '16:00', salida: '20:00' },
      ];
      this.fechasEspeciales = [];
      this.syncHorarios = false;
      this.reports.set([]);
      this.selectedReports.set(new Set());
    } catch (error) {
      console.warn('Error limpiando datos de localStorage:', error);
    }
  }

  // --- Utilidades ---
  campoExiste(form: any, nombreCampo: string): boolean {
    try {
      form.getField(nombreCampo);
      return true;
    } catch {
      return false;
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
  nombreAlumno: '',
  cargoResponsableDirecto: '',
  nombreResponsableDirecto: '',
  carrera: '',
  boleta: '',
  periodoDel: '',
  periodoAl: '',
  correo: '',
  reportDateMonth: '',
  prestatario: '',
  reporteActual: 0,
  asistencia: [],
  totalHorasMes: '',
  totalHorasAcumuladas: '',
  signatureImage: null,
};
