import { TestBed } from '@angular/core/testing';

import { RiPricingMatcherService } from './ri-pricing-matcher.service';
import { PricingRecord } from '../models/pricing-record.model';
import { RiMatchingCriteria } from '../models/ri-matching-criteria.model';

describe('RiPricingMatcherService', () => {
  let service: RiPricingMatcherService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiPricingMatcherService);
  });

  it('should match an exact pricing record', () => {
    const record = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 1.5
    });

    service.loadPricingData([record]);

    const criteria = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36
    });

    const result = service.matchRiToPricing(criteria);
    expect(result.matched).toBeTrue();
    expect(result.pricing).toBeDefined();
    expect(result.pricing).toEqual(record);
  });

  it('should return unmatched for missing pricing', () => {
    service.loadPricingData([]);
    const criteria = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36
    });
    const result = service.matchRiToPricing(criteria);
    expect(result.matched).toBeFalse();
    expect(result.reason).toContain('no pricing match');
  });

  it('batchMatchRisToPricing returns results for each criteria', () => {
    const record = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 1.5
    });
    service.loadPricingData([record]);

    const criteriaA = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36
    });

    const criteriaB = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'eu-west-1',
      multiAz: false,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36
    });

    const results = service.batchMatchRisToPricing([criteriaA, criteriaB]);
    expect(results.length).toBe(2);
    expect(results[0].result.matched).toBeTrue();
    expect(results[1].result.matched).toBeFalse();
  });
});
