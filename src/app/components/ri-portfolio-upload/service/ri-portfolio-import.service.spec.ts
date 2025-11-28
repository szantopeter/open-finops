import type { HttpClient } from '@angular/common/http';

import { PricingLoaderService } from './pricing-loader.service';
import { RiCSVParserService } from './ri-portfolio-import.service';

describe('RiImportService', () => {
  let svc: RiCSVParserService;
  let pricingLoader: PricingLoaderService;

  beforeEach(() => {
    const httpClient = {} as HttpClient; // mock
    pricingLoader = new PricingLoaderService(httpClient);
    // mock the loadPricingForRiRow to return empty object
    spyOn(pricingLoader, 'loadPricingForRiRow').and.returnValue(Promise.resolve({
      region: 'us-east-1',
      instance: 't3.medium',
      deployment: 'single-az',
      engine: 'mysql',
      onDemand: { hourly: 0.1, daily: 2.4 },
      savingsOptions: null
    }));
    svc = new RiCSVParserService(pricingLoader);
  });

  it('parses a minimal CSV', async () => {
    const csv = 'Start,Instance Type,Region,Count,Term,Product,End,multiAZ,RI Type,Reservation ID\n'
      + '2019-05-01,t3.medium,us-east-1,2,1 year,mysql,2020-05-01,false,No Upfront,ri-11111\n'
      + '2020-01-01,t3.medium,us-east-1,1,1 year,mysql,2021-01-01,false,No Upfront,ri-12345';
    const res = await svc.parseText(csv, 'test');
    expect(res.errors).toBeUndefined();
    expect(res.riPortfolio).toBeDefined();
    if (!res.riPortfolio) throw new Error('expected import');
    expect(res.riPortfolio.rows.length).toBe(2);
    expect(res.riPortfolio.rows[0].riRow.count).toBe(2);
    expect(res.riPortfolio.rows[0].riRow.id).toBe('ri-11111');
    expect(res.riPortfolio.rows[1].riRow.count).toBe(1);
    expect(res.riPortfolio.rows[1].riRow.id).toBe('ri-12345');
    // projectionEndDate should be latest end date (2021-01-01) + 3 years - 1 day => 2023-12-31 (UTC)
    const proj = res.riPortfolio.metadata.projectionEndDate;
    expect(proj).toBeDefined();
    const projIso = new Date(proj).toISOString().slice(0, 10);
    expect(projIso).toBe('2023-12-31');
  });

  it('reports missing required columns', async () => {
    const csv = 'a,b,c\n1,2,3';
    const res = await svc.parseText(csv);
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]).toContain('missing required headers: Start, Instance Type, Region, Count, Term, Product, End, multiAZ, RI Type');
  });

  it('reports invalid start date', async () => {
    const csv = 'Start,Instance Type,Region,Count,Term,Product,End,multiAZ,RI Type,Reservation ID\nNOTADATE,t3.small,eu-west-1,1,1 year,mysql,2021-01-01,false,No Upfront,ri-12345';
    const res = await svc.parseText(csv);
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]).toContain('invalid Start');
  });
});
