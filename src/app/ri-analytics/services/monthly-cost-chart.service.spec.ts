import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MonthlyCostChartService } from './monthly-cost-chart.service';
import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiCSVParserService } from './ri-import.service';
import { PricingRecord } from '../models/pricing-record.model';

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

    // Wait for chartData
    return new Promise<void>((resolve) => {
      service.chartData$.subscribe(chartData => {
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
});
