import { Injectable } from '@angular/core';

import { AggregationRequest } from '../models/aggregation-request.model';
import { MonthlyCostData } from '../models/monthly-cost-data.model';
import { PricingRecord } from '../models/pricing-record.model';
import { RenewalProjection } from '../models/renewal-projection.model';
import { RiMatchingCriteria } from '../models/ri-matching-criteria.model';
import { SavingsBreakdown, SavingsYearData } from '../models/savings-breakdown.model';

interface RiRow {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: string;
  durationMonths: number;
  startDate: string; // ISO
  endDate?: string; // ISO or undefined for still active
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class RiCostAggregationService {
  private matcherIndex = new Map<string, PricingRecord>();
  // Public diagnostics for UI consumption
  public lastUnmatchedCount = 0;
  // store unmatched samples for UI; cap to avoid unbounded memory use
  public lastUnmatchedSamples: Array<{ key: string; row: any }> = [];
  private readonly UNMATCHED_CAP = 1000;

  // Comprehensive error tracking
  public lastErrors: {
    unmatchedPricing: Array<{ key: string; row: any; reason: string }>;
    invalidPricing: Array<{ key: string; row: any; reason: string }>;
    missingRates: Array<{ key: string; row: any; pricing: any; reason: string }>;
    zeroActiveDays: Array<{ key: string; row: any; monthKey: string; activeDays: number; reason: string }>;
    zeroCount: Array<{ key: string; row: any; reason: string }>;
    renewalErrors: Array<{ key: string; row: any; reason: string }>; // Errors specific to renewal calculations
  } = {
      unmatchedPricing: [],
      invalidPricing: [],
      missingRates: [],
      zeroActiveDays: [],
      zeroCount: [],
      renewalErrors: [] // Initialize empty array for renewal errors
    };

  constructor() {}

  private addZeroCountError(key: string, row: RiRow): void {
    if (this.lastErrors.zeroCount.length < this.UNMATCHED_CAP) {
      this.lastErrors.zeroCount.push({
        key,
        row: {
          instanceClass: row.instanceClass,
          region: row.region,
          multiAz: String(row.multiAz),
          engine: row.engine,
          edition: row.edition ?? null,
          upfrontPayment: row.upfrontPayment,
          durationMonths: row.durationMonths,
          startDate: row.startDate,
          endDate: row.endDate ?? null,
          count: row.count ?? 1
        },
        reason: 'RI count is zero or null'
      });
    }
  }

  private addZeroActiveDaysError(key: string, row: RiRow, monthKey: string, activeDays: number): void {
    if (this.lastErrors.zeroActiveDays.length < this.UNMATCHED_CAP) {
      this.lastErrors.zeroActiveDays.push({
        key,
        row: {
          instanceClass: row.instanceClass,
          region: row.region,
          multiAz: String(row.multiAz),
          engine: row.engine,
          edition: row.edition ?? null,
          upfrontPayment: row.upfrontPayment,
          durationMonths: row.durationMonths,
          startDate: row.startDate,
          endDate: row.endDate ?? null,
          count: row.count ?? 1
        },
        monthKey,
        activeDays,
        reason: `RI is not active in month ${monthKey} (start: ${row.startDate}, end: ${row.endDate || 'ongoing'})`
      });
    }
  }

  private addMissingRateError(key: string, row: RiRow, pricing: PricingRecord, rateType: 'reserved' | 'onDemand'): void {
    if (this.lastErrors.missingRates.length < this.UNMATCHED_CAP) {
      this.lastErrors.missingRates.push({
        key,
        row: {
          instanceClass: row.instanceClass,
          region: row.region,
          multiAz: String(row.multiAz),
          engine: row.engine,
          edition: row.edition ?? null,
          upfrontPayment: row.upfrontPayment,
          durationMonths: row.durationMonths,
          startDate: row.startDate,
          endDate: row.endDate ?? null,
          count: row.count ?? 1
        },
        pricing: {
          dailyReservedRate: pricing.dailyReservedRate,
          dailyOnDemandRate: pricing.dailyOnDemandRate,
          upfrontCost: pricing.upfrontCost
        },
        reason: `Missing daily ${rateType === 'reserved' ? 'reserved' : 'on-demand'} rate in pricing data`
      });
    }
  }

  private toHumanReadableKey(criteria: RiMatchingCriteria): string {
    return `${criteria.instanceClass} ${criteria.region} ${criteria.multiAz ? 'Multi-AZ' : 'Single-AZ'} ${criteria.engine}${criteria.edition ? ` ${criteria.edition}` : ''} ${criteria.upfrontPayment} ${criteria.durationMonths}mo`;
  }

  private toMonthKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }

  private calculateUnionDays(periods: Array<{start: Date, end: Date, count: number}>): number {
    if (periods.length === 0) return 0;
    console.log(`[calculateUnionDays] Input periods: ${periods.length}`, periods.map(p => ({ start: p.start.toISOString(), end: p.end.toISOString(), count: p.count })));
    // Sort periods by start date
    periods.sort((a, b) => a.start.getTime() - b.start.getTime());
    let union = 0;
    let currentEnd = new Date(periods[0].start.getTime() - 1); // Before first
    for (const p of periods) {
      if (p.start > currentEnd) {
        // No overlap, add full period
        union += Math.ceil((p.end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        currentEnd = p.end;
      } else if (p.end > currentEnd) {
        // Overlap, add extension
        union += Math.ceil((p.end.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));
        currentEnd = p.end;
      }
    }
    console.log(`[calculateUnionDays] Union days: ${union}`);
    return union;
  }

  private detectExpiringRis(rows: RiRow[], projectionEnd: Date): RiRow[] {
    return rows.filter(row => {
      if (!row.endDate) return false; // Ongoing RIs don't expire
      const endDate = new Date(row.endDate + 'T00:00:00Z');
      return endDate <= projectionEnd;
    });
  }

  private calculateRenewalProjection(originalRi: RiRow, pricingIndex: Map<string, PricingRecord>, renewalOptions?: { upfrontPayment: string, durationMonths: number }): RenewalProjection | null {
    if (!originalRi.endDate) return null; // Cannot renew ongoing RI

    const criteria = new RiMatchingCriteria({
      instanceClass: originalRi.instanceClass,
      region: originalRi.region,
      multiAz: originalRi.multiAz,
      engine: originalRi.engine,
      edition: originalRi.edition ?? null,
      upfrontPayment: renewalOptions?.upfrontPayment || originalRi.upfrontPayment as any,
      durationMonths: renewalOptions?.durationMonths || originalRi.durationMonths
    });
    const key = criteria.toKey();
    const pricing = pricingIndex.get(key);

    if (!pricing) {
      // Track renewal error
      if (this.lastErrors.renewalErrors.length < this.UNMATCHED_CAP) {
        this.lastErrors.renewalErrors.push({
          key,
          row: {
            instanceClass: originalRi.instanceClass,
            region: originalRi.region,
            multiAz: String(originalRi.multiAz),
            engine: originalRi.engine,
            edition: originalRi.edition ?? null,
            upfrontPayment: originalRi.upfrontPayment,
            durationMonths: originalRi.durationMonths,
            startDate: originalRi.startDate,
            endDate: originalRi.endDate,
            count: originalRi.count ?? 1
          },
          reason: 'No matching pricing record found for renewal calculation'
        });
      }
      return null;
    }

    // Calculate renewal start date (month after expiration)
    const expirationDate = new Date(originalRi.endDate + 'T00:00:00Z');
    const renewalStart = new Date(Date.UTC(expirationDate.getUTCFullYear(), expirationDate.getUTCMonth() + 1, 1));

    // Calculate renewal end date (if duration is specified)
    let renewalEnd: Date | undefined;
    const renewalDuration = renewalOptions?.durationMonths || originalRi.durationMonths;
    if (renewalDuration) {
      renewalEnd = new Date(renewalStart);
      renewalEnd.setUTCMonth(renewalEnd.getUTCMonth() + renewalDuration);
    }

    // Calculate monthly cost (assuming 30 days for simplicity, as in tests)
    const dailyRate = pricing.dailyReservedRate ?? 0;
    const count = originalRi.count || 1;
    const monthlyCost = dailyRate * 30 * count;

    return {
      originalRi,
      renewalStart,
      renewalEnd,
      pricing,
      monthlyCost
    };
  }

  loadPricingData(records: PricingRecord[]): void {
    this.matcherIndex.clear();
    for (const r of records) {
      const key = new RiMatchingCriteria({
        instanceClass: r.instanceClass,
        region: r.region,
        multiAz: r.multiAz,
        engine: r.engine,
        edition: r.edition ?? null,
        upfrontPayment: r.upfrontPayment,
        durationMonths: r.durationMonths
      }).toKey();
      this.matcherIndex.set(key, r);
      // Fallback index: if engine token contains hyphens (e.g. 'oracle-se2-byol') and
      // the record has no explicit edition, also index an alternative key where the
      // engine is the leading token and the rest becomes the edition. This allows
      // imported rows that separate engine and edition/license to match the same
      // pricing record.
      try {
        const eng = (r.engine || '').toString();
        if ((r.edition === null || r.edition === undefined) && eng.includes('-')) {
          const parts = eng.split('-');
          if (parts.length > 1) {
            const baseEngine = parts[0];
            const editionPart = parts.slice(1).join('-');
            const altKey = new RiMatchingCriteria({
              instanceClass: r.instanceClass,
              region: r.region,
              multiAz: r.multiAz,
              engine: baseEngine,
              edition: editionPart,
              upfrontPayment: r.upfrontPayment,
              durationMonths: r.durationMonths
            }).toKey();
            // only set if missing to avoid overwriting an existing exact match
            if (!this.matcherIndex.has(altKey)) this.matcherIndex.set(altKey, r);
          }
        }

        // Symmetric fallback: if the pricing record has an explicit edition but the engine
        // token is the base engine (no hyphen), index an alternative key where the engine
        // and edition are combined into the engine token (e.g. engine='oracle', edition='se2'
        // -> altEngine='oracle-se2' with edition null). This covers imports that encode
        // edition/license into the engine field instead of a separate edition property.
        try {
          const eng2 = (r.engine || '').toString();
          const ed2 = (r.edition ?? '').toString();
          if (ed2 && !eng2.includes('-')) {
            const combinedEngine = `${eng2}-${ed2}`;
            const altKey2 = new RiMatchingCriteria({
              instanceClass: r.instanceClass,
              region: r.region,
              multiAz: r.multiAz,
              engine: combinedEngine,
              edition: null,
              upfrontPayment: r.upfrontPayment,
              durationMonths: r.durationMonths
            }).toKey();
            if (!this.matcherIndex.has(altKey2)) this.matcherIndex.set(altKey2, r);
          }
        } catch {
          // swallow
        }

        // Additional tolerant fallbacks: many pricing edition tokens include a license
        // suffix like '-byol' or '-se2-byol'. Create alternate keys that strip common
        // license suffixes so rows with edition 'se2' will match records with edition
        // 'se2-byol' (and similarly for combined engine tokens).
        try {
          const editionRaw = (r.edition ?? '').toString();
          const engineRaw = (r.engine ?? '').toString();
          const licenseSuffixes = new Set(['byol', 'li', 'licenseincluded', 'license', 'bring-your-own-license']);

          // If edition is present and contains a license suffix, index a stripped-edition key
          if (editionRaw && editionRaw.includes('-')) {
            const parts = editionRaw.split('-');
            const last = parts[parts.length - 1].toLowerCase();
            if (licenseSuffixes.has(last) && parts.length > 1) {
              const strippedEdition = parts.slice(0, parts.length - 1).join('-');
              const altKey3 = new RiMatchingCriteria({
                instanceClass: r.instanceClass,
                region: r.region,
                multiAz: r.multiAz,
                engine: r.engine,
                edition: strippedEdition,
                upfrontPayment: r.upfrontPayment,
                durationMonths: r.durationMonths
              }).toKey();
              if (!this.matcherIndex.has(altKey3)) this.matcherIndex.set(altKey3, r);

              // also add symmetric combined-engine variant (engine + strippedEdition, edition null)
              const engBase = engineRaw;
              if (engBase && !engBase.includes('-')) {
                const combinedEngineStripped = `${engBase}-${strippedEdition}`;
                const altKey4 = new RiMatchingCriteria({
                  instanceClass: r.instanceClass,
                  region: r.region,
                  multiAz: r.multiAz,
                  engine: combinedEngineStripped,
                  edition: null,
                  upfrontPayment: r.upfrontPayment,
                  durationMonths: r.durationMonths
                }).toKey();
                if (!this.matcherIndex.has(altKey4)) this.matcherIndex.set(altKey4, r);
              }
            }
          }

          // If engine contains hyphened tokens (e.g. 'oracle-se2-byol'), attempt to
          // index a variant that removes the trailing license suffix (-> 'oracle-se2').
          if (engineRaw && engineRaw.includes('-')) {
            const engParts = engineRaw.split('-');
            const lastEng = engParts[engParts.length - 1].toLowerCase();
            if (licenseSuffixes.has(lastEng) && engParts.length > 1) {
              const strippedEngine = engParts.slice(0, engParts.length - 1).join('-');
              // alt: stripped engine with edition null
              const altKey5 = new RiMatchingCriteria({
                instanceClass: r.instanceClass,
                region: r.region,
                multiAz: r.multiAz,
                engine: strippedEngine,
                edition: null,
                upfrontPayment: r.upfrontPayment,
                durationMonths: r.durationMonths
              }).toKey();
              if (!this.matcherIndex.has(altKey5)) this.matcherIndex.set(altKey5, r);

              // alt: base engine + stripped edition (if base and edition split)
              const baseEngine = engParts[0];
              const editionPart = engParts.slice(1, engParts.length - 1).join('-');
              if (editionPart) {
                const altKey6 = new RiMatchingCriteria({
                  instanceClass: r.instanceClass,
                  region: r.region,
                  multiAz: r.multiAz,
                  engine: baseEngine,
                  edition: editionPart,
                  upfrontPayment: r.upfrontPayment,
                  durationMonths: r.durationMonths
                }).toKey();
                if (!this.matcherIndex.has(altKey6)) this.matcherIndex.set(altKey6, r);
              }
            }
          }
        } catch {
          // swallow
        }
      } catch {
        // swallow
      }
    }
  }

  calculateAggregation(request: AggregationRequest, rows: RiRow[], pricingRecords: PricingRecord[]): Record<string, Record<string, MonthlyCostData>> {
    switch (request.groupingMode) {
    case 'ri-type':
      return this.aggregateMonthlyCostsByRiType(rows, pricingRecords, request.renewalOptions);
    case 'cost-type':
      return this.aggregateMonthlyCostsByCostType(rows, pricingRecords, request.renewalOptions);
    default:
      throw new Error(`Unsupported grouping mode: ${request.groupingMode}`);
    }
  }

  aggregateMonthlyCostsByRiType(rows: RiRow[], pricingRecords: PricingRecord[], renewalOptions?: { upfrontPayment: string, durationMonths: number }): Record<string, Record<string, MonthlyCostData>> {
    console.log(`[RiCostAggregation] Starting aggregation with ${rows.length} RI rows and ${pricingRecords.length} pricing records`);
    // Load pricing into index
    this.loadPricingData(pricingRecords);

    console.log('[RiCostAggregation] Loaded pricing index with', this.matcherIndex.size, 'entries');
    console.log('[RiCostAggregation] Sample pricing keys:', Array.from(this.matcherIndex.keys()).slice(0, 3));

    const result: Record<string, Record<string, MonthlyCostData>> = {};

    let matchedCount = 0;
    let unmatchedCount = 0;
    this.lastUnmatchedCount = 0;
    this.lastUnmatchedSamples = [];

    // Reset error tracking
    this.lastErrors = {
      unmatchedPricing: [],
      invalidPricing: [],
      missingRates: [],
      zeroActiveDays: [],
      zeroCount: [],
      renewalErrors: []
    };

    for (const row of rows) {
      const criteria = new RiMatchingCriteria({
        instanceClass: row.instanceClass,
        region: row.region,
        multiAz: row.multiAz,
        engine: row.engine,
        edition: row.edition ?? null,
        upfrontPayment: row.upfrontPayment as any,
        durationMonths: row.durationMonths
      });
      const key = criteria.toKey();
      const pricing = this.matcherIndex.get(key);
      if (!pricing) {
        unmatchedCount++;
        const errorEntry = {
          key,
          row: {
            instanceClass: row.instanceClass,
            region: row.region,
            multiAz: String(row.multiAz),
            engine: row.engine,
            edition: row.edition ?? null,
            upfrontPayment: row.upfrontPayment,
            durationMonths: row.durationMonths,
            startDate: row.startDate,
            endDate: row.endDate ?? null,
            count: row.count ?? 1
          },
          reason: 'No matching pricing record found for this RI configuration'
        };
        // store up to UNMATCHED_CAP samples for UI consumption
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push(errorEntry);
        }
        if (this.lastErrors.unmatchedPricing.length < this.UNMATCHED_CAP) {
          this.lastErrors.unmatchedPricing.push(errorEntry);
        }
        // keep console noise limited to the first few unmatched rows for debugging
        if (unmatchedCount <= 5) {
          console.warn('[RiCostAggregation] No pricing match for row key:', key);
          console.warn('[RiCostAggregation] Row fields:', errorEntry.row);
        }
        // skip unmatched
        continue;
      }

      // Validate pricing data: reserved rate must be <= on-demand rate
      if (pricing.dailyReservedRate && pricing.dailyOnDemandRate && pricing.dailyReservedRate > pricing.dailyOnDemandRate) {
        unmatchedCount++;
        const errorEntry = {
          key: key + ' (invalid pricing: reserved > on-demand)',
          row: {
            instanceClass: row.instanceClass,
            region: row.region,
            multiAz: String(row.multiAz),
            engine: row.engine,
            edition: row.edition ?? null,
            upfrontPayment: row.upfrontPayment,
            durationMonths: row.durationMonths,
            startDate: row.startDate,
            endDate: row.endDate ?? null,
            count: row.count ?? 1
          },
          reason: `Invalid pricing data: reserved rate (${pricing.dailyReservedRate}) > on-demand rate (${pricing.dailyOnDemandRate})`
        };
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push(errorEntry);
        }
        if (this.lastErrors.invalidPricing.length < this.UNMATCHED_CAP) {
          this.lastErrors.invalidPricing.push(errorEntry);
        }
        if (unmatchedCount <= 5) {
          console.warn('[RiCostAggregation] Invalid pricing data for row key:', key, 'reserved rate > on-demand rate');
        }
        continue;
      }
      matchedCount++;

      const start = new Date(row.startDate + 'T00:00:00Z');
      const end = row.endDate ? new Date(row.endDate + 'T00:00:00Z') : null;

      // iterate months from start to end (or start + durationMonths)
      const monthsToCover: string[] = [];
      const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const lastMonth = end ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)) : null;

      const limitMonths = row.durationMonths || 1;
      let countedMonths = 0;

      while (true) {
        const monthKey = this.toMonthKey(current);
        monthsToCover.push(monthKey);
        countedMonths++;
        if (lastMonth && current.getUTCFullYear() === lastMonth.getUTCFullYear() && current.getUTCMonth() === lastMonth.getUTCMonth()) break;
        if (!lastMonth && countedMonths >= limitMonths) break;
        // increment month
        current.setUTCMonth(current.getUTCMonth() + 1);
        // safety
        if (countedMonths > 2400) break;
      }

      for (const monthKey of monthsToCover) {
        // compute month start/end
        const [y, m] = monthKey.split('-').map((v) => parseInt(v, 10));
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 0)); // last day
        // daysInMonth unused: intentionally omitted

        // determine active days in this month
        const activeStart = start > monthStart ? start : monthStart;
        const activeEnd = end && end < monthEnd ? end : monthEnd;
        const activeDays = Math.max(0, Math.ceil((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Check for zero count
        if (!(row.count || 1)) {
          this.addZeroCountError(key, row);
        }

        // Check for zero active days
        if (activeDays === 0) {
          this.addZeroActiveDaysError(key, row, monthKey, activeDays);
        }

        // compute costs
        const dailyRate = pricing.dailyReservedRate ?? 0;

        // Check for missing rates
        if (!pricing.dailyReservedRate) {
          this.addMissingRateError(key, row, pricing, 'reserved');
        }

        if (!pricing.dailyOnDemandRate) {
          this.addMissingRateError(key, row, pricing, 'onDemand');
        }

        const recurringCost = dailyRate * activeDays * (row.count || 1);

        // upfront only in the month containing the start date
        const isFirstMonth = start.getUTCFullYear() === monthStart.getUTCFullYear() && start.getUTCMonth() === monthStart.getUTCMonth();
        const upfront = isFirstMonth ? (pricing.upfrontCost ?? 0) * (row.count || 1) : 0;

        const total = recurringCost + upfront;

        if (!result[monthKey]) result[monthKey] = {};
        const groupKey = this.toHumanReadableKey(criteria);
        if (!result[monthKey][groupKey]) result[monthKey][groupKey] = { monthKey, groupKey, riCost: 0, onDemandCost: 0, savingsAmount: 0, savingsPercentage: 0, details: [], coveredPeriods: [] };
        result[monthKey][groupKey].riCost += total;

        // Add covered period instead of calculating on-demand cost here
        result[monthKey][groupKey].coveredPeriods!.push({ start: activeStart, end: activeEnd, count: row.count || 1 });

        // update savings (will be recalculated later)
        result[monthKey][groupKey].savingsAmount = result[monthKey][groupKey].onDemandCost - result[monthKey][groupKey].riCost;
        result[monthKey][groupKey].savingsPercentage = result[monthKey][groupKey].onDemandCost > 0 ? (1 - result[monthKey][groupKey].riCost / result[monthKey][groupKey].onDemandCost) * 100 : 0;

        result[monthKey][groupKey].details.push({ row, pricing, recurringCost, upfront, activeDays, onDemandCost: 0 }); // onDemandCost will be set later
      }
    }

    // Calculate renewal projections
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const projectionEnd = new Date(Date.UTC(currentYear + 1, 11, 31)); // End of next calendar year

    const expiringRis = this.detectExpiringRis(rows, projectionEnd);
    console.log('[RiCostAggregation] Found', expiringRis.length, 'expiring RIs for renewal projection');

    for (const expiringRi of expiringRis) {
      const renewalProjection = this.calculateRenewalProjection(expiringRi, this.matcherIndex, renewalOptions);
      if (!renewalProjection) continue; // Skip if renewal calculation failed

      // Calculate months where renewal is active
      const renewalMonths: string[] = [];
      const renewalCurrent = new Date(renewalProjection.renewalStart);

      // Project renewal for up to the duration or until projection end
      const maxMonths = renewalOptions?.durationMonths || expiringRi.durationMonths || 12; // Default to 1 year if no duration
      let renewalMonthCount = 0;

      while (renewalCurrent <= projectionEnd && renewalMonthCount < maxMonths) {
        const monthKey = this.toMonthKey(renewalCurrent);
        renewalMonths.push(monthKey);
        renewalCurrent.setUTCMonth(renewalCurrent.getUTCMonth() + 1);
        renewalMonthCount++;
      }

      // Add renewal costs to monthly data
      for (const monthKey of renewalMonths) {
        if (!result[monthKey]) result[monthKey] = {};

        const criteria = new RiMatchingCriteria({
          instanceClass: expiringRi.instanceClass,
          region: expiringRi.region,
          multiAz: expiringRi.multiAz,
          engine: expiringRi.engine,
          edition: expiringRi.edition ?? null,
          upfrontPayment: renewalOptions?.upfrontPayment || expiringRi.upfrontPayment as any,
          durationMonths: renewalOptions?.durationMonths || expiringRi.durationMonths
        });
        const groupKey = this.toHumanReadableKey(criteria);

        if (!result[monthKey][groupKey]) {
          // Create entry if it doesn't exist (renewal-only month)
          result[monthKey][groupKey] = {
            monthKey,
            groupKey,
            riCost: 0,
            onDemandCost: 0,
            savingsAmount: 0,
            savingsPercentage: 0,
            details: [],
            coveredPeriods: []
          };
        }

        // Calculate active days for renewal RI in this month
        const [y, m] = monthKey.split('-').map((v) => parseInt(v, 10));
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 0)); // last day

        const renewalStartDate = renewalProjection.renewalStart;
        const renewalEndDate = renewalProjection.renewalEnd;

        const activeStart = renewalStartDate > monthStart ? renewalStartDate : monthStart;
        const activeEnd = renewalEndDate && renewalEndDate < monthEnd ? renewalEndDate : monthEnd;
        const activeDays = Math.max(0, Math.ceil((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Calculate renewal costs
        const dailyRate = renewalProjection.pricing.dailyReservedRate ?? 0;
        const count = expiringRi.count || 1;

        const renewalCost = dailyRate * activeDays * count;

        // Add upfront cost for "All Upfront" renewals in the first month of renewal
        const isFirstRenewalMonth = renewalProjection.renewalStart.getUTCFullYear() === monthStart.getUTCFullYear() &&
                                   renewalProjection.renewalStart.getUTCMonth() === monthStart.getUTCMonth();
        const renewalUpfront = (renewalOptions?.upfrontPayment === 'All Upfront' && isFirstRenewalMonth) ?
                              (renewalProjection.pricing.upfrontCost ?? 0) * count : 0;

        // Add renewal cost (recurring + upfront)
        result[monthKey][groupKey].renewalCost = (result[monthKey][groupKey].renewalCost || 0) + renewalCost + renewalUpfront;

        // Add covered period for renewal
        result[monthKey][groupKey].coveredPeriods!.push({ start: activeStart, end: activeEnd, count });

        // Update on-demand cost and savings (will be recalculated later)
        result[monthKey][groupKey].savingsAmount = result[monthKey][groupKey].onDemandCost - (result[monthKey][groupKey].riCost + (result[monthKey][groupKey].renewalCost || 0));
        result[monthKey][groupKey].savingsPercentage = result[monthKey][groupKey].onDemandCost > 0 ?
          (1 - (result[monthKey][groupKey].riCost + (result[monthKey][groupKey].renewalCost || 0)) / result[monthKey][groupKey].onDemandCost) * 100 : 0;

        result[monthKey][groupKey].details.push({
          row: expiringRi,
          pricing: renewalProjection.pricing,
          recurringCost: renewalCost,
          upfront: renewalUpfront,
          activeDays,
          onDemandCost: 0, // will be set later
          isRenewal: true
        });
      }
    }

    // Finalize on-demand costs based on union of covered periods
    for (const monthKey of Object.keys(result)) {
      for (const groupKey of Object.keys(result[monthKey])) {
        const group = result[monthKey][groupKey];
        if (group.coveredPeriods && group.coveredPeriods.length > 0) {
          console.log(`[RiCostAggregation] Finalizing ${monthKey} ${groupKey}: ${group.coveredPeriods.length} periods`);
          // Get pricing from first detail
          const firstDetail = group.details.find(d => d.pricing);
          if (firstDetail) {
            const onDemandDailyRate = firstDetail.pricing.dailyOnDemandRate ?? 0;
            let onDemandCost = 0;
            for (const p of group.coveredPeriods) {
              const periodDays = Math.ceil((p.end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              onDemandCost += periodDays * p.count * onDemandDailyRate;
              console.log(`[RiCostAggregation] Period: ${p.start.toISOString()} to ${p.end.toISOString()}, days: ${periodDays}, count: ${p.count}, cost: ${periodDays * p.count * onDemandDailyRate}`);
            }
            group.onDemandCost = onDemandCost;
            console.log(`[RiCostAggregation] Total onDemandCost: ${group.onDemandCost}`);
          }
          // Recalculate savings
          const totalRiCost = group.riCost + (group.renewalCost || 0);
          group.savingsAmount = group.onDemandCost - totalRiCost;
          group.savingsPercentage = group.onDemandCost > 0 ? (1 - totalRiCost / group.onDemandCost) * 100 : 0;
          console.log(`[RiCostAggregation] Total RI cost: ${totalRiCost}, savings: ${group.savingsAmount}, percentage: ${group.savingsPercentage}%`);
          // Update details with correct onDemandCost
          for (const detail of group.details) {
            detail.onDemandCost = group.onDemandCost / group.details.length; // Approximate per detail
          }
        }
      }
    }

    this.lastUnmatchedCount = unmatchedCount;
    console.log('[RiCostAggregation] Matching summary - matched:', matchedCount, 'unmatched:', unmatchedCount);
    console.log('[RiCostAggregation] Result has', Object.keys(result).length, 'months');

    return result;
  }

  aggregateMonthlyCostsByCostType(rows: RiRow[], pricingRecords: PricingRecord[], renewalOptions?: { upfrontPayment: string, durationMonths: number }): Record<string, Record<string, MonthlyCostData>> {
    console.log(`[RiCostAggregation] Starting cost-type aggregation with ${rows.length} RI rows and ${pricingRecords.length} pricing records`);
    // Load pricing into index
    this.loadPricingData(pricingRecords);

    console.log('[RiCostAggregation] Loaded pricing index with', this.matcherIndex.size, 'entries');

    const result: Record<string, Record<string, MonthlyCostData>> = {};

    let matchedCount = 0;
    let unmatchedCount = 0;
    this.lastUnmatchedCount = 0;
    this.lastUnmatchedSamples = [];

    // Reset error tracking
    this.lastErrors = {
      unmatchedPricing: [],
      invalidPricing: [],
      missingRates: [],
      zeroActiveDays: [],
      zeroCount: [],
      renewalErrors: []
    };

    for (const row of rows) {
      const criteria = new RiMatchingCriteria({
        instanceClass: row.instanceClass,
        region: row.region,
        multiAz: row.multiAz,
        engine: row.engine,
        edition: row.edition ?? null,
        upfrontPayment: row.upfrontPayment as any,
        durationMonths: row.durationMonths
      });
      const key = criteria.toKey();
      const pricing = this.matcherIndex.get(key);
      if (!pricing) {
        unmatchedCount++;
        const errorEntry = {
          key,
          row: {
            instanceClass: row.instanceClass,
            region: row.region,
            multiAz: String(row.multiAz),
            engine: row.engine,
            edition: row.edition ?? null,
            upfrontPayment: row.upfrontPayment,
            durationMonths: row.durationMonths,
            startDate: row.startDate,
            endDate: row.endDate ?? null,
            count: row.count ?? 1
          },
          reason: 'No matching pricing record found for this RI configuration'
        };
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push(errorEntry);
        }
        if (this.lastErrors.unmatchedPricing.length < this.UNMATCHED_CAP) {
          this.lastErrors.unmatchedPricing.push(errorEntry);
        }
        if (unmatchedCount <= 5) {
          console.warn('[RiCostAggregation] No pricing match for row key:', key);
        }
        continue;
      }

      // Validate pricing data
      if (pricing.dailyReservedRate && pricing.dailyOnDemandRate && pricing.dailyReservedRate > pricing.dailyOnDemandRate) {
        unmatchedCount++;
        const errorEntry = {
          key: key + ' (invalid pricing: reserved > on-demand)',
          row: {
            instanceClass: row.instanceClass,
            region: row.region,
            multiAz: String(row.multiAz),
            engine: row.engine,
            edition: row.edition ?? null,
            upfrontPayment: row.upfrontPayment,
            durationMonths: row.durationMonths,
            startDate: row.startDate,
            endDate: row.endDate ?? null,
            count: row.count ?? 1
          },
          reason: `Invalid pricing data: reserved rate (${pricing.dailyReservedRate}) > on-demand rate (${pricing.dailyOnDemandRate})`
        };
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push(errorEntry);
        }
        if (this.lastErrors.invalidPricing.length < this.UNMATCHED_CAP) {
          this.lastErrors.invalidPricing.push(errorEntry);
        }
        if (unmatchedCount <= 5) {
          console.warn('[RiCostAggregation] Invalid pricing data for row key:', key, 'reserved rate > on-demand rate');
        }
        continue;
      }
      matchedCount++;

      const start = new Date(row.startDate + 'T00:00:00Z');
      const end = row.endDate ? new Date(row.endDate + 'T00:00:00Z') : null;

      // iterate months from start to end (or start + durationMonths)
      const monthsToCover: string[] = [];
      const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const lastMonth = end ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)) : null;

      const limitMonths = row.durationMonths || 1;
      let countedMonths = 0;

      while (true) {
        const monthKey = this.toMonthKey(current);
        monthsToCover.push(monthKey);
        countedMonths++;
        if (lastMonth && current.getUTCFullYear() === lastMonth.getUTCFullYear() && current.getUTCMonth() === lastMonth.getUTCMonth()) break;
        if (!lastMonth && countedMonths >= limitMonths) break;
        current.setUTCMonth(current.getUTCMonth() + 1);
        if (countedMonths > 2400) break;
      }

      for (const monthKey of monthsToCover) {
        // compute month start/end
        const [y, m] = monthKey.split('-').map((v) => parseInt(v, 10));
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 0));

        // determine active days in this month
        const activeStart = start > monthStart ? start : monthStart;
        const activeEnd = end && end < monthEnd ? end : monthEnd;
        const activeDays = Math.max(0, Math.ceil((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        if (!(row.count || 1)) {
          this.addZeroCountError(key, row);
        }

        if (activeDays === 0) {
          this.addZeroActiveDaysError(key, row, monthKey, activeDays);
        }

        const count = row.count || 1;
        const dailyReservedRate = pricing.dailyReservedRate ?? 0;
        const dailyOnDemandRate = pricing.dailyOnDemandRate ?? 0;

        if (!pricing.dailyReservedRate) {
          this.addMissingRateError(key, row, pricing, 'reserved');
        }

        if (!pricing.dailyOnDemandRate) {
          this.addMissingRateError(key, row, pricing, 'onDemand');
        }

        // Calculate costs for this month
        const recurringCost = dailyReservedRate * activeDays * count;
        const onDemandCost = dailyOnDemandRate * activeDays * count;
        const isFirstMonth = start.getUTCFullYear() === monthStart.getUTCFullYear() && start.getUTCMonth() === monthStart.getUTCMonth();
        const upfront = isFirstMonth ? (pricing.upfrontCost ?? 0) * count : 0;

        // Group by cost type
        const costTypes = [
          { key: 'Savings Upfront', cost: upfront, onDemandCost: 0 },
          { key: 'Savings Monthly', cost: recurringCost, onDemandCost: 0 },
          { key: 'On Demand Monthly', cost: 0, onDemandCost: onDemandCost }
        ];

        for (const costType of costTypes) {
          if (!result[monthKey]) result[monthKey] = {};
          if (!result[monthKey][costType.key]) {
            result[monthKey][costType.key] = {
              monthKey,
              groupKey: costType.key,
              riCost: 0,
              onDemandCost: 0,
              savingsAmount: 0,
              savingsPercentage: 0,
              details: [],
              coveredPeriods: []
            };
          }

          result[monthKey][costType.key].riCost += costType.cost;
          result[monthKey][costType.key].onDemandCost += costType.onDemandCost;

          // Add covered period
          result[monthKey][costType.key].coveredPeriods!.push({ start: activeStart, end: activeEnd, count });

          // Update savings
          result[monthKey][costType.key].savingsAmount = result[monthKey][costType.key].onDemandCost - result[monthKey][costType.key].riCost;
          result[monthKey][costType.key].savingsPercentage = result[monthKey][costType.key].onDemandCost > 0 ?
            (1 - result[monthKey][costType.key].riCost / result[monthKey][costType.key].onDemandCost) * 100 : 0;

          result[monthKey][costType.key].details.push({
            row,
            pricing,
            recurringCost: costType.key === 'Savings Monthly' ? recurringCost : 0,
            upfront: costType.key === 'Savings Upfront' ? upfront : 0,
            activeDays,
            onDemandCost: costType.onDemandCost
          });
        }
      }
    }

    // Calculate renewal projections for cost-type aggregation
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const projectionEnd = new Date(Date.UTC(currentYear + 1, 11, 31));

    const expiringRis = this.detectExpiringRis(rows, projectionEnd);
    console.log('[RiCostAggregation] Found', expiringRis.length, 'expiring RIs for renewal projection (cost-type)');

    for (const expiringRi of expiringRis) {
      const renewalProjection = this.calculateRenewalProjection(expiringRi, this.matcherIndex, renewalOptions);
      if (!renewalProjection) continue;

      const renewalMonths: string[] = [];
      const renewalCurrent = new Date(renewalProjection.renewalStart);

      const maxMonths = renewalOptions?.durationMonths || expiringRi.durationMonths || 12;
      let renewalMonthCount = 0;

      while (renewalCurrent <= projectionEnd && renewalMonthCount < maxMonths) {
        const monthKey = this.toMonthKey(renewalCurrent);
        renewalMonths.push(monthKey);
        renewalCurrent.setUTCMonth(renewalCurrent.getUTCMonth() + 1);
        renewalMonthCount++;
      }

      for (const monthKey of renewalMonths) {
        if (!result[monthKey]) result[monthKey] = {};

        const [y, m] = monthKey.split('-').map((v) => parseInt(v, 10));
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 0));

        const renewalStartDate = renewalProjection.renewalStart;
        const renewalEndDate = renewalProjection.renewalEnd;

        const activeStart = renewalStartDate > monthStart ? renewalStartDate : monthStart;
        const activeEnd = renewalEndDate && renewalEndDate < monthEnd ? renewalEndDate : monthEnd;
        const activeDays = Math.max(0, Math.ceil((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const dailyRate = renewalProjection.pricing.dailyReservedRate ?? 0;
        const count = expiringRi.count || 1;

        const renewalCost = dailyRate * activeDays * count;

        // Add upfront cost for "All Upfront" renewals in the first month of renewal
        const isFirstRenewalMonth = renewalProjection.renewalStart.getUTCFullYear() === monthStart.getUTCFullYear() &&
                                   renewalProjection.renewalStart.getUTCMonth() === monthStart.getUTCMonth();
        const renewalUpfront = (renewalOptions?.upfrontPayment === 'All Upfront' && isFirstRenewalMonth) ?
                              (renewalProjection.pricing.upfrontCost ?? 0) * count : 0;

        // Add renewal cost to appropriate cost-type groups
        if (renewalOptions?.upfrontPayment === 'All Upfront') {
          // For All Upfront, add upfront to "Savings Upfront" and recurring to "Savings Monthly"
          if (!result[monthKey]['Savings Upfront']) {
            result[monthKey]['Savings Upfront'] = {
              monthKey,
              groupKey: 'Savings Upfront',
              riCost: 0,
              onDemandCost: 0,
              savingsAmount: 0,
              savingsPercentage: 0,
              details: [],
              coveredPeriods: []
            };
          }

          if (!result[monthKey]['Savings Monthly']) {
            result[monthKey]['Savings Monthly'] = {
              monthKey,
              groupKey: 'Savings Monthly',
              riCost: 0,
              onDemandCost: 0,
              savingsAmount: 0,
              savingsPercentage: 0,
              details: [],
              coveredPeriods: []
            };
          }

          result[monthKey]['Savings Upfront'].renewalCost = (result[monthKey]['Savings Upfront'].renewalCost || 0) + renewalUpfront;
          result[monthKey]['Savings Monthly'].renewalCost = (result[monthKey]['Savings Monthly'].renewalCost || 0) + renewalCost;

          result[monthKey]['Savings Upfront'].coveredPeriods!.push({ start: activeStart, end: activeEnd, count });
          result[monthKey]['Savings Monthly'].coveredPeriods!.push({ start: activeStart, end: activeEnd, count });

          // Update savings for both groups
          result[monthKey]['Savings Upfront'].savingsAmount = result[monthKey]['Savings Upfront'].onDemandCost - (result[monthKey]['Savings Upfront'].riCost + (result[monthKey]['Savings Upfront'].renewalCost || 0));
          result[monthKey]['Savings Upfront'].savingsPercentage = result[monthKey]['Savings Upfront'].onDemandCost > 0 ?
            (1 - (result[monthKey]['Savings Upfront'].riCost + (result[monthKey]['Savings Upfront'].renewalCost || 0)) / result[monthKey]['Savings Upfront'].onDemandCost) * 100 : 0;

          result[monthKey]['Savings Monthly'].savingsAmount = result[monthKey]['Savings Monthly'].onDemandCost - (result[monthKey]['Savings Monthly'].riCost + (result[monthKey]['Savings Monthly'].renewalCost || 0));
          result[monthKey]['Savings Monthly'].savingsPercentage = result[monthKey]['Savings Monthly'].onDemandCost > 0 ?
            (1 - (result[monthKey]['Savings Monthly'].riCost + (result[monthKey]['Savings Monthly'].renewalCost || 0)) / result[monthKey]['Savings Monthly'].onDemandCost) * 100 : 0;

          result[monthKey]['Savings Upfront'].details.push({
            row: expiringRi,
            pricing: renewalProjection.pricing,
            recurringCost: 0,
            upfront: renewalUpfront,
            activeDays,
            onDemandCost: 0,
            isRenewal: true
          });

          result[monthKey]['Savings Monthly'].details.push({
            row: expiringRi,
            pricing: renewalProjection.pricing,
            recurringCost: renewalCost,
            upfront: 0,
            activeDays,
            onDemandCost: 0,
            isRenewal: true
          });
        } else {
          // For other payment types, add everything to "Savings Monthly"
          if (!result[monthKey]['Savings Monthly']) {
            result[monthKey]['Savings Monthly'] = {
              monthKey,
              groupKey: 'Savings Monthly',
              riCost: 0,
              onDemandCost: 0,
              savingsAmount: 0,
              savingsPercentage: 0,
              details: [],
              coveredPeriods: []
            };
          }

          result[monthKey]['Savings Monthly'].renewalCost = (result[monthKey]['Savings Monthly'].renewalCost || 0) + renewalCost + renewalUpfront;
          result[monthKey]['Savings Monthly'].coveredPeriods!.push({ start: activeStart, end: activeEnd, count });

          // Update savings
          const totalRiCost = result[monthKey]['Savings Monthly'].riCost + (result[monthKey]['Savings Monthly'].renewalCost || 0);
          result[monthKey]['Savings Monthly'].savingsAmount = result[monthKey]['Savings Monthly'].onDemandCost - totalRiCost;
          result[monthKey]['Savings Monthly'].savingsPercentage = result[monthKey]['Savings Monthly'].onDemandCost > 0 ?
            (1 - totalRiCost / result[monthKey]['Savings Monthly'].onDemandCost) * 100 : 0;

          result[monthKey]['Savings Monthly'].details.push({
            row: expiringRi,
            pricing: renewalProjection.pricing,
            recurringCost: renewalCost,
            upfront: renewalUpfront,
            activeDays,
            onDemandCost: 0,
            isRenewal: true
          });
        }
      }
    }

    this.lastUnmatchedCount = unmatchedCount;
    console.log('[RiCostAggregation] Cost-type aggregation summary - matched:', matchedCount, 'unmatched:', unmatchedCount);
    console.log('[RiCostAggregation] Result has', Object.keys(result).length, 'months');

    return result;
  }

  calculateSavingsBreakdown(monthlyData: Record<string, Record<string, MonthlyCostData>>): SavingsBreakdown {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1; // 1-based

    let year1Savings = 0;
    let year2Savings = 0;
    let year1Months = 0;
    let year2Months = 0;

    // Iterate through all months in the data
    for (const monthKey of Object.keys(monthlyData).sort((a, b) => a.localeCompare(b))) {
      const [year, month] = monthKey.split('-').map((v) => Number.parseInt(v, 10));

      if (year === currentYear) {
        // Current year - count from current month onward
        if (month >= currentMonth) {
          year1Months++;
          for (const groupData of Object.values(monthlyData[monthKey])) {
            // Recalculate savings to include renewal costs if present
            const totalCost = groupData.riCost + (groupData.renewalCost || 0);
            const actualSavings = groupData.onDemandCost - totalCost;
            year1Savings += actualSavings;
          }
        }
      } else if (year === currentYear + 1) {
        // Next year - full year
        year2Months++;
        for (const groupData of Object.values(monthlyData[monthKey])) {
          // Recalculate savings to include renewal costs if present
          const totalCost = groupData.riCost + (groupData.renewalCost || 0);
          const actualSavings = groupData.onDemandCost - totalCost;
          year2Savings += actualSavings;
        }
      }
    }

    const year1: SavingsYearData = {
      year: currentYear,
      months: year1Months,
      totalSavings: year1Savings,
      label: year1Months > 0 ? `${currentYear} (${new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'short' })}-Dec)` : `${currentYear}`
    };

    const year2: SavingsYearData = {
      year: currentYear + 1,
      months: year2Months,
      totalSavings: year2Savings,
      label: `${currentYear + 1} (Jan-Dec)`
    };

    return {
      year1,
      year2,
      total: year1Savings + year2Savings
    };
  }
}
