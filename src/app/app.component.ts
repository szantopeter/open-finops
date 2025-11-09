/* eslint-disable @typescript-eslint/no-extraneous-class */
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'wk-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet]
})
/**
 * The main component of the application.
 */
export class AppComponent {
}
