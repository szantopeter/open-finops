import { RiCSVParserService } from './ri-import.service';

describe('RiImportService integration (cloudability file)', () => {
  it('parses cloudability export without missing columns', async () => {
    const svc = new RiCSVParserService();
    // Inline minimal Cloudability-like CSV fixture to avoid reliance on Karma static
    // file serving which can be environment-dependent.
    const text = 'Account Name,Account ID,Reservation ID,RI Type,Instance Type,Region,multiAZ,Product,State,Term,Utilization,Count,Units,Currency Code,Net Savings,Unrealized Savings,Start,End\n' +
      'acme,123,res-1,Standard,r5.large,us-east-1,true,postgres,active,1yr,NA,2,DBInstanceHours,USD,0,0,2024-01-01,2025-01-01\n' +
      'acme,123,res-2,Standard,r5.xlarge,us-east-1,false,postgres,active,1yr,NA,1,DBInstanceHours,USD,0,0,2024-02-01,2025-02-01\n';

    const res = svc.parseText(text, 'cloudability');
    expect(res.errors).toBeUndefined();
    expect(res.riPortfolio).toBeDefined();
    if (!res.riPortfolio) throw new Error('expected import');
    expect(res.riPortfolio.rows.length).toBe(2);
    const total = res.riPortfolio.rows.reduce((s, r) => s + (r.count || 0), 0);
    expect(total).toBe(3);
  });
});
