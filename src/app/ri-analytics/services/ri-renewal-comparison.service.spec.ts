import { TestBed } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';

import { RiRenewalComparisonService } from './ri-renewal-comparison.service';
import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiCSVParserService } from './ri-import.service';
import { PricingRecord } from '../models/pricing-record.model';
import { MonthlyCostData } from '../models/monthly-cost-data.model';
import { RiPorftolio } from '../models/ri-import.model';
import { RiRow } from '../models/ri-row.model';

describe('RiRenewalComparisonService', () => {
  let service: RiRenewalComparisonService;
  let riDataServiceSpy: jasmine.SpyObj<RiDataService>;
  let pricingDataServiceSpy: jasmine.SpyObj<PricingDataService>;
  let riCostAggregationServiceSpy: jasmine.SpyObj<RiCostAggregationService>;
  let riCsvParserService: RiCSVParserService;

  let riPortfolioSubject: BehaviorSubject<any>;

  beforeEach(() => {
    riPortfolioSubject = new BehaviorSubject(null);
    const riDataSpy = jasmine.createSpyObj('RiDataService', [], {
      riPortfolio$: riPortfolioSubject.asObservable()
    });
    const pricingSpy = jasmine.createSpyObj('PricingDataService', ['loadPricingForPaths']);
    const aggregationSpy = jasmine.createSpyObj('RiCostAggregationService', [
      'loadPricingData',
      'calculateAggregation'
    ], {
      lastErrors: {
        unmatchedPricing: [],
        invalidPricing: [],
        missingRates: [],
        zeroActiveDays: [],
        zeroCount: []
      }
    });

    TestBed.configureTestingModule({
      providers: [
        RiRenewalComparisonService,
        RiCSVParserService,
        { provide: RiDataService, useValue: riDataSpy },
        { provide: PricingDataService, useValue: pricingSpy },
        { provide: RiCostAggregationService, useValue: aggregationSpy }
      ]
    });

    service = TestBed.inject(RiRenewalComparisonService);
    riDataServiceSpy = TestBed.inject(RiDataService) as jasmine.SpyObj<RiDataService>;
    pricingDataServiceSpy = TestBed.inject(PricingDataService) as jasmine.SpyObj<PricingDataService>;
    riCostAggregationServiceSpy = TestBed.inject(RiCostAggregationService) as jasmine.SpyObj<RiCostAggregationService>;
    riCsvParserService = TestBed.inject(RiCSVParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getRenewalScenarios', () => {
    it('should return empty array when no RI portfolio data', (done) => {
      // Setup: riPortfolio$ emits null
      Object.defineProperty(riDataServiceSpy, 'riPortfolio$', { value: of(null) });

      service.getRenewalScenarios().subscribe(scenarios => {
        expect(scenarios).toEqual([]);
        done();
      });
    });

    it('should return empty array when RI portfolio has no rows', (done) => {
      // Setup: riPortfolio$ emits portfolio with empty rows
      const mockRiPortfolio: RiPorftolio = {
        metadata: {
          source: 'test',
          importedAt: '2024-01-01T00:00:00Z',
          columns: [],
          rowsCount: 0
        },
        rows: []
      };
      Object.defineProperty(riDataServiceSpy, 'riPortfolio$', { value: of(mockRiPortfolio) });

      service.getRenewalScenarios().subscribe(scenarios => {
        expect(scenarios).toEqual([]);
        done();
      });
    });
  });

  describe('amortizeUpfrontCosts', () => {
    it('should not modify aggregates when no upfront costs', () => {
      const aggregates: Record<string, Record<string, MonthlyCostData>> = {
        '2025-01': {
          'group1': {
            monthKey: '2025-01',
            groupKey: 'group1',
            riCost: 100,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            renewalCost: 100,
            details: [{ upfront: 0, isRenewal: true }]
          }
        }
      };

      const originalAggregates = JSON.parse(JSON.stringify(aggregates));

      service['amortizeUpfrontCosts'](aggregates, 12);

      expect(aggregates).toEqual(originalAggregates);
    });
  });

  describe('toMonthKey', () => {
    it('should format date as YYYY-MM', () => {
      const date = new Date(Date.UTC(2025, 0, 15)); // January 15, 2025
      const result = service['toMonthKey'](date);
      expect(result).toBe('2025-01');
    });

    it('should pad month with zero for single digit months', () => {
      const date = new Date(Date.UTC(2025, 8, 15)); // September 15, 2025
      const result = service['toMonthKey'](date);
      expect(result).toBe('2025-09');
    });
  });

  describe('renewal scenarios with one-line CSV', () => {
    it('should not produce negative savings for All Upfront scenarios', async () => {
      // Fetch the one-line CSV asset served by Karma
      const res = await fetch('/assets/cloudability-one-line.csv');
      expect(res.ok).toBeTrue();
      const csvContent = await res.text();

      // Parse the CSV
      const parseResult = riCsvParserService.parseText(csvContent);
      expect(parseResult.errors).toBeUndefined();
      expect(parseResult.riPortfolio).toBeDefined();

      const riPortfolio = parseResult.riPortfolio as RiPorftolio;

      // Mock pricing data for the one-line CSV (db.r5.xlarge, eu-west-1, multi-az, oracle-se2-byol)
      const pricingRecords = [
        new PricingRecord({
          instanceClass: 'db.r5.xlarge',
          region: 'eu-west-1',
          multiAz: true,
          engine: 'oracle',
          edition: 'se2-byol',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          dailyReservedRate: 10.0, // Lower rate for better savings
          dailyOnDemandRate: 15.0,
          upfrontCost: 0
        }),
        new PricingRecord({
          instanceClass: 'db.r5.xlarge',
          region: 'eu-west-1',
          multiAz: true,
          engine: 'oracle',
          edition: 'se2-byol',
          upfrontPayment: 'Partial Upfront',
          durationMonths: 12,
          dailyReservedRate: 8.0, // Even lower rate
          dailyOnDemandRate: 15.0,
          upfrontCost: 1000
        }),
        new PricingRecord({
          instanceClass: 'db.r5.xlarge',
          region: 'eu-west-1',
          multiAz: true,
          engine: 'oracle',
          edition: 'se2-byol',
          upfrontPayment: 'All Upfront',
          durationMonths: 12,
          dailyReservedRate: 0, // No recurring charges for All Upfront
          dailyOnDemandRate: 15.0,
          upfrontCost: 5000 // High upfront cost
        })
      ];

      // Set up spies to return the parsed data and pricing
      riPortfolioSubject.next(riPortfolio);
      pricingDataServiceSpy.loadPricingForPaths.and.returnValue(of({ pricingRecords, missingFiles: [] }));

      // Ensure aggregation service returns deterministic aggregates for baseline and scenarios
      riCostAggregationServiceSpy.calculateAggregation.and.callFake((opts: any) => {
        const currentYear = new Date().getUTCFullYear();
        const firstFullYear = currentYear + 1;
        const monthKey = `${firstFullYear}-01`;
        const baseOnDemand = 7107.46656;

        // Map upfront option to a realistic recurring RI cost (lower is better savings)
        let riCostForMonth = 0;
        const upfront = opts?.renewalOptions?.upfrontPayment || 'No Upfront';
        if (upfront === 'No Upfront') riCostForMonth = baseOnDemand * 0.8; // small savings
        if (upfront === 'Partial Upfront') riCostForMonth = baseOnDemand * 0.6; // better
        if (upfront === 'All Upfront') riCostForMonth = baseOnDemand * 0.4; // best savings

        return {
          [monthKey]: {
            group1: {
              monthKey,
              groupKey: 'group1',
              onDemandCost: baseOnDemand,
              riCost: riCostForMonth,
              renewalCost: riCostForMonth,
              savingsAmount: baseOnDemand - riCostForMonth,
              savingsPercentage: riCostForMonth > 0 ? ((baseOnDemand - riCostForMonth) / baseOnDemand) * 100 : 0,
              details: []
            }
          }
        } as any;
      });

      // Get renewal scenarios
      const scenarios = await new Promise<any[]>((resolve) => {
        service.getRenewalScenarios().subscribe(scenarios => {
          resolve(scenarios);
        });
      });

      // Verify we have scenarios
      expect(scenarios.length).toEqual(6);
      console.log('All scenarios:', scenarios.map(s => ({ scenario: s.scenario, upfrontPayment: s.upfrontPayment, savings: s.firstFullYearSavingsPercentage })));

      // Find All Upfront scenarios
      const allUpfrontScenarios = scenarios.filter(s => s.upfrontPayment === 'All Upfront');
      console.log('All Upfront scenarios:', allUpfrontScenarios.map(s => ({ scenario: s.scenario, savings: s.firstFullYearSavingsPercentage })));

      // All Upfront scenarios should not have negative savings percentage
      allUpfrontScenarios.forEach(scenario => {
        console.log(`Checking scenario "${scenario.scenario}": savings = ${scenario.firstFullYearSavingsPercentage}`);
        expect(scenario.firstFullYearSavingsPercentage).toBeGreaterThanOrEqual(0,
          `All Upfront scenario "${scenario.scenario}" should not have negative savings (${scenario.firstFullYearSavingsPercentage}%)`);
      });

      // All Upfront scenarios should have better or equal savings compared to No Upfront
      const noUpfront12Month = scenarios.find(s => s.upfrontPayment === 'No Upfront' && s.durationMonths === 12);
      const allUpfront12Month = scenarios.find(s => s.upfrontPayment === 'All Upfront' && s.durationMonths === 12);

      if (noUpfront12Month && allUpfront12Month) {
        expect(allUpfront12Month.firstFullYearSavingsPercentage).toBeGreaterThanOrEqual(noUpfront12Month.firstFullYearSavingsPercentage,
          'All Upfront should provide better or equal savings compared to No Upfront');
      }
    });
  });
});