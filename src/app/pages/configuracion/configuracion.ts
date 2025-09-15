import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';

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
  config: ReportConfig = {
    startDate: '',
    endDate: '',
    unavailableDates: [],
    vacationDates: [],
    reportType: 'mensual',
    department: 'general',
    includeStatistics: true,
  };

  newUnavailableDate = '';
  newVacationDate = '';
  showPreview = false;

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

  generateReport() {
    this.showPreview = true;
  }

}
