import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { MonthlyCostData } from '../models/monthly-cost-data.model';
import { PricingDataService } from '../services/pricing-data.service';
import { RiCostAggregationService } from '../services/ri-cost-aggregation.service';
import { RiDataService } from '../services/ri-data.service';

export interface ChartData {
  aggregates: Record<string, Record<string, MonthlyCostData>> | null;
  error: string | null;
  missingPricing: string[];
  totalSavingsAmount: number;
  totalSavingsPercentage: number;
  totalRiCost: number;
  totalOnDemandCost: number;
  yearSavingsBreakdown: Array<{
    year: number;
    savingsAmount: number;
    savingsPercentage: number;
    riCost: number;
    onDemandCost: number;
    isPartial: boolean;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class MonthlyCostChartService {
  private chartDataSubject = new BehaviorSubject<ChartData>({
    aggregates: null,
    error: null,
    missingPricing: [],
    totalSavingsAmount: 0,
    totalSavingsPercentage: 0,
    totalRiCost: 0,
    totalOnDemandCost: 0,
    yearSavingsBreakdown: []
  });

  private modifiedChartDataSubject = new BehaviorSubject<ChartData>({
    aggregates: null,
    error: null,
    missingPricing: [],
    totalSavingsAmount: 0,
    totalSavingsPercentage: 0,
    totalRiCost: 0,
    totalOnDemandCost: 0,
    yearSavingsBreakdown: []
  });

  public chartData$: Observable<ChartData> = this.chartDataSubject.asObservable();
  public modifiedChartData$: Observable<ChartData> = this.modifiedChartDataSubject.asObservable();

  constructor(
    private readonly riDataService: RiDataService,
    private readonly pricingDataService: PricingDataService,
    private readonly riCostAggregationService: RiCostAggregationService
  ) {
    this.initialize();
  }

  private calculateChartData(aggregates: Record<string, Record<string, MonthlyCostData>> | null, error: string | null, missingPricing: string[]): ChartData {
    if (!aggregates) {
      return {
        aggregates: null,
        error: null,
        missingPricing: [],
        totalSavingsAmount: 0,
        totalSavingsPercentage: 0,
        totalRiCost: 0,
        totalOnDemandCost: 0,
        yearSavingsBreakdown: []
      };
    }

    // Calculate totals and breakdowns
    const months = Object.keys(aggregates).sort();

    const totalRiCost = months.reduce((total, month) => {
      const groupsData = aggregates[month] || {};
      return total + (Object.values(groupsData) as MonthlyCostData[]).reduce((sum: number, g: MonthlyCostData) => sum + (g.riCost || 0) + (g.renewalCost || 0), 0);
    }, 0);

    const totalOnDemandCost = months.reduce((total, month) => {
      const groupsData = aggregates[month] || {};
      return total + (Object.values(groupsData) as MonthlyCostData[]).reduce((sum: number, g: MonthlyCostData) => sum + (g.onDemandCost || 0), 0);
    }, 0);

    const totalSavingsAmount = totalOnDemandCost - totalRiCost;
    const totalSavingsPercentage = totalOnDemandCost > 0 ? (totalSavingsAmount / totalOnDemandCost) * 100 : 0;

    // Calculate year-by-year savings breakdown
    const yearData: Record<number, { riCost: number; onDemandCost: number; months: string[] }> = {};
    for (const month of months) {
      const year = Number.parseInt(month.split('-')[0]);
      if (!yearData[year]) {
        yearData[year] = { riCost: 0, onDemandCost: 0, months: [] };
      }
      yearData[year].months.push(month);

      const groupsData = aggregates[month] || {};
      yearData[year].riCost += (Object.values(groupsData) as MonthlyCostData[]).reduce((sum: number, g: MonthlyCostData) => sum + (g.riCost || 0) + (g.renewalCost || 0), 0);
      yearData[year].onDemandCost += (Object.values(groupsData) as MonthlyCostData[]).reduce((sum: number, g: MonthlyCostData) => sum + (g.onDemandCost || 0), 0);
    }

    const sortedYears = Object.keys(yearData).map(Number).sort((a, b) => a - b);
    const yearSavingsBreakdown = sortedYears.map(year => {
      const data = yearData[year];
      const savingsAmount = data.onDemandCost - data.riCost;
      const savingsPercentage = data.onDemandCost > 0 ? (savingsAmount / data.onDemandCost) * 100 : 0;
      const isPartial = data.months.length < 12;

      return {
        year,
        savingsAmount,
        savingsPercentage,
        riCost: data.riCost,
        onDemandCost: data.onDemandCost,
        isPartial
      };
    });

    return {
      aggregates,
      error,
      missingPricing,
      totalSavingsAmount,
      totalSavingsPercentage,
      totalRiCost,
      totalOnDemandCost,
      yearSavingsBreakdown
    };
  }

  private initialize(): void {
    this.riDataService.riPortfolio$.pipe(
      switchMap((riPortfolio) => {
        if (!riPortfolio?.rows || riPortfolio.rows.length === 0) {
          return of({ aggregates: null, error: null, missingPricing: [] });
        }

        const rows = riPortfolio.rows;

        // Determine the pricing file paths needed for the import rows
        const candidatePaths = new Set<string>();
        for (const r of rows) {
          const region = r.region;
          const instance = r.instanceClass;
          const deployment = r.multiAz ? 'multi-az' : 'single-az';

          // Build engineKey for file path by combining engine + edition if present
          let engineKey = r.engine || 'mysql';
          if (r.edition) {
            engineKey = `${engineKey}-${r.edition}`;
          }

          // Build the path matching generator's convention
          const p = `${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}.json`;
          candidatePaths.add(p);
        }

        const paths = Array.from(candidatePaths);

        return this.pricingDataService.loadPricingForPaths(paths).pipe(
          map(({ pricingRecords, missingFiles }) => {
            const missingPricing: string[] = missingFiles || [];
            this.riCostAggregationService.loadPricingData(pricingRecords as any);
            const aggregates = this.riCostAggregationService.aggregateMonthlyCosts(rows as any, pricingRecords as any);
            const modifiedAggregates = this.riCostAggregationService.aggregateMonthlyCosts(rows as any, pricingRecords as any, { upfrontPayment: 'All Upfront', durationMonths: 36 });

            // Check for all types of errors (using normal aggregates for error reporting)
            const allErrors = [
              ...this.riCostAggregationService.lastErrors.unmatchedPricing,
              ...this.riCostAggregationService.lastErrors.invalidPricing,
              ...this.riCostAggregationService.lastErrors.missingRates,
              ...this.riCostAggregationService.lastErrors.zeroActiveDays,
              ...this.riCostAggregationService.lastErrors.zeroCount
            ];

            let error: string | null = null;
            if (allErrors.length > 0) {
              const errorSummary = {
                unmatchedPricing: this.riCostAggregationService.lastErrors.unmatchedPricing.length,
                invalidPricing: this.riCostAggregationService.lastErrors.invalidPricing.length,
                missingRates: this.riCostAggregationService.lastErrors.missingRates.length,
                zeroActiveDays: this.riCostAggregationService.lastErrors.zeroActiveDays.length,
                zeroCount: this.riCostAggregationService.lastErrors.zeroCount.length
              };

              const errorMessages = [];
              if (errorSummary.unmatchedPricing > 0) {
                const sample = this.riCostAggregationService.lastErrors.unmatchedPricing[0];
                errorMessages.push(`${errorSummary.unmatchedPricing} unmatched pricing record(s) (e.g., ${sample.key})`);
              }
              if (errorSummary.invalidPricing > 0) {
                const sample = this.riCostAggregationService.lastErrors.invalidPricing[0];
                errorMessages.push(`${errorSummary.invalidPricing} invalid pricing record(s) (e.g., ${sample.key})`);
              }
              if (errorSummary.missingRates > 0) {
                const sample = this.riCostAggregationService.lastErrors.missingRates[0];
                errorMessages.push(`${errorSummary.missingRates} missing rate(s) (e.g., ${sample.reason})`);
              }
              if (errorSummary.zeroActiveDays > 0) {
                const sample = this.riCostAggregationService.lastErrors.zeroActiveDays[0];
                errorMessages.push(`${errorSummary.zeroActiveDays} zero active day(s) (e.g., ${sample.reason})`);
              }
              if (errorSummary.zeroCount > 0) {
                errorMessages.push(`${errorSummary.zeroCount} zero count(s)`);
              }

              error = `Calculation errors found: ${errorMessages.join('; ')}`;
            }

            return { aggregates, modifiedAggregates, error, missingPricing };
          })
        );
      })
    ).subscribe({
      next: ({ aggregates, modifiedAggregates, error, missingPricing }: { aggregates: any; modifiedAggregates: any; error: any; missingPricing: any[] }) => {
        const normalChartData = this.calculateChartData(aggregates, error, missingPricing);
        const modifiedChartData = this.calculateChartData(modifiedAggregates, error, missingPricing); // Use same error for modified

        this.chartDataSubject.next(normalChartData);
        this.modifiedChartDataSubject.next(modifiedChartData);
      },
      error: (err) => {
        const errorData: ChartData = {
          aggregates: null,
          error: String(err?.message ?? err),
          missingPricing: [],
          totalSavingsAmount: 0,
          totalSavingsPercentage: 0,
          totalRiCost: 0,
          totalOnDemandCost: 0,
          yearSavingsBreakdown: []
        };
        this.chartDataSubject.next(errorData);
        this.modifiedChartDataSubject.next(errorData);
      }
    });
  }
}
