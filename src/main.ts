import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideHttpClient(withInterceptors([]))
  ]
}).catch(err => console.error(err));
