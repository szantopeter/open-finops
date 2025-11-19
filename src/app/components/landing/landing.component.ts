import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { RiImportPreviewComponent } from '../../ri-analytics/components/ri-import-preview/ri-import-preview.component';
import { RiImportUploadComponent } from '../../ri-analytics/components/ri-import-upload/ri-import-upload.component';
import { RiRenewalComparisonComponent } from '../../ri-analytics/components/ri-renewal-comparison/ri-renewal-comparison.component';
import { RiMonthlySpendingTablesComponent } from '../../ri-analytics/components/ri-monthly-spending-tables/ri-monthly-spending-tables.component';
import { RiDataService } from '../../ri-analytics/services/ri-data.service';
import { RiMonthlySpendingService } from '../../ri-analytics/services/ri-monthly-spending.service';

@Component({
  selector: 'wk-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
  ,
  standalone: true,
  imports: [RiImportUploadComponent, RiImportPreviewComponent, RiRenewalComparisonComponent, RiMonthlySpendingTablesComponent, CommonModule]
})
/**
 * The landing component of the application.
 */
export class LandingComponent implements OnInit, OnDestroy {
  title = 'aws-rds-ri-portfolio-optimiser';
  debug: { lastImportSummary?: any; monthlySpending?: any; visible?: boolean } = {};
  private sub?: Subscription;

  constructor(private readonly riDataService: RiDataService, private readonly monthlyService: RiMonthlySpendingService) {}

  ngOnInit(): void {
    this.sub = this.riDataService.riPortfolio$.subscribe(async (p) => {
      this.debug.lastImportSummary = p;
      try {
        this.debug.monthlySpending = null;
        const res = await this.monthlyService.getMonthlyTablesForRiPortfolio(p);
        this.debug.monthlySpending = res;
      } catch (e) {
        this.debug.monthlySpending = { error: String(e) };
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleDebug(): void {
    this.debug.visible = !this.debug.visible;
  }
}
