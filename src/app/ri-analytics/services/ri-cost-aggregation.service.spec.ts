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

  describe('Renewal Functionality', () => {
    it('detectExpiringRis filters RIs that expire before projection end', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const projectionEnd = new Date(Date.UTC(currentYear + 1, 11, 31)); // End of next year

      const rows: SampleRiRow[] = [
        // RI that expires before projection end
        {
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          startDate: '2024-01-01',
          endDate: `${currentYear}-06-30`, // Expires this year
          count: 1
        },
        // RI that expires after projection end
        {
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          startDate: '2024-01-01',
          endDate: `${currentYear + 2}-01-01`, // Expires in 2 years
          count: 1
        },
        // Ongoing RI (no end date)
        {
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          startDate: '2024-01-01',
          count: 1
        }
      ];

      // Access private method via type assertion
      const expiringRis = (service as any).detectExpiringRis(rows as any[], projectionEnd);

      expect(expiringRis.length).toBe(1);
      expect(expiringRis[0].endDate).toBe(`${currentYear}-06-30`);
    });

    it('calculateRenewalProjection returns null for ongoing RIs', () => {
      const pricingIndex = new Map<string, PricingRecord>();

      const ongoingRi: SampleRiRow = {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        count: 1
        // No endDate - ongoing RI
      };

      const projection = (service as any).calculateRenewalProjection(ongoingRi as any, pricingIndex);
      expect(projection).toBeNull();
    });

    it('calculateRenewalProjection returns null when no matching pricing', () => {
      const pricingIndex = new Map<string, PricingRecord>();

      const expiredRi: SampleRiRow = {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 1
      };

      const projection = (service as any).calculateRenewalProjection(expiredRi as any, pricingIndex);
      expect(projection).toBeNull();
    });

    it('calculateRenewalProjection calculates correct renewal costs', () => {
      const pricing = new PricingRecord({
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        dailyReservedRate: 25.5,
        dailyOnDemandRate: 45
      });

      const pricingIndex = new Map<string, PricingRecord>();
      pricingIndex.set('db.r5.large|us-east-1|false|mysql||no upfront|12', pricing);

      const expiredRi: SampleRiRow = {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 2
      };

      const projection = (service as any).calculateRenewalProjection(expiredRi as any, pricingIndex);

      expect(projection).toBeTruthy();
      expect(projection.originalRi).toBe(expiredRi);
      expect(projection.pricing).toBe(pricing);
      // Monthly cost = dailyRate * 30 * count = 25.50 * 30 * 2 = 1530
      expect(projection.monthlyCost).toBe(1530);
      // Renewal starts January 1st, 2025 (month after expiration)
      expect(projection.renewalStart.getUTCFullYear()).toBe(2025);
      expect(projection.renewalStart.getUTCMonth()).toBe(0); // January (0-based)
      expect(projection.renewalStart.getUTCDate()).toBe(1);
    });

    it('calculateRenewalProjection handles different count values', () => {
      const pricing = new PricingRecord({
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        dailyReservedRate: 20,
        dailyOnDemandRate: 40
      });

      const pricingIndex = new Map<string, PricingRecord>();
      pricingIndex.set('db.r5.large|us-east-1|false|mysql||no upfront|12', pricing);

      const testCases = [
        { count: 1, expectedCost: 600 }, // 20 * 30 * 1
        { count: 3, expectedCost: 1800 }, // 20 * 30 * 3
        { count: undefined, expectedCost: 600 } // Default to 1
      ];

      for (const { count, expectedCost } of testCases) {
        const expiredRi: SampleRiRow = {
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          count
        };

        const projection = (service as any).calculateRenewalProjection(expiredRi as any, pricingIndex);
        expect(projection.monthlyCost).toBe(expectedCost);
      }
    });

    it('calculateSavingsBreakdown aggregates savings by year correctly', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;

      // Create mock monthly data
      const monthlyData: Record<string, Record<string, any>> = {};

      // Add data for current year (remaining months)
      for (let month = currentMonth; month <= 12; month++) {
        const monthKey = `${currentYear}-${month.toString().padStart(2, '0')}`;
        monthlyData[monthKey] = {
          'MySQL RIs': {
            savingsAmount: 1000,
            riCost: 2000,
            onDemandCost: 3000,
            renewalCost: 0
          }
        };
      }

      // Add data for next year (full year)
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${currentYear + 1}-${month.toString().padStart(2, '0')}`;
        monthlyData[monthKey] = {
          'MySQL RIs': {
            savingsAmount: 1500,
            riCost: 2500,
            onDemandCost: 4000,
            renewalCost: 0
          }
        };
      }

      const breakdown = service.calculateSavingsBreakdown(monthlyData as any);

      const remainingMonthsInYear1 = 13 - currentMonth;
      expect(breakdown.year1.months).toBe(remainingMonthsInYear1);
      expect(breakdown.year1.totalSavings).toBe(1000 * remainingMonthsInYear1);
      expect(breakdown.year1.year).toBe(currentYear);

      expect(breakdown.year2.months).toBe(12);
      expect(breakdown.year2.totalSavings).toBe(1500 * 12);
      expect(breakdown.year2.year).toBe(currentYear + 1);

      expect(breakdown.total).toBe(breakdown.year1.totalSavings + breakdown.year2.totalSavings);
    });

    it('calculateSavingsBreakdown handles empty data', () => {
      const monthlyData: Record<string, Record<string, any>> = {};

      const breakdown = service.calculateSavingsBreakdown(monthlyData as any);

      expect(breakdown.year1.months).toBe(0);
      expect(breakdown.year1.totalSavings).toBe(0);
      expect(breakdown.year2.months).toBe(0);
      expect(breakdown.year2.totalSavings).toBe(0);
      expect(breakdown.total).toBe(0);
    });

    it('calculateSavingsBreakdown includes renewal costs in savings calculation', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();

      const monthlyData: Record<string, Record<string, any>> = {
        [`${currentYear}-12`]: {
          'MySQL RIs': {
            savingsAmount: 500, // Original savings
            riCost: 1000,
            onDemandCost: 2000,
            renewalCost: 300 // Additional renewal cost reduces savings
          }
        }
      };

      const breakdown = service.calculateSavingsBreakdown(monthlyData as any);

      // Savings should be onDemand - (riCost + renewalCost) = 2000 - (1000 + 300) = 700
      expect(breakdown.year1.totalSavings).toBe(700);
    });

    it('aggregateMonthlyCosts includes renewal projections in results', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();

      // RI that expires this year
      const expiredRi: SampleRiRow = {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: `${currentYear}-06-30`,
        count: 1
      };

      const pricing = new PricingRecord({
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        dailyReservedRate: 25,
        dailyOnDemandRate: 50
      });

      const aggregates = service.aggregateMonthlyCosts([expiredRi as any], [pricing]);

      // Check that renewal months have renewalCost
      const renewalMonthKey = `${currentYear}-07`; // July (first month after expiration)
      expect(aggregates[renewalMonthKey]).toBeDefined();

      const groupData = Object.values(aggregates[renewalMonthKey])[0] as any;
      expect(groupData.renewalCost).toBeDefined();
      expect(groupData.renewalCost).toBeGreaterThan(0);

      // Check that on-demand cost is also calculated for renewal period
      expect(groupData.onDemandCost).toBeGreaterThan(0);
    });

    it('aggregateMonthlyCosts handles RIs with no matching renewal pricing', () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();

      // RI that expires but has no matching pricing for renewal
      const expiredRi: SampleRiRow = {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        upfrontPayment: 'All Upfront', // Different upfront payment
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: `${currentYear}-06-30`,
        count: 1
      };

      const pricing = new PricingRecord({
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'No Upfront', // Doesn't match RI upfront payment
        durationMonths: 12,
        dailyReservedRate: 25,
        dailyOnDemandRate: 50
      });

      const aggregates = service.aggregateMonthlyCosts([expiredRi as any], [pricing]);

      // Should not have any data since upfront payments don't match
      const originalMonthKey = `${currentYear}-06`;
      expect(aggregates[originalMonthKey]).toBeUndefined();

      // Renewal month should not exist when there's no matching renewal pricing
      const renewalMonthKey = `${currentYear}-07`;
      expect(aggregates[renewalMonthKey]).toBeUndefined();
    });
  });
});
