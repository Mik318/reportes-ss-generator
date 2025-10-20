import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login')
      .then(m => m.Login)
  },
  {
    path: 'login/callback',
    loadComponent: () => import('./pages/login-from-email/login-from-email')
      .then(m => m.LoginFromEmail)
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
    redirectTo: 'login'
  }
];
