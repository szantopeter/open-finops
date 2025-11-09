
import { Routes } from '@angular/router';
import { AuthGuard } from '@auth0/auth0-angular';

export const routes: Routes = [{
  path: '',
  canActivate: [AuthGuard],
  loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent)
}];
