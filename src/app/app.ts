import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavBar} from './shared/components/nav-bar/nav-bar';
import {Auth} from './shared/services/auth';
import { SessionManagerService } from './shared/services/session-manager.service';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('reportes-ss-generator');
  isLoggedIn = signal(false);
  constructor(private auth: Auth, private sessionManager: SessionManagerService, private authService: AuthService) {
    this.isLoggedIn = this.auth.isLoggedIn;
    // Iniciar manager de sesión para limpiar localStorage cuando se cierren todas las pestañas
    try { this.sessionManager.init(); } catch (e) { /* ignore */ }

    // Intentar restaurar sesión al inicio (por ejemplo al hacer F5)
    try {
      const refreshToken = (typeof window !== 'undefined') ? localStorage.getItem('refresh_token') : null;
      if (refreshToken) {
        // Intentar refrescar usando el refresh token
        this.authService.refreshAccessToken().then((resp) => {
          if (resp && resp.access_token) {
            this.auth.setLoggedIn(true);
          } else {
            // no se pudo refrescar -> comprobar si el usuario había entrado como guest
            try {
              const guest = (typeof window !== 'undefined') ? sessionStorage.getItem('guest') : null;
              if (guest === 'true') {
                this.auth.setGuest(true);
                this.auth.setLoggedIn(true);
              }
            } catch (e) {}
          }
        }).catch(() => {
          try {
            const guest = (typeof window !== 'undefined') ? sessionStorage.getItem('guest') : null;
            if (guest === 'true') {
              this.auth.setGuest(true);
              this.auth.setLoggedIn(true);
            }
          } catch (e) {}
        }).finally(() => {
          // indicar que la comprobación inicial ha terminado
          try { this.auth.setReady(true); } catch (e) {}
        });
      } else {
        // No hay refresh token -> revisar si se habilitó 'Continuar sin registrarse' en esta pestaña
        try {
          const guest = (typeof window !== 'undefined') ? sessionStorage.getItem('guest') : null;
          if (guest === 'true') {
            this.auth.setGuest(true);
            this.auth.setLoggedIn(true);
          }
        } catch (e) {}
        // indicar que la comprobación inicial ha terminado
        try { this.auth.setReady(true); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }


}
