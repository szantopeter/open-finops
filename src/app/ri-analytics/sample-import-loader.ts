import { Provider } from '@angular/core';

import { RiDataService } from './services/ri-data.service';
import { RiImportService } from './services/ri-import.service';
import { StorageService } from '../core/services/storage.service';

async function loadSampleIfMissing(storage: StorageService, parser: RiImportService, ds: RiDataService): Promise<void> {
  try {
    const existing = await storage.get('ri-import');
    if (existing) return;
  } catch {
    // proceed to load sample if storage read fails
  }

  try {
    const res = await fetch('/assets/cloudability-rds-reservations.csv');
    if (!res.ok) return;
    const txt = await res.text();
    const parsed = parser.parseText(txt, 'sample-assets');
    if (parsed && parsed.import) {
      ds.setImport(parsed.import as any);
      try {
        await storage.set('ri-import', parsed.import as any);
      } catch { /* ignore */ }
    }
  } catch (e) {
    // ignore failures silently — app should continue without sample
    console.error('[SAMPLE_IMPORT] failed to load sample import', e);
  }
}

export const SAMPLE_IMPORT_PROVIDER: Provider = {
  provide: 'APP_INIT_SAMPLE_IMPORT',
  useFactory: (storage: StorageService, parser: RiImportService, ds: RiDataService) => {
    return async () => loadSampleIfMissing(storage, parser, ds);
  },
  deps: [StorageService, RiImportService, RiDataService],
  multi: true as any
};
