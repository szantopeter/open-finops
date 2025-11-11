import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PricingDataService } from './pricing-data.service';

describe('PricingDataService', () => {
  let svc: PricingDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PricingDataService] });
    svc = TestBed.inject(PricingDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads pricing index and files', (done) => {
    const index = ['p1.json', 'p2.json'];
    svc.loadAllPricing().subscribe((records) => {
      expect(records.length).toBe(2);
      expect(records[0].instanceClass).toBe('db.r5.large');
      done();
    });

    const reqIndex = http.expectOne('/assets/pricing/index.json');
    reqIndex.flush(index);

    const req1 = http.expectOne('/assets/pricing/p1.json');
    req1.flush({ instanceClass: 'db.r5.large', region: 'us-east-1', multiAz: false, engine: 'mysql', upfrontPayment: 'No Upfront', durationMonths: 36, dailyReservedRate: 1 });

    const req2 = http.expectOne('/assets/pricing/p2.json');
    req2.flush({ instanceClass: 'db.r5.xlarge', region: 'eu-west-1', multiAz: false, engine: 'postgres', upfrontPayment: 'All Upfront', durationMonths: 12, upfrontCost: 100 });
  });
});
