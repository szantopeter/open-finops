import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MigrationRecommender, MigrationRecommendation } from 'src/app/services/migration-recommender/migration-recommender-service';
import { PricingKey } from '../ri-portfolio-upload/models/pricing.model';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-migration-recommendations',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './migration-recommendations.component.html',
  styleUrls: ['./migration-recommendations.component.scss']
})
export class MigrationRecommendationsComponent implements OnInit, OnChanges {
  @Input() categoryCounts?: Map<PricingKey, number>;

  public recommendations: MigrationRecommendation[] = [];
  public loading = false;

  public columnDefs: ColDef[] = [
    { field: 'region', headerName: 'Region', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'originalInstance', headerName: 'Original Instance Class', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'recommendedInstance', headerName: 'New Instance Class', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'deployment', headerName: 'Deployment', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'engine', headerName: 'Engine', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'originalPrice', headerName: 'Original Price (1yr AU)', sortable: true, filter: 'agNumberColumnFilter', resizable: true,
      valueFormatter: params => (params.value != null && !isNaN(params.value)) ? Math.round(params.value).toString() : '' },
    { field: 'newPrice', headerName: 'New Price (1yr AU)', sortable: true, filter: 'agNumberColumnFilter', resizable: true,
      valueFormatter: params => (params.value != null && !isNaN(params.value)) ? Math.round(params.value).toString() : '' },
    { field: 'savingAmount', headerName: 'Saving (Amount)', sortable: true, filter: 'agNumberColumnFilter', resizable: true,
      valueFormatter: params => (params.value != null && !isNaN(params.value)) ? Math.round(params.value).toString() : '' },
    { field: 'savingPercentage', headerName: 'Saving (%)', sortable: true, filter: 'agNumberColumnFilter', resizable: true,
      valueFormatter: params => (params.value != null && !isNaN(params.value)) ? Math.round(params.value).toString() + '%' : '' }
  ];

  public defaultColDef = { sortable: true, filter: true, resizable: true };

  public rowData: any[] = [];
  public pinnedTopRowData: any[] = [];

  // Return a CSS class for pinned rows so we can style totals
  public getRowClass = (params: any) => {
    if (params.node?.rowPinned) {
      return 'pinned-total-row';
    }
    return '';
  }

  private refreshRowData(): void {
    this.rowData = this.recommendations.map(r => ({
      region: r.originalPricingKey.region,
      originalInstance: r.originalPricingKey.instanceClass,
      recommendedInstance: r.recommendedPricingData.instance,
      deployment: r.originalPricingKey.deployment,
      engine: r.originalPricingKey.engineKey,
      originalPrice: this.yearlyPrice(r, false) ?? 0,
      newPrice: this.yearlyPrice(r, true) ?? 0,
      savingAmount: this.savingAmount(r) ?? 0,
      savingPercentage: this.savingPercentage(r) ?? 0
    }));

    // Set pinned top row with totals
    this.pinnedTopRowData = [{
      region: 'Total',
      originalInstance: '',
      recommendedInstance: '',
      deployment: '',
      engine: '',
      originalPrice: Math.round(this.totalOriginalPrice),
      newPrice: Math.round(this.totalNewPrice),
      savingAmount: Math.round(this.totalSavingAmount),
      savingPercentage: Math.round(this.totalSavingPercentage)
    }];
  }

  constructor(private readonly recommender: MigrationRecommender) {}

  ngOnInit(): void {
    void this.loadRecommendations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categoryCounts'] && !changes['categoryCounts'].firstChange) {
      void this.loadRecommendations();
    }
  }

  private async loadRecommendations(): Promise<void> {
    this.loading = true;
    try {
      const counts = this.categoryCounts ?? new Map<PricingKey, number>();
      this.recommendations = await this.recommender.recommendMigrations(counts);
      this.refreshRowData();
    } finally {
      this.loading = false;
    }
  }

  public get sortedRecommendations(): MigrationRecommendation[] {
    return [...this.recommendations].sort((a, b) => {
      const savingA = this.savingAmount(a) ?? 0;
      const savingB = this.savingAmount(b) ?? 0;
      return savingB - savingA; // Sort descending by saving amount
    });
  }

  public yearlyPrice(recommendation: MigrationRecommendation, useRecommended = false): number | null {
    const pricingData = useRecommended ? recommendation.recommendedPricingData : recommendation.originalPricingData;
    const daily = pricingData?.savingsOptions?.['1yr_All Upfront']?.adjustedAmortisedDaily ?? null;
    if (daily === null) return null;
    return recommendation.count * daily * 365;
  }

  public savingAmount(recommendation: MigrationRecommendation): number | null {
    const original = this.yearlyPrice(recommendation, false);
    const recommended = this.yearlyPrice(recommendation, true);
    if (original === null || recommended === null) return null;
    return original - recommended;
  }

  public savingPercentage(recommendation: MigrationRecommendation): number | null {
    const original = this.yearlyPrice(recommendation, false);
    const saving = this.savingAmount(recommendation);
    if (original === null || saving === null || original === 0) return null;
    return (saving / original) * 100;
  }

  public get totalOriginalPrice(): number {
    return this.recommendations.reduce((sum, r) => sum + (this.yearlyPrice(r, false) ?? 0), 0);
  }

  public get totalNewPrice(): number {
    return this.recommendations.reduce((sum, r) => sum + (this.yearlyPrice(r, true) ?? 0), 0);
  }

  public get totalInstanceCount(): number {
    return this.recommendations.reduce((sum, r) => sum + r.count, 0);
  }

  public get totalSavingAmount(): number {
    return this.recommendations.reduce((sum, r) => sum + (this.savingAmount(r) ?? 0), 0);
  }

  public get totalSavingPercentage(): number {
    const totalOriginal = this.totalOriginalPrice;
    const totalSaving = this.totalSavingAmount;
    if (totalOriginal === 0) return 0;
    return (totalSaving / totalOriginal) * 100;
  }
}
