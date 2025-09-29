import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Configuration, ConfigurationParameters } from './configuration';
import { ApiModule } from './api.module';

@NgModule({
  imports: [
    HttpClientModule,
    ApiModule
  ],
  exports: [
    ApiModule
  ]
})
export class AuthApiModule {
  public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders<AuthApiModule> {
    return {
      ngModule: AuthApiModule,
      providers: [
        {
          provide: Configuration,
          useFactory: configurationFactory
        }
      ]
    };
  }
}

// Convenience factory for common configuration
export function createAuthApiConfiguration(params: ConfigurationParameters): Configuration {
  return new Configuration(params);
}
