import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  recentActivity = [
    {
      title: 'Reporte Mensual - Enero 2025',
      timeAgo: 'Hace 2 horas',
      isLast: false
    },
    {
      title: 'Reporte Semanal - Semana 3',
      timeAgo: 'Hace 1 día',
      isLast: false
    },
    {
      title: 'Reporte Trimestral - Q4 2024',
      timeAgo: 'Hace 3 días',
      isLast: true
    }
  ];

}
