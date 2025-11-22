import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { CostComparisonTableComponent } from '../cost-comparison-table/cost-comparison-table.component';
import { RiImportPreviewComponent } from '../ri-portfolio-preview/ri-portfolio-preview.component';
import { RiImportUploadComponent } from '../ri-portfolio-upload/ri-portfolio-upload.component';
import { RiPortfolioDataService } from '../ri-portfolio-upload/service/ri-portfolio-data.service';

@Component({
  selector: 'wk-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
  ,
  standalone: true,
  imports: [RiImportUploadComponent, RiImportPreviewComponent, CostComparisonTableComponent, CommonModule]
})


export class LandingComponent {
  riPortfolio$ = this.riPortfolioDataService.riPortfolio$;

  constructor(private riPortfolioDataService: RiPortfolioDataService) {}
}
