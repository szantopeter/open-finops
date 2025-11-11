import { TestBed } from '@angular/core/testing';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiImportService } from './ri-import.service';
import { RiDataService } from './ri-data.service';
import { StorageService } from '../../core/services/storage.service';
import { HttpClientModule } from '@angular/common/http';
import { PricingDataService } from './pricing-data.service';
import { firstValueFrom } from 'rxjs';

describe('RiCostAggregationService one-line cloudability CSV', () => {
  let aggregator: RiCostAggregationService;
  let importer: RiImportService;
  let pricingSvc: PricingDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [RiCostAggregationService, RiImportService, RiDataService, StorageService, PricingDataService],
    });
    aggregator = TestBed.inject(RiCostAggregationService);
    importer = TestBed.inject(RiImportService);
    pricingSvc = TestBed.inject(PricingDataService);
  });

  it('loads one cloudability row and matches pricing file oracle-se2-byol', async () => {
    // Fetch the one-line CSV asset served by Karma
    const res = await fetch('/assets/cloudability-one-line.csv');
    expect(res.ok).toBeTrue();
    const txt = await res.text();

    const parsed = importer.parseText(txt, 'one-line-spec');
    expect(parsed).toBeDefined();
    expect(parsed.import).toBeDefined();
    const imp = (parsed.import as any);
    expect(imp.rows?.length).toBeGreaterThan(0);

    // Import service already normalized all fields - use them as-is
    const r = imp.rows[0] as any;
    console.log('[one-row spec] Parsed row:', JSON.stringify(r, null, 2));

    // Map to aggregator shape (minimal transformation)
    const normalizeUpfront = (u: any) => {
      const raw = (u ?? '').toString().trim().toLowerCase();
      if (!raw) return 'No Upfront';
      if (raw.includes('no') && raw.includes('up')) return 'No Upfront';
      if (raw.includes('partial')) return 'Partial Upfront';
      if (raw.includes('all')) return 'All Upfront';
      return 'No Upfront';
    };

    const row = {
      instanceClass: r.instanceClass,
      region: r.region,
      multiAz: r.multiAZ ?? false,
      engine: r.engine,  // already normalized by import service
      edition: r.edition,  // already normalized by import service
      upfrontPayment: normalizeUpfront(r.upfront),
      durationMonths: r.durationMonths ?? 36,
      startDate: r.startDate,
      endDate: r.endDate,
      count: r.count ?? 1,
    } as any;

    console.log('[one-row spec] Mapped row for aggregation:', JSON.stringify(row, null, 2));

    // Build expected pricing path per generator convention (combine engine+edition for file path)
    const deployment = row.multiAz ? 'multi-az' : 'single-az';
    let engineKey = row.engine;
    if (row.edition) {
      engineKey = `${engineKey}-${row.edition}`;
    }
    const fileName = `${row.region}/${row.instanceClass}/${row.region}_${row.instanceClass}_${deployment}-${engineKey}.json`;
    console.log('[one-row spec] Expected pricing file:', fileName);

    // Load pricing for that path
    const loaded = await firstValueFrom(pricingSvc.loadPricingForPaths([fileName]));
    expect(loaded).toBeDefined();
    console.log('[one-row spec] Loaded pricing records:', loaded.records.length, 'missing:', loaded.missing.length);
    
    // At least one pricing record should be loaded for that file
    expect(loaded.records.length).toBeGreaterThan(0);

    const aggregates = aggregator.aggregateMonthlyCosts([row], loaded.records as any);
    console.log('[one-row spec] Aggregation complete - unmatched:', aggregator.lastUnmatchedCount);

    // Aggregation should have matched the row (no unmatched rows)
    expect(aggregator.lastUnmatchedCount).toBe(0);
    // There should be at least one month of aggregated data
    expect(Object.keys(aggregates).length).toBeGreaterThan(0);
  });
});
