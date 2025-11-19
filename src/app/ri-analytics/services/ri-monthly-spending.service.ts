import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RiDataService } from './ri-data.service';
import { RiPorftolio } from '../models/ri-import.model';
import { RiRow } from '../models/ri-row.model';
import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiRenewalComparisonService } from './ri-renewal-comparison.service';
import { FirstFullYearService } from './first-full-year.service';

@Injectable({ providedIn: 'root' })
export class RiMonthlySpendingService {
  constructor(
    private readonly pricingDataService: PricingDataService,
    private readonly riCostAggregationService: RiCostAggregationService,
    private readonly renewalComparisonService: RiRenewalComparisonService,
    private readonly firstFullYearService: FirstFullYearService
  ) {}

  async getMonthlyTablesForRiPortfolio(portfolio: RiPorftolio | null): Promise<{ scenarios: Array<{ scenario: string; upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront'; durationMonths: 12 | 36 }>; aggregatesByScenario: Record<string, Record<string, Record<string, any>>>; firstFullYear: number | null }> {
    if (!portfolio || !portfolio.rows || portfolio.rows.length === 0) return { scenarios: [], aggregatesByScenario: {}, firstFullYear: null };

    // compute pricing paths required
    const candidatePaths = new Set<string>();
    for (const rr of portfolio.rows) {
      const region = rr.region;
      const instance = rr.instanceClass;
      const deployment = rr.multiAz ? 'multi-az' : 'single-az';
      let engineKey = rr.engine || 'mysql';
      if (rr.edition) engineKey = `${engineKey}-${rr.edition}`;
      candidatePaths.add(`${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}.json`);
    }
    const paths = Array.from(candidatePaths);

    const pricingResult = await firstValueFrom(this.pricingDataService.loadPricingForPaths(paths));
    const pricingRecords = pricingResult.pricingRecords || [];

    // Diagnostics: surface what pricing paths were requested and a short summary
    try {
      console.debug('[RiMonthlySpendingService] pricing paths:', paths);
      console.info('[RiMonthlySpendingService] pricing paths:', paths);
      console.debug('[RiMonthlySpendingService] pricingRecords count:', pricingRecords.length, 'sample:', pricingRecords.slice(0, 3).map((p: any) => ({ duration: p.durationMonths, upfront: p.upfrontCost })));
      console.info('[RiMonthlySpendingService] pricingRecords count:', pricingRecords.length, 'sample:', pricingRecords.slice(0, 3).map((p: any) => ({ duration: p.durationMonths, upfront: p.upfrontCost })));
      // If the aggregation service exposes lastErrors, show them too
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (this.riCostAggregationService && this.riCostAggregationService.lastErrors) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        console.debug('[RiMonthlySpendingService] aggregation lastErrors:', this.riCostAggregationService.lastErrors);
      }
    } catch (e) {
      // swallow diagnostics errors to avoid impacting normal flow
      // eslint-disable-next-line no-console
      console.debug('[RiMonthlySpendingService] diagnostics error', e);
    }

    const rows: RiRow[] = portfolio.rows;

    type NormalizedRiRow = RiRow & { upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront'; durationMonths: 12 | 36 };

    const ffYear = this.firstFullYearService.computeFirstFullYear(rows);

    const scenarios = await firstValueFrom(this.renewalComparisonService.getRenewalScenarios()) as Array<{ scenario: string; upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront'; durationMonths: 12 | 36 }>;

    const aggregatesMap: Record<string, Record<string, Record<string, any>>> = {};

    // Normalize rows
    const normalizedRows: NormalizedRiRow[] = rows.map((r: RiRow) => ({ upfrontPayment: (r.upfrontPayment as any) || 'No Upfront', durationMonths: (r.durationMonths as any) || 12, ...r } as NormalizedRiRow));

    for (const sc of scenarios) {
      const renewalOpts = {
        upfrontPayment: sc.upfrontPayment,
        durationMonths: sc.durationMonths
      };

      const agg = this.riCostAggregationService.calculateAggregation(
        { groupingMode: 'cost-type', renewalOptions: renewalOpts, projectionEndYear: ffYear },
        normalizedRows,
        pricingRecords
      );

      // Diagnostics: if this is an All Upfront scenario, log months where an upfront
      // renewal was recorded so the UI developer can compare with rendered output.
      try {
        if (sc.upfrontPayment === 'All Upfront') {
          const upfrontMonths = Object.keys(agg || {}).filter(mk => ((agg[mk] && agg[mk]['Savings Upfront'] && agg[mk]['Savings Upfront'].renewalCost) || 0) > 0);
          if (upfrontMonths.length > 0) {
            const sample = upfrontMonths.map(mk => ({ month: mk, renewalCost: agg[mk]['Savings Upfront'].renewalCost, details: (agg[mk]['Savings Upfront'].details || []).slice(0, 5) }));
            console.debug(`[RiMonthlySpendingService] All Upfront found for scenario ${sc.scenario}:`, sample);
            console.info(`[RiMonthlySpendingService] All Upfront found for scenario ${sc.scenario}:`, sample);
          } else {
            console.debug(`[RiMonthlySpendingService] No All Upfront renewal month recorded for scenario ${sc.scenario}`);
            console.info(`[RiMonthlySpendingService] No All Upfront renewal month recorded for scenario ${sc.scenario}`);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('[RiMonthlySpendingService] diagnostics error while inspecting agg', e);
      }

      aggregatesMap[sc.scenario] = this.ensureFullYearMonths(agg, ffYear);
    }

    const baseline = this.riCostAggregationService.calculateAggregation(
      { groupingMode: 'cost-type', projectionEndYear: ffYear },
      normalizedRows,
      pricingRecords
    );

    aggregatesMap['Baseline'] = this.ensureFullYearMonths(baseline, ffYear);

    return { scenarios, aggregatesByScenario: aggregatesMap, firstFullYear: ffYear };
  }

  private ensureFullYearMonths(aggregate: Record<string, any>, year: number | null): Record<string, any> {
    // Ensure month keys for Jan-Dec of year exist (even if empty)
    if (!year) return aggregate;
    const out = { ...aggregate };
    for (let m = 1; m <= 12; m++) {
      const mk = `${year}-${String(m).padStart(2, '0')}`;
      if (!out[mk]) out[mk] = {};
    }
    return out;
  }
}
