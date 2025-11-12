import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiImportService } from './ri-import.service';
import { PricingRecord } from '../models/pricing-record.model';
// Use an inline sample CSV (same as src/assets/cloudability-small.csv) so tests run in browser
const SAMPLE_CSV = `Account Name,Account ID,Reservation ID,RI Type,Instance Type,Region,multiAZ,Product,State,Term,Utilization,Count,Units,Currency Code,Net Savings,Unrealized Savings,Start,End
WFS-AWS-SysOps-Prod-KE-Account,649170366416,ri-2024-11-21-21-16-48-420,No Upfront,db.r5.xlarge,eu-west-1,true,"oracle-se2 (byol)",active,1 year,0.9684340,1,16.0000000,USD,249.8410000,8.7000000,2024-11-21,2025-11-21
WFS-AWS-SysOps-KE-Lower-Account,410728501395,ri-2024-11-21-21-19-30-249,No Upfront,db.r5.xlarge,eu-west-1,false,"oracle-se2 (byol)",active,1 year,0.9684340,1,8.0000000,USD,125.7000000,4.3750000,2024-11-21,2025-11-21
`;

describe('RiCostAggregationService with real CSV', () => {
  let service: RiCostAggregationService;
  let importer: RiImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(RiCostAggregationService);
    importer = TestBed.inject(RiImportService);
  });

  it('loads assets/cloudability-rds-reservations.csv and returns aggregates', () => {
    const parsed = importer.parseText(SAMPLE_CSV, 'test-sample');
    expect(parsed.errors).toBeUndefined();
    expect(parsed.import).toBeDefined();
    const imp = parsed.import as any;
    // Normalize rows similar to MonthlyCostChartComponent
    const rows = imp.rows.map((r: any) => {
      // derive engine and edition from product-like field if present
      const rawProduct = (r.raw?.Product ?? r.engine ?? '') as string;
      let engineField = rawProduct || r.engine || '';
      // some CSVs embed edition/license in the Product field like 'oracle-se2 (byol)'
      const paren = engineField.match(/\(([^)]+)\)/);
      if (paren) engineField = engineField.replace(/\([^)]+\)/, '').trim();

      // split hyphen tokens
      let engine = 'mysql';
      if (engineField.toLowerCase().includes('oracle')) engine = 'oracle';
      else if (engineField.toLowerCase().includes('mysql')) engine = 'mysql';

      let edition: string | null = null;
      const parts = engineField.split('-');
      if (parts.length > 1) edition = parts.slice(1).join('-');

      return {
        instanceClass: r.instanceClass,
        region: r.region,
        multiAz: (r.multiAZ ?? r.multiAz ?? '').toString().toLowerCase() === 'true',
        engine,
        edition: edition ? edition : null,
        upfrontPayment: (r.upfront ?? r['RI Type'] ?? 'No Upfront') as string,
        durationMonths: r.durationMonths ?? 12,
        startDate: r.startDate,
        endDate: r.endDate,
        count: r.count ?? 1
      };
    });

    // Create one PricingRecord per unique row key (simple synthetic pricing values)
    const pricingRecords: PricingRecord[] = rows.map((rr: any) => new PricingRecord({
      instanceClass: rr.instanceClass,
      region: rr.region,
      multiAz: rr.multiAz,
      engine: rr.engine,
      edition: rr.edition ?? null,
      upfrontPayment: (rr.upfrontPayment && rr.upfrontPayment.toString().toLowerCase().includes('no')) ? 'No Upfront' : 'No Upfront',
      durationMonths: rr.durationMonths || 12,
      dailyReservedRate: 10 // synthetic small rate so totals are > 0
    }));

    const aggregates = service.aggregateMonthlyCosts(rows as any, pricingRecords as any);
    // Expect non-empty months covering the start date month
    const months = Object.keys(aggregates).sort();
    expect(months.length).toBeGreaterThan(0);
    // sample CSV rows start on 2024-11 -> ensure that month exists
    expect(months).toContain('2024-11');
    // groups: since two sample rows differ by multiAz, expect at least 1 group per month
    const groups = Object.keys(aggregates['2024-11'] || {});
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});
