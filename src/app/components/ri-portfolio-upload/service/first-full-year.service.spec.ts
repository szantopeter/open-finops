import { TestBed } from '@angular/core/testing';

import { FirstFullYearService } from './first-full-year.service';
import { RiRow } from '../models/ri-portfolio.model';

describe('FirstFullYearService', () => {
  let service: FirstFullYearService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirstFullYearService);
  });

  it('returns next year when rows empty', () => {
    const res = service.computeFirstFullYear([]);
    expect(res).toBe(new Date().getUTCFullYear() + 1);
  });

  it('returns next year when no endDates present', () => {
    const rows: RiRow[] = [{ raw: {}, startDate: '2024-01-01', count: 1, instanceClass: 'db.r5.large', region: 'eu-west-1', multiAz: false, engine: 'mysql' } as any];
    const res = service.computeFirstFullYear(rows);
    expect(res).toBe(new Date().getUTCFullYear() + 1);
  });

  it('returns same year when max endDate is exactly Jan 1 of that year', () => {
    const rows: RiRow[] = [
      { raw: {}, startDate: '2023-01-01', endDate: '2026-01-01', count: 1, instanceClass: 'db.r5.large', region: 'eu-west-1', multiAz: false, engine: 'mysql' } as any
    ];
    const res = service.computeFirstFullYear(rows);
    expect(res).toBe(2026);
  });

  it('returns next year when max endDate is not Jan 1', () => {
    const rows: RiRow[] = [
      { raw: {}, startDate: '2023-01-01', endDate: '2026-02-01', count: 1, instanceClass: 'db.r5.large', region: 'eu-west-1', multiAz: false, engine: 'mysql' } as any
    ];
    const res = service.computeFirstFullYear(rows);
    expect(res).toBe(2027);
  });
});
