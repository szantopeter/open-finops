import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PricingDataService } from './pricing-data.service';

describe('PricingDataService', () => {
  let svc: PricingDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PricingDataService]
    });
    svc = TestBed.inject(PricingDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads pricing files', (done) => {
    const portfolio = {
      rows: [
        { region: 'us-east-1', instanceClass: 'p1', multiAz: false, engine: 'mysql' },
        { region: 'eu-west-1', instanceClass: 'p2', multiAz: false, engine: 'postgres' }
      ]
    } as any;

    svc.loadPricingForPortfolio(portfolio).subscribe({
      next: (result: any) => {
        expect(result.pricingRecords.length).toBe(2);
        done();
      }
    });

    const req1 = http.expectOne('/assets/pricing/us-east-1/p1/us-east-1_p1_single-az-mysql.json');
    req1.flush({ instanceClass: 'db.r5.large', region: 'us-east-1', deployment: 'single-az', instance: 'p1', engine: 'mysql', onDemand: { daily: 2 }, savingsOptions: { '1yr_No Upfront': { daily: 1 } } });

    const req2 = http.expectOne('/assets/pricing/eu-west-1/p2/eu-west-1_p2_single-az-postgres.json');
    req2.flush({ instanceClass: 'db.r5.xlarge', region: 'eu-west-1', deployment: 'single-az', instance: 'p2', engine: 'postgres', onDemand: { daily: 3 }, savingsOptions: { '1yr_All Upfront': { upfront: 100 } } });
  });

  // other tests removed
});
