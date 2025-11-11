import { TestBed } from '@angular/core/testing';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { PricingRecord } from '../models/pricing-record.model';

describe('RiCostAggregationService extra edge cases', () => {
  let service: RiCostAggregationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiCostAggregationService);
  });

  it('prorates correctly when RI ends mid-month', () => {
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 10,
    });

    const ri = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      startDate: '2025-11-01',
      endDate: '2025-11-20', // active 20 days in Nov
      count: 1,
    } as any;

    const aggregates = service.aggregateMonthlyCosts([ri], [pricing]);
    const nov = aggregates['2025-11'];
    expect(nov).toBeDefined();
    const total = Object.values(nov || {}).reduce((s: number, v: any) => s + v.totalCost, 0);
    // expected 10 * 20 = 200
    expect(total).toBeCloseTo(200, 6);
  });

  it('aggregates multiple RIs in same group into one stacked total', () => {
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 2,
    });

    const riA = { ...pricing, startDate: '2025-11-01', count: 1 } as any;
    const riB = { ...pricing, startDate: '2025-11-01', count: 2 } as any; // two instances

    const aggregates = service.aggregateMonthlyCosts([riA, riB], [pricing]);
    const nov = aggregates['2025-11'];
    expect(nov).toBeDefined();
    // day count for November = 30, recurring = dailyRate * days * totalCount = 2 * 30 * 3 = 180
    const total = Object.values(nov || {}).reduce((s: number, v: any) => s + v.totalCost, 0);
    expect(total).toBeCloseTo(180, 6);
  });

  it('respects count>1 multiplier for upfront and recurring', () => {
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 36,
      upfrontCost: 1000,
      dailyReservedRate: 1,
    });

    const ri = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 36,
      startDate: '2025-11-01',
      count: 3,
    } as any;

    const aggregates = service.aggregateMonthlyCosts([ri], [pricing]);
    const nov = aggregates['2025-11'];
    expect(nov).toBeDefined();
    const total = Object.values(nov || {}).reduce((s: number, v: any) => s + v.totalCost, 0);
    // upfront = 1000 * 3 = 3000, recurring = daily * days * count = 1 * 30 * 3 = 90, total = 3090
    expect(total).toBeCloseTo(3090, 6);
  });
});
