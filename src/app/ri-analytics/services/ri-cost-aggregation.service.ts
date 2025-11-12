import { Injectable } from '@angular/core';

import { MonthlyCostData } from '../models/monthly-cost-data.model';
import { PricingRecord } from '../models/pricing-record.model';
import { RiMatchingCriteria } from '../models/ri-matching-criteria.model';

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

  constructor() {}

  private toHumanReadableKey(criteria: RiMatchingCriteria): string {
    const az = criteria.multiAz ? 'Multi AZ' : 'Single AZ';
    const edition = criteria.edition ? ` ${criteria.edition}` : '';
    return `${criteria.instanceClass} ${criteria.region} ${az} ${criteria.engine}${edition}`;
  }

  private toMonthKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
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

  aggregateMonthlyCosts(rows: RiRow[], pricingRecords: PricingRecord[]): Record<string, Record<string, MonthlyCostData>> {
    // Load pricing into index
    this.loadPricingData(pricingRecords);

    console.log('[RiCostAggregation] Loaded pricing index with', this.matcherIndex.size, 'entries');
    console.log('[RiCostAggregation] Sample pricing keys:', Array.from(this.matcherIndex.keys()).slice(0, 3));

    const result: Record<string, Record<string, MonthlyCostData>> = {};

    let matchedCount = 0;
    let unmatchedCount = 0;
    this.lastUnmatchedCount = 0;
    this.lastUnmatchedSamples = [];

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
        // store up to UNMATCHED_CAP samples for UI consumption
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push({ key, row: {
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
          } });
        }
        // keep console noise limited to the first few unmatched rows for debugging
        if (unmatchedCount <= 5) {
          console.warn('[RiCostAggregation] No pricing match for row key:', key);
          console.warn('[RiCostAggregation] Row fields:', this.lastUnmatchedSamples[this.lastUnmatchedSamples.length - 1].row);
        }
        // skip unmatched
        continue;
      }

      // Validate pricing data: reserved rate must be <= on-demand rate
      if (pricing.dailyReservedRate && pricing.dailyOnDemandRate && pricing.dailyReservedRate > pricing.dailyOnDemandRate) {
        unmatchedCount++;
        if (this.lastUnmatchedSamples.length < this.UNMATCHED_CAP) {
          this.lastUnmatchedSamples.push({ key: key + ' (invalid pricing: reserved > on-demand)', row: {
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
          } });
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

        // compute costs
        const dailyRate = pricing.dailyReservedRate ?? 0;
        const recurringCost = dailyRate * activeDays * (row.count || 1);

        // upfront only in the month containing the start date
        const isFirstMonth = start.getUTCFullYear() === monthStart.getUTCFullYear() && start.getUTCMonth() === monthStart.getUTCMonth();
        const upfront = isFirstMonth ? (pricing.upfrontCost ?? 0) * (row.count || 1) : 0;

        const total = recurringCost + upfront;

        if (!result[monthKey]) result[monthKey] = {};
        const groupKey = this.toHumanReadableKey(criteria);
        if (!result[monthKey][groupKey]) result[monthKey][groupKey] = { monthKey, groupKey, riCost: 0, onDemandCost: 0, savingsAmount: 0, savingsPercentage: 0, details: [] };
        result[monthKey][groupKey].riCost += total;

        // calculate on-demand cost
        const onDemandDailyRate = pricing.dailyOnDemandRate ?? 0;
        const onDemandCost = onDemandDailyRate * activeDays * (row.count || 1);
        result[monthKey][groupKey].onDemandCost += onDemandCost;

        // update savings
        result[monthKey][groupKey].savingsAmount = result[monthKey][groupKey].onDemandCost - result[monthKey][groupKey].riCost;
        result[monthKey][groupKey].savingsPercentage = result[monthKey][groupKey].onDemandCost > 0 ? (1 - result[monthKey][groupKey].riCost / result[monthKey][groupKey].onDemandCost) * 100 : 0;

        result[monthKey][groupKey].details.push({ row, pricing, recurringCost, upfront, activeDays, onDemandCost });
      }
    }

    this.lastUnmatchedCount = unmatchedCount;
    console.log('[RiCostAggregation] Matching summary - matched:', matchedCount, 'unmatched:', unmatchedCount);
    console.log('[RiCostAggregation] Result has', Object.keys(result).length, 'months');

    return result;
  }
}
