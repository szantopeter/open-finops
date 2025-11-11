import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiImportService } from './ri-import.service';
import { RiDataService } from './ri-data.service';
import { StorageService } from '../../core/services/storage.service';
import { HttpClientModule } from '@angular/common/http';
import { PricingDataService } from './pricing-data.service';
import { firstValueFrom } from 'rxjs';

// This spec clears persisted import state, triggers the SAMPLE_IMPORT initializer
// (which fetches /assets/cloudability-rds-reservations.csv on first run), then
// waits for RiDataService to receive the import and invokes the aggregator to
// collect unmatched diagnostics. It prints the first unmatched diagnostic to the
// console so the developer can see which composite fields differ.

describe('Capture unmatched diagnostics (headless)', () => {
  let service: RiCostAggregationService;
  let dataService: RiDataService;
  let importer: RiImportService;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [RiCostAggregationService, RiImportService, RiDataService, StorageService, PricingDataService],
    });
    service = TestBed.inject(RiCostAggregationService);
    dataService = TestBed.inject(RiDataService);
    importer = TestBed.inject(RiImportService);
    storage = TestBed.inject(StorageService);
  });

  it('fetches asset CSV and shows first unmatched diagnostic', async () => {
    try {
      await storage.remove('ri-import');
      console.log('[CaptureSpec] cleared ri-import from storage');
    } catch {
      console.log('[CaptureSpec] storage remove ignored');
    }

    // Fetch the CSV asset served by Karma (assets/ is available at /assets)
    try {
      const res = await fetch('/assets/cloudability-rds-reservations.csv');
      if (!res.ok) {
        console.log('[CaptureSpec] failed to fetch asset:', res.status);
        return;
      }
      const txt = await res.text();
      const parsed = importer.parseText(txt, 'capture-spec');
      if (!parsed || !parsed.import) {
        console.log('[CaptureSpec] parser returned no import');
        return;
      }

      // Set the import into RiDataService as the initializer would do
      (dataService as any).setImport(parsed.import);
      console.log('[CaptureSpec] parsed import rows:', (parsed.import as any).rows?.length ?? 0);

      const imp = parsed.import as any;
      const rows = imp.rows.map((r: any) => ({
        instanceClass: r.instanceClass,
        region: r.region,
        multiAz: r.multiAz ?? r.multiAZ ?? false,
        engine: r.engine ?? r.raw?.Product ?? '',
        edition: r.edition ?? null,
        upfrontPayment: r.upfrontPayment ?? r['RI Type'] ?? 'No Upfront',
        durationMonths: r.durationMonths ?? 36,
        startDate: r.startDate,
        endDate: r.endDate,
        count: r.count ?? 1,
      }));

      // Build candidate pricing file paths using the same logic as the chart component
      const pricingPaths: string[] = [];
      for (const r of rows) {
        const deployment = (r.multiAz || r.multiAZ) ? 'multi-az' : 'single-az';
        // Combine engine + edition for the file path (import service keeps them separate for matching)
        let engineKey = r.engine || 'mysql';
        if (r.edition) {
          engineKey = `${engineKey}-${r.edition}`;
        }
        const fileName = `${r.region}/${r.instanceClass}/${r.region}_${r.instanceClass}_${deployment}-${engineKey}.json`;
        if (!pricingPaths.includes(fileName)) pricingPaths.push(fileName);
      }

      console.log('[CaptureSpec] Requesting pricing files:', pricingPaths.length, 'files', pricingPaths[0] ?? 'none');

      // Load pricing files via PricingDataService - non-failing for missing files
      const pricingSvc = TestBed.inject(PricingDataService);
      let loaded: { records: any[]; missing: string[] } = { records: [], missing: [] };
      try {
        // use firstValueFrom to await the observable
        loaded = await firstValueFrom(pricingSvc.loadPricingForPaths(pricingPaths));
        console.log('[CaptureSpec] Loaded pricingRecords:', loaded.records.length, 'missing:', loaded.missing.length);
      } catch (e) {
        console.warn('[CaptureSpec] Pricing load failed:', e?.message ?? e);
      }

      const aggregates = service.aggregateMonthlyCosts(rows as any, loaded.records as any);
      console.log('[CaptureSpec] Aggregates computed (months):', Object.keys(aggregates).length);
    } catch (e) {
      console.error('[CaptureSpec] Exception during fetch/parse:', e);
    }
  });
});
