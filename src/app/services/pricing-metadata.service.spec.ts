import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PricingMetadataService } from './pricing-metadata.service';

describe('PricingMetadataService', () => {
  let service: PricingMetadataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PricingMetadataService] });
    service = TestBed.inject(PricingMetadataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('parses fetchedAt and produces ageText', (done) => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    const raw = { fetchedAt: twoDaysAgo.toISOString(), source: 'AmazonRDS', discountPercentApplied: 14 };

    service.getMetadata().subscribe((m) => {
      expect(m.raw).toEqual(raw);
      expect(m.source).toBe('AmazonRDS');
      expect(typeof m.ageDays).toBe('number');
      expect(m.ageText).toMatch(/days ago|1 day ago|today/);
      done();
    });

    const req = httpMock.expectOne('assets/pricing/metadata.json');
    expect(req.request.method).toBe('GET');
    req.flush(raw);
  });
});
