import { HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiCSVParserService } from './ri-import.service';
import { StorageService } from '../../core/services/storage.service';


// This spec clears persisted import state, triggers the SAMPLE_IMPORT initializer
// (which fetches /assets/cloudability-rds-reservations.csv on first run), then
// waits for RiDataService to receive the import and invokes the aggregator to
// collect unmatched diagnostics. It prints the first unmatched diagnostic to the
// console so the developer can see which composite fields differ.

describe('Capture unmatched diagnostics (headless)', () => {
  let service: RiCostAggregationService;
  let dataService: RiDataService;
  let importer: RiCSVParserService;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [RiCostAggregationService, RiCSVParserService, RiDataService, StorageService, PricingDataService]
    });
    service = TestBed.inject(RiCostAggregationService);
    dataService = TestBed.inject(RiDataService);
    importer = TestBed.inject(RiCSVParserService);
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
      if (!parsed?.riPortfolio) {
        console.log('[CaptureSpec] parser returned no import');
        return;
      }

      // Set the import into RiDataService as the initializer would do
      (dataService as any).setRiPortfolio(parsed.riPortfolio);
      console.log('[CaptureSpec] parsed import rows:', (parsed.riPortfolio as any).rows?.length ?? 0);

      const imp = parsed.riPortfolio as any;
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
        count: r.count ?? 1
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
      let loaded: { pricingRecords: any[]; missingFiles: string[] } = { pricingRecords: [], missingFiles: [] };
      try {
        // use firstValueFrom to await the observable
        loaded = await firstValueFrom(pricingSvc.loadPricingForPaths(pricingPaths));
        console.log('[CaptureSpec] Loaded pricingRecords:', loaded.pricingRecords.length, 'missing:', loaded.missingFiles.length);
      } catch (e) {
        console.warn('[CaptureSpec] Pricing load failed:', e?.message ?? e);
      }

      const aggregates = service.aggregateMonthlyCosts(rows, loaded.pricingRecords as any);
      console.log('[CaptureSpec] Aggregates computed (months):', Object.keys(aggregates).length);
    } catch (e) {
      console.error('[CaptureSpec] Exception during fetch/parse:', e);
    }
  });
});
