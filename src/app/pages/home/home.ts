import {Component, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AutenticacionService} from '../../../libs/republica-cafe-management';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit{

  constructor(
    private autenticacionService: AutenticacionService
  ) {}


  ngOnInit() {
    this.autenticacionService.getTokenAuthGetTokenGet(
      'lokilskdij@gmail.com',
      'Passw0rd!'
    ).subscribe(
      (response) => {
        console.log(response);
      }
    )
  }

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
