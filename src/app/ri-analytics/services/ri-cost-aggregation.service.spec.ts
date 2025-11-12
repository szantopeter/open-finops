import { TestBed } from '@angular/core/testing';

import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { PricingRecord } from '../models/pricing-record.model';

interface SampleRiRow {
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

describe('RiCostAggregationService (TDD)', () => {
  let service: RiCostAggregationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiCostAggregationService);
  });

  it('prorates monthly cost for mid-month start', () => {
    // An RI with monthly recurring dailyReservedRate = 30/day, starts on 2025-11-16 (15 days active in Nov)
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 30
    });

    const ri: SampleRiRow = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      startDate: '2025-11-16',
      count: 1
    };

    const aggregates = service.aggregateMonthlyCosts([ri as any], [pricing]);

    // For November 2025: days in month = 30, active days = 15 (16..30 inclusive)
    // expected cost = dailyReservedRate * activeDays = 30 * 15 = 450
    const novKey = '2025-11';
    const nov = aggregates[novKey];
    expect(nov).toBeDefined();
    const groupKeys = Object.keys(nov || {});
    expect(groupKeys.length).toBeGreaterThan(0);
    const total = Object.values(nov || {}).reduce((s: number, v: any) => s + v.riCost, 0);
    expect(total).toBeCloseTo(450, 2);
  });

  it('charges upfront in first month only', () => {
    // Upfront cost should be applied only in the month containing startDate
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 36,
      upfrontCost: 3600,
      dailyReservedRate: 10
    });

    const ri = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 36,
      startDate: '2025-09-10',
      count: 1
    } as SampleRiRow;

    const aggregates = service.aggregateMonthlyCosts([ri as any], [pricing]);
    const sep = aggregates['2025-09'];
    const oct = aggregates['2025-10'];
    expect(sep).toBeDefined();
    const sepTotal = Object.values(sep || {}).reduce((s: number, v: any) => s + v.riCost, 0);
    expect(sepTotal).toBeGreaterThanOrEqual(3600);
    // In October the upfront should not be present (only recurring)
    const octTotal = Object.values(oct || {}).reduce((s: number, v: any) => s + v.riCost, 0);
    expect(octTotal).toBeLessThan(3600);
  });

  it('calculates on-demand cost correctly', () => {
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 30,
      dailyOnDemandRate: 50
    });

    const ri: SampleRiRow = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      startDate: '2025-11-01',
      count: 1
    };

    const aggregates = service.aggregateMonthlyCosts([ri as any], [pricing]);

    const novKey = '2025-11';
    const nov = aggregates[novKey];
    expect(nov).toBeDefined();
    const groupKeys = Object.keys(nov || {});
    expect(groupKeys.length).toBeGreaterThan(0);
    const group = nov[groupKeys[0]];
    // November has 30 days, so on-demand cost = 50 * 30 = 1500
    expect(group.onDemandCost).toBeCloseTo(1500, 2);
  });

  it('calculates savings correctly', () => {
    const pricing = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 30,
      dailyOnDemandRate: 50
    });

    const ri: SampleRiRow = {
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: null,
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      startDate: '2025-11-01',
      count: 1
    };

    const aggregates = service.aggregateMonthlyCosts([ri as any], [pricing]);

    const novKey = '2025-11';
    const nov = aggregates[novKey];
    const group = nov[Object.keys(nov)[0]];
    // RI cost = 30 * 30 = 900, on-demand = 50 * 30 = 1500
    // savings amount = 1500 - 900 = 600
    // savings % = (1 - 900/1500) * 100 = 40
    expect(group.savingsAmount).toBeCloseTo(600, 2);
    expect(group.savingsPercentage).toBeCloseTo(40, 2);
  });
});
