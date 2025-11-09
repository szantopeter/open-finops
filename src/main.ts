import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AuthModule } from '@auth0/auth0-angular';

import { environment, getEnv } from 'src/environments/environment';
import { AuthorizationInterceptor } from 'src/shared/interceptor/authorization-interceptor.service';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';



bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(AuthModule.forRoot(environment.auth0[getEnv()])),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthorizationInterceptor,
      multi: true
    },
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi())
  ]
})
  .catch(err => console.error(err));
