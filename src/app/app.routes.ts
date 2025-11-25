
import type { Routes } from '@angular/router';

export const routes: Routes = [{
  path: '',
  loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent)
}];
