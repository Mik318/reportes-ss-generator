import { Injectable } from '@angular/core';
import { AutenticacionService, AuthTokenResponse, RefreshRequest } from '../../../libs/republica-cafe-management';
import { TokenService } from './token.service';
import { from, BehaviorSubject, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private refreshing = false;
  private refreshSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(
    private autenticacionService: AutenticacionService,
    private tokenService: TokenService
  ) {}

  // Usado internamente para llamar al endpoint de refresh
  private async doRefresh(): Promise<AuthTokenResponse | null> {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      if (!refreshToken) return null;
      const payload: RefreshRequest = { refresh_token: refreshToken };
      const resp = await firstValueFrom(this.autenticacionService.refreshTokenAuthRefreshTokenPost(payload));
      return resp ?? null;
    } catch (e) {
      return null;
    }
  }

  // Llama al refresh una vez y notifica a todos los suscriptores
  refreshTokenOnce(): Observable<string | null> {
    if (!this.refreshing) {
      this.refreshing = true;
      this.refreshSubject.next(null);
      from(this.doRefresh()).subscribe({
        next: (resp) => {
          this.refreshing = false;
          const newToken = resp?.access_token ?? null;
          if (newToken) {
            this.tokenService.set(newToken);
          }
          if (resp?.refresh_token) {
            try { localStorage.setItem('refresh_token', resp.refresh_token); } catch (e) {}
          }
          this.refreshSubject.next(newToken);
        },
        error: () => {
          this.refreshing = false;
          this.clearAuth();
          this.refreshSubject.next(null);
        }
      });
    }
    return this.refreshSubject.asObservable();
  }

  async refreshAccessToken(): Promise<AuthTokenResponse | null> {
    const resp = await this.doRefresh();
    if (resp?.access_token) {
      this.tokenService.set(resp.access_token);
      if (resp.refresh_token) {
        try { localStorage.setItem('refresh_token', resp.refresh_token); } catch (e) {}
      }
    } else {
      this.clearAuth();
    }
    return resp;
  }

  clearAuth() {
    try { localStorage.removeItem('refresh_token'); } catch (e) {}
    this.tokenService.clear();
  }
}
