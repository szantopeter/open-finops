import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PricingMetadataService } from './pricing-metadata.service';

describe('PricingMetadataService', () => {
  let service: PricingMetadataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PricingMetadataService]
    });
    service = TestBed.inject(PricingMetadataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('parses fetchedAt and returns ageText', async () => {
    const fake = { fetchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), source: 'AmazonRDS' };
    const obs = service.getMetadata();
    obs.subscribe((m) => {
      expect(m.raw).toBeTruthy();
      expect(m.source).toBe('AmazonRDS');
      expect(m.ageDays).toBe(2);
      expect(m.ageText).toBe('2 days ago');
    });
    const req = http.expectOne('assets/pricing/metadata.json');
    req.flush(fake);
  });
});
