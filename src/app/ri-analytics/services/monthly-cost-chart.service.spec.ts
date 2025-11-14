import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MonthlyCostChartService } from './monthly-cost-chart.service';
import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiCSVParserService } from './ri-import.service';
import { PricingRecord } from '../models/pricing-record.model';
import { RiRow } from '../models/ri-row.model';

describe('MonthlyCostChartService - End-to-End Business Logic Test', () => {
  let service: MonthlyCostChartService;
  let riDataService: RiDataService;
  let pricingDataService: jasmine.SpyObj<PricingDataService>;
  let parserService: RiCSVParserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const pricingSpy = jasmine.createSpyObj('PricingDataService', ['loadPricingForPaths']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MonthlyCostChartService,
        RiDataService,
        RiCSVParserService,
        RiCostAggregationService,
        { provide: PricingDataService, useValue: pricingSpy }
      ]
    });

    service = TestBed.inject(MonthlyCostChartService);
    riDataService = TestBed.inject(RiDataService);
    pricingDataService = pricingSpy;
    parserService = TestBed.inject(RiCSVParserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should have consistent savings percentages across years when full CSV is loaded', async () => {
    // Fetch the full CSV asset served by Karma (assets/ is available at /assets)
    const res = await fetch('/assets/cloudability-rds-reservations.csv');
    if (!res.ok) {
      fail('Failed to fetch CSV asset');
      return;
    }
    const csvContent = await res.text();

    const parseResult = parserService.parseText(csvContent);
    expect(parseResult.errors).toBeUndefined();
    expect(parseResult.riPortfolio).toBeDefined();

    pricingDataService.loadPricingForPaths.and.callFake((paths: string[]) => {
      const pricingRecords = paths.map(path => {
        // Parse path like 'eu-west-1/db.r5.xlarge/eu-west-1_db.r5.xlarge_multi-az-oracle-se2-byol.json'
        const parts = path.split('/');
        const region = parts[0];
        const instanceClass = parts[1];
        const fileName = parts[2];
        const fileParts = fileName.split('_');
        const lastPart = fileParts[fileParts.length - 1]; // 'multi-az-oracle-se2-byol.json'
        const lastParts = lastPart.split('-');
        const multiAz = lastParts[0] + '-' + lastParts[1] === 'multi-az';
        const engineEdition = lastParts.slice(2).join('-').replace('.json', ''); // 'oracle-se2-byol'
        const [engine, edition] = engineEdition.includes('-') ? engineEdition.split('-', 2) : [engineEdition, null];

        return new PricingRecord({
          instanceClass,
          region,
          multiAz,
          engine,
          edition,
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          dailyReservedRate: 0.8,
          dailyOnDemandRate: 1.0,
          upfrontCost: 0
        });
      });
      return of({ pricingRecords, missingFiles: [] });
    });

    // Emit the portfolio
    riDataService.setRiPortfolio(parseResult.riPortfolio);

    // Request aggregation
    return new Promise<void>((resolve) => {
      service.requestAggregation({ groupingMode: 'ri-type' }).subscribe(chartData => {
        if (chartData.aggregates && chartData.yearSavingsBreakdown.length > 0) {
          // Validate that savings percentages are correctly calculated
          chartData.yearSavingsBreakdown.forEach(yearData => {
            const expectedPercentage = yearData.onDemandCost > 0 ?
              ((yearData.onDemandCost - yearData.riCost) / yearData.onDemandCost) * 100 : 0;
            expect(Math.abs(yearData.savingsPercentage - expectedPercentage)).toBeLessThan(0.01);
            expect(yearData.savingsAmount).toBeCloseTo(yearData.onDemandCost - yearData.riCost, 2);
            expect(yearData.savingsPercentage).toBeGreaterThanOrEqual(0);
            expect(yearData.savingsPercentage).toBeLessThanOrEqual(100);
          });
          resolve();
        }
      });
    });
  });

  it('should correctly aggregate by cost-type with different upfront payment options', async () => {
    // Create test RI data with different upfront payment options
    const testRiRows: RiRow[] = [
      {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 2,
        raw: {}
      },
      {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'Partial Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 1,
        raw: {}
      },
      {
        instanceClass: 'db.r5.large',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: null,
        upfrontPayment: 'All Upfront',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 1,
        raw: {}
      }
    ];

    // Mock pricing data for different upfront payment options
    pricingDataService.loadPricingForPaths.and.callFake((paths: string[]) => {
      const pricingRecords = [
        new PricingRecord({
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          edition: null,
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          dailyReservedRate: 0.8,
          dailyOnDemandRate: 1.0,
          upfrontCost: 0
        }),
        new PricingRecord({
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          edition: null,
          upfrontPayment: 'Partial Upfront',
          durationMonths: 12,
          dailyReservedRate: 0.7,
          dailyOnDemandRate: 1.0,
          upfrontCost: 500
        }),
        new PricingRecord({
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          edition: null,
          upfrontPayment: 'All Upfront',
          durationMonths: 12,
          dailyReservedRate: 0.6,
          dailyOnDemandRate: 1.0,
          upfrontCost: 2000
        })
      ];
      return of({ pricingRecords, missingFiles: [] });
    });

    // Set the test RI portfolio
    riDataService.setRiPortfolio({
      metadata: { 
        source: 'test', 
        importedAt: new Date().toISOString(),
        columns: [],
        rowsCount: testRiRows.length
      },
      rows: testRiRows
    });

    // Test cost-type aggregation
    return new Promise<void>((resolve) => {
      service.requestAggregation({ groupingMode: 'cost-type' }).subscribe((chartData: any) => {
        if (chartData.aggregates) {
          // Check that we have the expected cost-type groups
          const monthKeys = Object.keys(chartData.aggregates);
          expect(monthKeys.length).toBeGreaterThan(0);

          // Check first month data
          const firstMonthKey = monthKeys[0];
          const monthData = chartData.aggregates[firstMonthKey];

          // Should have exactly 3 cost-type groups
          expect(Object.keys(monthData)).toEqual(['Savings Upfront', 'Savings Monthly', 'On Demand Monthly']);

          // Check Savings Upfront group (should include upfront costs from Partial and All Upfront)
          const upfrontGroup = monthData['Savings Upfront'];
          expect(upfrontGroup.riCost).toBeGreaterThan(0); // Should have upfront costs
          expect(upfrontGroup.onDemandCost).toBe(0); // No on-demand costs in upfront group

          // Check Savings Monthly group (should include recurring costs from all RIs)
          const monthlyGroup = monthData['Savings Monthly'];
          expect(monthlyGroup.riCost).toBeGreaterThan(0); // Should have recurring costs
          expect(monthlyGroup.onDemandCost).toBe(0); // No on-demand costs in monthly group

          // Check On Demand Monthly group (should include on-demand equivalent costs)
          const onDemandGroup = monthData['On Demand Monthly'];
          expect(onDemandGroup.riCost).toBe(0); // No RI costs in on-demand group
          expect(onDemandGroup.onDemandCost).toBeGreaterThan(0); // Should have on-demand costs

          // Verify savings calculations
          expect(upfrontGroup.savingsAmount).toBe(upfrontGroup.onDemandCost - upfrontGroup.riCost);
          expect(monthlyGroup.savingsAmount).toBe(monthlyGroup.onDemandCost - monthlyGroup.riCost);
          expect(onDemandGroup.savingsAmount).toBe(onDemandGroup.onDemandCost - onDemandGroup.riCost);

          // Verify savings percentages
          expect(upfrontGroup.savingsPercentage).toBe(upfrontGroup.onDemandCost > 0 ?
            (1 - upfrontGroup.riCost / upfrontGroup.onDemandCost) * 100 : 0);
          expect(monthlyGroup.savingsPercentage).toBe(monthlyGroup.onDemandCost > 0 ?
            (1 - monthlyGroup.riCost / monthlyGroup.onDemandCost) * 100 : 0);
          expect(onDemandGroup.savingsPercentage).toBe(onDemandGroup.onDemandCost > 0 ?
            (1 - onDemandGroup.riCost / onDemandGroup.onDemandCost) * 100 : 0);

          resolve();
        }
      });
    });
  });
});
