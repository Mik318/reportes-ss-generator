import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
  },
  {
    path: 'configuracion-practicas',
    loadComponent: () =>
      import('./pages/configuracion-practicas/configuracion-practicas').then(
        (m) => m.ConfiguracionPracticas,
      ),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
