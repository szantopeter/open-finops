import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'wk-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']

})
/**
 * The landing component of the application.
 */
export class LandingComponent {
  title = 'angular-template';

  /**
   *
   * @param auth0 The Auth0 service.
   */
  constructor(private auth0: AuthService) {
  }

  /**
   * Logs the user out.
   */
  logout(): void {
    this.auth0.logout();
  }

}
