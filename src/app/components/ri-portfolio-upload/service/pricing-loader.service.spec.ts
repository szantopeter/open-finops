import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PricingLoaderService } from './pricing-loader.service';
import type { RiRow } from '../models/ri-portfolio.model';
import type { Deployment, LicenseToken, SavingsTerm, PurchaseOption, SavingsOptionsMap } from '../models/pricing.model';
import { RiCategorizatorCalculator } from 'src/app/calculators/ri-categorizator/ri-categorizator-calculator';

describe('PricingLoaderService', () => {
  let service: PricingLoaderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PricingLoaderService]
    });
    service = TestBed.inject(PricingLoaderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should parse CSV and return PricingData', async () => {
    const mockRiRow: RiRow = {
      id: '1',
      raw: {},
      startDate: new Date(),
      endDate: new Date(),
      count: 1,
      instanceClass: 'db.r5.xlarge',
      region: 'eu-west-1',
      multiAz: true,
      engine: 'oracle',
      edition: 'byol',
      upfrontPayment: 'All Upfront',
      durationMonths: 12,
      type: 'actual'
    };

    spyOn(RiCategorizatorCalculator, 'getPricingKey').and.returnValue({
      region: 'eu-west-1',
      engineKey: 'oracle-se2-byol',
      deployment: 'multi-az',
      instanceClass: 'db.r5.xlarge'
    } as any);

    const mockCsv = `type,region,instance,deployment,engine,license,term,purchaseOption,upfront,hourly,daily,adjustedAmortisedHourly,adjustedAmortisedDaily,sku
onDemand,eu-west-1,db.r5.xlarge,multi-az,oracle,byol,,,,1.031000,24.744000,1.031000,24.744000,2DV3WTJK6MPH2ZFQ
savings,eu-west-1,db.r5.xlarge,multi-az,oracle,byol,1yr,No Upfront,0.00,0.682500,16.380000,0.682500,16.380000,2DV3WTJK6MPH2ZFQ
savings,eu-west-1,db.r5.xlarge,multi-az,oracle,byol,1yr,All Upfront,5580.00,0.000000,0.000000,0.636550,15.277207,2DV3WTJK6MPH2ZFQ`;

    const expectedPricingData = {
      region: 'eu-west-1',
      instance: 'db.r5.xlarge',
      deployment: 'multi-az' as Deployment,
      engine: 'oracle',
      license: 'byol' as LicenseToken,
      onDemand: {
        hourly: 1.031,
        daily: 24.744,
        adjustedAmortisedHourly: 1.031,
        adjustedAmortisedDaily: 24.744,
        sku: '2DV3WTJK6MPH2ZFQ'
      },
      savingsOptions: {
        '1yr_No Upfront': {
          term: '1yr' as SavingsTerm,
          purchaseOption: 'No Upfront' as PurchaseOption,
          upfront: 0,
          hourly: 0.6825,
          daily: 16.38,
          adjustedAmortisedHourly: 0.6825,
          adjustedAmortisedDaily: 16.38
        },
        '1yr_All Upfront': {
          term: '1yr' as SavingsTerm,
          purchaseOption: 'All Upfront' as PurchaseOption,
          upfront: 5580,
          hourly: 0,
          daily: 0,
          adjustedAmortisedHourly: 0.63655,
          adjustedAmortisedDaily: 15.277207
        }
      } as SavingsOptionsMap
    };

    const promise = service.loadPricingForRiRow(mockRiRow);

    const req = httpMock.expectOne('assets/pricing/eu-west-1_oracle-se2-byol_multi-az_r.csv');
    expect(req.request.method).toBe('GET');
    req.flush(mockCsv);

    const result = await promise;
    expect(result).toEqual(expectedPricingData);
  });
});