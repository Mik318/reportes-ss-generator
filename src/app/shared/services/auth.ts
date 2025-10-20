import {Injectable, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  // Inicializa la señal con el token en localStorage si existe
  isLoggedIn = signal(false);

  constructor() {
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem('jwt') : null;
      this.isLoggedIn.set(!!token);
    } catch (e) {
      // En ambientes donde localStorage no está disponible (SSR) fallamos silenciosamente
      this.isLoggedIn.set(false);
    }
  }

  setLoggedIn(value: boolean) {
    this.isLoggedIn.set(value);
  }

  get isLoggedInValue() {
    return this.isLoggedIn();
  }

  logout() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jwt');
      }
    } catch (e) {
      // ignore
    }
    this.isLoggedIn.set(false);
  }
}
