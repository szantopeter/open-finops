import { Injectable } from '@angular/core';
import { PricingRecord } from '../models/pricing-record.model';
import { RiMatchingCriteria } from '../models/ri-matching-criteria.model';

export type MatchResult = { matched: boolean; pricing?: PricingRecord; reason?: string };

@Injectable({ providedIn: 'root' })
export class RiPricingMatcherService {
  private index = new Map<string, PricingRecord>();

  constructor() {}

  /**
   * Load pricing data array into an internal index for fast exact-match lookup
   */
  loadPricingData(records: PricingRecord[]) {
    this.index.clear();
    for (const r of records) {
      const key = new RiMatchingCriteria({
        instanceClass: r.instanceClass,
        region: r.region,
        multiAz: r.multiAz,
        engine: r.engine,
        edition: r.edition ?? null,
        upfrontPayment: r.upfrontPayment,
        durationMonths: r.durationMonths,
      }).toKey();
      this.index.set(key, r);
    }
  }

  matchRiToPricing(criteria: RiMatchingCriteria): MatchResult {
    if (!criteria) return { matched: false, reason: 'no criteria provided' };
    const key = criteria.toKey();
    const pricing = this.index.get(key);
    if (!pricing) return { matched: false, reason: 'no pricing match found' };
    // Validate pricing completeness
    const validation = pricing.validate ? pricing.validate() : { valid: true, errors: [] };
    if (!validation.valid) return { matched: false, reason: `pricing invalid: ${validation.errors.join(', ')}` };
    return { matched: true, pricing };
  }

  batchMatchRisToPricing(criteriaList: RiMatchingCriteria[]): Array<{ criteria: RiMatchingCriteria; result: MatchResult }> {
    return criteriaList.map((c) => ({ criteria: c, result: this.matchRiToPricing(c) }));
  }
}
