import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { DEFAULT_IMPORT_PROVIDER } from './app/ri-analytics/sample-import-loader';



bootstrapApplication(AppComponent, {
  providers: [

    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    // When using a multi-provider token ('APP_INIT_SAMPLE_IMPORT') the DI will inject an array of
    // initializer functions. Accept the array and return a single initializer that invokes
    // each provided function (synchronously).
    { provide: APP_INITIALIZER, useFactory: (fns: Array<() => Promise<void> | void>): () => Promise<void> => {
      return async (): Promise<void> => {
        if (!fns || fns.length === 0) return;
        for (const fn of fns) {
          try {
            if (typeof fn === 'function') await fn();
          } catch (err) {
            console.error('APP_INIT_DEFAULT_IMPORT initializer failed', err);
          }
        }
      };
    }, deps: [['APP_INIT_DEFAULT_IMPORT']], multi: true },
    DEFAULT_IMPORT_PROVIDER
  ]
})
  .catch(err => console.error(err));
