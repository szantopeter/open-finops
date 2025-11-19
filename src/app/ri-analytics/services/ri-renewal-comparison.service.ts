import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';

export interface RenewalScenario {
  scenario: string;
  upfrontPayment: string;
  durationMonths: number;
  firstFullYear: number;
  firstFullYearSavings: number;
  firstFullYearSavingsPercentage: number;
  firstFullYearRiCost: number;
  firstFullYearOnDemandCost: number;
  maxMonthlyRiSpending: number;
}

@Injectable({
  providedIn: 'root'
})
export class RiRenewalComparisonService {
  private sourceData$: Observable<{
    rows: any[];
    pricingRecords: any[];
    missingPricing: string[];
    error: string | null;
  }>;

  constructor(
    private readonly riDataService: RiDataService,
    private readonly pricingDataService: PricingDataService,
    private readonly riCostAggregationService: RiCostAggregationService
  ) {
    this.sourceData$ = this.riDataService.riPortfolio$.pipe(
      switchMap((riPortfolio) => {
        if (!riPortfolio?.rows || riPortfolio.rows.length === 0) {
          return of({ rows: [], pricingRecords: [], missingPricing: [], error: null });
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

            // Check for all types of errors
            this.riCostAggregationService.loadPricingData(pricingRecords as any);
            // Do a test aggregation to populate errors
            this.riCostAggregationService.calculateAggregation(
              { groupingMode: 'ri-type' },
              rows as any,
              pricingRecords as any
            );

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

            return { rows, pricingRecords, missingPricing, error };
          })
        );
      })
    );
  }

  getRenewalScenarios(): Observable<RenewalScenario[]> {
    return this.sourceData$.pipe(
      map(({ rows, pricingRecords }) => {
        if (!rows.length || !pricingRecords.length) {
          return [];
        }

        // Determine the first full year for renewals.
        // Prefer to compute from the most distant RI expiry (endDate) so the
        // "first full year" is the first calendar year fully covered by new
        // renewals. If no endDate available, fallback to next calendar year.
        let firstFullYear: number;
        try {
          const endDates = rows
            .map((r: any) => r.endDate)
            .filter((d: any) => d)
            .map((d: any) => Date.parse(d))
            .filter((n: number) => !Number.isNaN(n));

          if (endDates.length > 0) {
            const maxMs = Math.max(...endDates);
            const dt = new Date(maxMs);
            const year = dt.getUTCFullYear();
            const month = dt.getUTCMonth() + 1;
            const day = dt.getUTCDate();
            // If expiry is exactly Jan 1, then renewals starting that day would
            // cover that calendar year fully; otherwise the next year is the
            // first calendar year fully covered.
            firstFullYear = (month === 1 && day === 1) ? year : year + 1;
          } else {
            firstFullYear = new Date().getUTCFullYear() + 1;
          }
        } catch (e) {
          firstFullYear = new Date().getUTCFullYear() + 1;
        }

        const scenarios = [
          { upfrontPayment: 'No Upfront', durationMonths: 12 },
          { upfrontPayment: 'Partial Upfront', durationMonths: 12 },
          { upfrontPayment: 'All Upfront', durationMonths: 12 },
          { upfrontPayment: 'No Upfront', durationMonths: 36 },
          { upfrontPayment: 'Partial Upfront', durationMonths: 36 },
          { upfrontPayment: 'All Upfront', durationMonths: 36 }
        ];

        // Compute a single baseline on-demand aggregation (no renewal options)
        const baselineAggregates = this.riCostAggregationService.calculateAggregation(
          { groupingMode: 'ri-type', projectionEndYear: firstFullYear },
          rows,
          pricingRecords
        );

        const baselineMonths = Object.keys(baselineAggregates).sort();
        const baselineYearMonths = baselineMonths.filter(month => month.startsWith(`${firstFullYear}-`));
        let baselineFirstFullYearOnDemandCost = 0;
        for (const month of baselineYearMonths) {
          const groupsData = baselineAggregates[month] || {};
          const monthlyOnDemandCost = (Object.values(groupsData) as any[]).reduce((sum: number, g: any) => sum + (g.onDemandCost || 0), 0);
          baselineFirstFullYearOnDemandCost += monthlyOnDemandCost;
        }

        return scenarios.map(scenario => {
          const aggregates = this.riCostAggregationService.calculateAggregation(
            { groupingMode: 'ri-type', renewalOptions: scenario as { upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront', durationMonths: 12 | 36 }, projectionEndYear: firstFullYear },
            rows,
            pricingRecords
          );

          // For "All Upfront" scenarios, amortize the upfront cost over the renewal period
          // No longer needed as amortization is done in the aggregation service

          // Calculate metrics
          const months = Object.keys(aggregates).sort();
          const yearMonths = months.filter(month => month.startsWith(`${firstFullYear}-`));

          let firstFullYearRiCost = 0;
          // Use baseline on-demand total computed once above to ensure comparability across scenarios
          let firstFullYearOnDemandCost = baselineFirstFullYearOnDemandCost;
          let maxMonthlyRiSpending = 0;

          for (const month of months) {
            const groupsData = aggregates[month] || {};
            const monthlyRiCost = (Object.values(groupsData) as any[]).reduce((sum: number, g: any) => sum + (g.riCost || 0) + (g.renewalCost || 0), 0);
            const monthlyOnDemandCost = (Object.values(groupsData) as any[]).reduce((sum: number, g: any) => sum + (g.onDemandCost || 0), 0);

            maxMonthlyRiSpending = Math.max(maxMonthlyRiSpending, monthlyRiCost);

            if (yearMonths.includes(month)) {
              firstFullYearRiCost += monthlyRiCost;
            }
          }

          const firstFullYearSavings = firstFullYearOnDemandCost - firstFullYearRiCost;
          const firstFullYearSavingsPercentage = firstFullYearOnDemandCost > 0 ? (firstFullYearSavings / firstFullYearOnDemandCost) * 100 : 0;

          return {
            scenario: `${scenario.upfrontPayment}, ${scenario.durationMonths} months`,
            upfrontPayment: scenario.upfrontPayment,
            durationMonths: scenario.durationMonths,
            firstFullYear,
            firstFullYearSavings,
            firstFullYearSavingsPercentage,
            firstFullYearRiCost,
            firstFullYearOnDemandCost,
            maxMonthlyRiSpending
          };
        });
      })
    );
  }

  private amortizeUpfrontCosts(aggregates: Record<string, Record<string, any>>, durationMonths: number): void {
    // Find all upfront costs that were lumped into single months and amortize them
    const upfrontCostsByGroup: Record<string, { totalUpfront: number, months: string[] }> = {};

    // First pass: collect upfront costs and the months they appear in
    for (const monthKey of Object.keys(aggregates)) {
      for (const groupKey of Object.keys(aggregates[monthKey])) {
        const group = aggregates[monthKey][groupKey];
        if (group.renewalCost && group.details) {
          // Look for details with upfront costs
          for (const detail of group.details) {
            if (detail.upfront && detail.upfront > 0 && detail.isRenewal) {
              if (!upfrontCostsByGroup[groupKey]) {
                upfrontCostsByGroup[groupKey] = { totalUpfront: 0, months: [] };
              }
              upfrontCostsByGroup[groupKey].totalUpfront += detail.upfront;
              if (!upfrontCostsByGroup[groupKey].months.includes(monthKey)) {
                upfrontCostsByGroup[groupKey].months.push(monthKey);
              }
            }
          }
        }
      }
    }

    // Second pass: amortize upfront costs over the renewal period
    for (const groupKey of Object.keys(upfrontCostsByGroup)) {
      const { totalUpfront, months } = upfrontCostsByGroup[groupKey];
      if (totalUpfront > 0 && months.length > 0) {
        // Sort months to find the start month
        months.sort();
        const startMonth = months[0];

        // Calculate monthly amortized amount
        const monthlyAmortizedCost = totalUpfront / durationMonths;

        // Remove the lumped upfront cost from the first month and replace with amortized cost
        if (aggregates[startMonth] && aggregates[startMonth][groupKey]) {
          // Subtract the total upfront cost that was lumped in, and add back the first month's amortization
          aggregates[startMonth][groupKey].renewalCost = (aggregates[startMonth][groupKey].renewalCost || 0) - totalUpfront + monthlyAmortizedCost;
        }

        // Add amortized cost to the remaining months of the renewal period (starting from month 1, not 0)
        const [startYear, startMonthNum] = startMonth.split('-').map(Number);
        for (let i = 1; i < durationMonths; i++) {
          const currentYear = startYear + Math.floor((startMonthNum - 1 + i) / 12);
          const currentMonth = ((startMonthNum - 1 + i) % 12) + 1;
          const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

          // Only add amortized cost to months that already exist (have renewal activity)
          if (aggregates[monthKey] && aggregates[monthKey][groupKey]) {
            const before = aggregates[monthKey][groupKey].renewalCost || 0;
            aggregates[monthKey][groupKey].renewalCost = before + monthlyAmortizedCost;
          }
        }
      }
    }
  }

  private toMonthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
