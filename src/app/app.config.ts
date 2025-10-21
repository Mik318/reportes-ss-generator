import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {provideApi} from '../libs/republica-cafe-management/provide-api';
import {provideHttpClient, withFetch} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideApi({
      basePath: 'https://reportes-api.onrender.com',
      // basePath: 'http://127.0.0.1:8000',
      credentials: {
        bearerAuth: () => {
          return localStorage.getItem("jwt") ?? undefined;
        },
      },
    })
  ]
};
