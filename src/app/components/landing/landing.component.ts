import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { RiImportPreviewComponent } from '../ri-portfolio-preview/ri-portfolio-preview.component';
import { RiImportUploadComponent } from '../ri-portfolio-upload/ri-portfolio-upload.component';

@Component({
  selector: 'wk-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
  ,
  standalone: true,
  imports: [RiImportUploadComponent, RiImportPreviewComponent, CommonModule]
})

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LandingComponent {
  constructor() {}
}
