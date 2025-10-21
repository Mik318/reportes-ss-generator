import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';
import { Router } from '@angular/router';
import { catchError, switchMap, take } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  let token: string | null;
  try {
    token = tokenService.get();
  } catch (e) {
    token = null;
  }

  if (token) {
    req = req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) });
  }

  return next(req).pipe(
    catchError((err) => {
      const status = err?.status;
      if (status === 401 || status === 403) {
        // Si no hay refresh_token almacenado, forzamos logout y redirigimos inmediatamente
        let storedRefresh: string | null;
        try { storedRefresh = (typeof window !== 'undefined') ? localStorage.getItem('refresh_token') : null; } catch (e) { storedRefresh = null; }
        if (!storedRefresh) {
          try { auth.logout(); } catch (e) {}
          try { router.navigate(['/login']); } catch (e) {}
          return throwError(() => err);
        }

        // Intentar refresh
        return authService.refreshTokenOnce().pipe(
          take(1),
          switchMap((newToken) => {
            if (newToken) {
              const retry = req.clone({ headers: req.headers.set('Authorization', `Bearer ${newToken}`) });
              return next(retry);
            }
            // no se pudo refrescar
            try { auth.logout(); } catch (e) {}
            try { router.navigate(['/login']); } catch (e) {}
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
