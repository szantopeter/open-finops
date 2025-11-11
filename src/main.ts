import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { APP_INITIALIZER } from '@angular/core';
import { SAMPLE_IMPORT_PROVIDER } from './app/ri-analytics/sample-import-loader';



bootstrapApplication(AppComponent, {
  providers: [

    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    // When using a multi-provider token ('APP_INIT_SAMPLE_IMPORT') the DI will inject an array of
    // initializer functions. Accept the array and return a single initializer that invokes
    // each provided function (synchronously).
    { provide: APP_INITIALIZER, useFactory: (fns: Array<() => Promise<void> | void>) => {
        return async () => {
          if (!fns || fns.length === 0) return;
          for (const fn of fns) {
            try { if (typeof fn === 'function') await fn(); } catch (e) { console.error('APP_INIT_SAMPLE_IMPORT initializer failed', e); }
          }
        };
      }, deps: [['APP_INIT_SAMPLE_IMPORT']], multi: true },
    SAMPLE_IMPORT_PROVIDER
  ]
})
  .catch(err => console.error(err));
