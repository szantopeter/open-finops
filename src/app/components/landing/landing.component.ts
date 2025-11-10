import { Component } from '@angular/core';

import { RiImportPreviewComponent } from '../../ri-analytics/components/ri-import-preview/ri-import-preview.component';
import { RiImportUploadComponent } from '../../ri-analytics/components/ri-import-upload/ri-import-upload.component';

@Component({
  selector: 'wk-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
  ,
  standalone: true,
  imports: [RiImportUploadComponent, RiImportPreviewComponent]
})
/**
 * The landing component of the application.
 */
export class LandingComponent {
  title = 'angular-template';

}
