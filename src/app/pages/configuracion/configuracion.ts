import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PDFDocument, rgb, StandardFonts} from 'pdf-lib';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface ReportConfig {
  startDate: string;
  endDate: string;
  unavailableDates: string[];
  vacationDates: string[];
  reportType: string;
  department: string;
  includeStatistics: boolean;
}

@Component({
  selector: 'app-configuracion',
  imports: [
    FormsModule
  ],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss'
})
export class Configuracion {
  config: ReportConfig = config;

  newUnavailableDate = '';
  newVacationDate = '';
  showPreview = false;
  pdfUrl: SafeResourceUrl | undefined; // Variable para la URL del PDF
  formFields: string[] = []; // Nueva propiedad para almacenar los campos

  constructor(private sanitizer: DomSanitizer) {}

  addUnavailableDate() {
    if (this.newUnavailableDate && !this.config.unavailableDates.includes(this.newUnavailableDate)) {
      this.config.unavailableDates.push(this.newUnavailableDate);
      this.newUnavailableDate = '';
    }
  }

  addVacationDate() {
    if (this.newVacationDate && !this.config.vacationDates.includes(this.newVacationDate)) {
      this.config.vacationDates.push(this.newVacationDate);
      this.newVacationDate = '';
    }
  }

  removeDate(date: string, type: 'unavailable' | 'vacation') {
    if (type === 'unavailable') {
      this.config.unavailableDates = this.config.unavailableDates.filter(d => d !== date);
    } else {
      this.config.vacationDates = this.config.vacationDates.filter(d => d !== date);
    }
  }

  async generateReport() {
    // this.listFormFields();
    const url = 'assets/control-asistencia.pdf';
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Información del Prestador y el Reporte
    form.getTextField('Correspondiente al reporte mensual de actividades No').setText('1');
    // form.getTextField('UnidadAcademica').setText(this.config.unidadAcademica);
    // form.getTextField('Carrera').setText(this.config.carrera);
    // form.getTextField('Boleta').setText(this.config.boleta);
    // form.getTextField('NoReporteMensual').setText(this.config.noReporteMensual);
    // form.getTextField('PeriodoDel').setText(this.config.periodoDel);
    // form.getTextField('PeriodoAl').setText(this.config.periodoAl);
    //
    // // Campos de la Tabla de Asistencia (ejemplo para 5 días)
    // this.config.asistencia.forEach((dia, i) => {
    //   form.getTextField(`Fecha${i+1}`).setText(dia.fecha);
    //   form.getTextField(`HoraEntrada${i+1}`).setText(dia.horaEntrada);
    //   form.getTextField(`HoraSalida${i+1}`).setText(dia.horaSalida);
    //   form.getTextField(`HorasPorDia${i+1}`).setText(dia.horasPorDia);
    // });
    //
    // // Totales
    // form.getTextField('TotalHorasMes').setText(this.config.totalHorasMes);
    // form.getTextField('TotalHorasAcumuladas').setText(this.config.totalHorasAcumuladas);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
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

}


export interface AsistenciaDia {
  fecha: string;
  horaEntrada: string;
  horaSalida: string;
  horasPorDia: string;
}

export interface ReportConfig {
  startDate: string;
  endDate: string;
  unavailableDates: string[];
  vacationDates: string[];
  reportType: string;
  department: string;
  includeStatistics: boolean;

  // Nuevos campos
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

  nombrePrestador: 'Juan Pérez',
  unidadAcademica: 'Facultad de Ciencias',
  carrera: 'Ingeniería en Sistemas',
  boleta: '2020123456',
  noReporteMensual: '1',
  periodoDel: '2024-06-01',
  periodoAl: '2024-06-30',
  asistencia: [
    { fecha: '2024-06-01', horaEntrada: '08:00', horaSalida: '14:00', horasPorDia: '6' },
    { fecha: '2024-06-02', horaEntrada: '08:00', horaSalida: '14:00', horasPorDia: '6' },
    { fecha: '2024-06-03', horaEntrada: '08:00', horaSalida: '14:00', horasPorDia: '6' },
    { fecha: '2024-06-04', horaEntrada: '08:00', horaSalida: '14:00', horasPorDia: '6' },
    { fecha: '2024-06-05', horaEntrada: '08:00', horaSalida: '14:00', horasPorDia: '6' },
  ],
  totalHorasMes: '30',
  totalHorasAcumuladas: '120',
};
