import {Injectable, signal} from '@angular/core';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  // Inicializa la señal con el token en memoria si existe
  isLoggedIn = signal(false);
  isGuest = signal(false);
  isReady = signal(false);

  constructor(private tokenService: TokenService) {
    try {
      const has = !!this.tokenService.get();
      this.isLoggedIn.set(has);
      // Restaurar guest desde sessionStorage para recargas en la misma pestaña
      try {
        const g = (typeof window !== 'undefined') ? sessionStorage.getItem('guest') : null;
        this.isGuest.set(g === 'true');
        if (g === 'true') this.isLoggedIn.set(true);
      } catch (e) {
        // ignore
      }
    } catch (e) {
      this.isLoggedIn.set(false);
      this.isGuest.set(false);
    }
  }

  setLoggedIn(value: boolean) {
    this.isLoggedIn.set(value);
  }

  setGuest(value: boolean) {
    this.isGuest.set(value);
    try {
      if (typeof window !== 'undefined') {
        if (value) sessionStorage.setItem('guest', 'true'); else sessionStorage.removeItem('guest');
      }
    } catch (e) {
      // ignore
    }
  }

  setReady(value: boolean) {
    this.isReady.set(value);
  }

  get isLoggedInValue() {
    return this.isLoggedIn();
  }

  get isGuestValue() {
    return this.isGuest();
  }

  logout() {
    try {
      // limpiamos tokens persistentes y en memoria
      this.tokenService.clear();
      localStorage.removeItem('refresh_token');
      try { sessionStorage.removeItem('guest'); } catch (e) {}
    } catch (e) {
      // ignore
    }
    this.isLoggedIn.set(false);
    this.isGuest.set(false);
    this.isReady.set(true);
  }
}
