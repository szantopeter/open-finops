import { RiImportService } from './ri-import.service';

describe('RiImportService', () => {
  let svc: RiImportService;

  beforeEach(() => {
    svc = new RiImportService();
  });

  it('parses a minimal CSV', () => {
    const csv = 'startDate,instanceClass,region,count\n2020-01-01,t3.medium,us-east-1,2';
    const res = svc.parseText(csv, 'test');
    expect(res.errors).toBeUndefined();
    expect(res.import).toBeDefined();
    if (!res.import) throw new Error('expected import');
    expect(res.import.rows.length).toBe(1);
    expect(res.import.rows[0].count).toBe(2);
  });

  it('reports missing required columns', () => {
    const csv = 'a,b,c\n1,2,3';
    const res = svc.parseText(csv);
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]).toContain('missing required columns');
  });

  it('reports invalid start date', () => {
    const csv = 'startDate,instanceClass,region,count\nNOTADATE,t3.small,eu-west-1,1';
    const res = svc.parseText(csv);
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]).toContain('invalid startDate');
  });
});
