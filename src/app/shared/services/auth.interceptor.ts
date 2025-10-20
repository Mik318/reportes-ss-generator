import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  let token: string | null;
  try {
    token = (typeof window !== 'undefined') ? localStorage.getItem('jwt') : null;
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
        try { auth.logout(); } catch (e) {}
        try { router.navigate(['/login']); } catch (e) {}
      }
      return throwError(() => err);
    })
  );
};
