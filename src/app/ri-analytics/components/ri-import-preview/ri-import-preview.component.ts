import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { map } from 'rxjs/operators';

import { PageStateService } from '../../../core/services/page-state.service';
import { StorageService } from '../../../core/services/storage.service';
import { RiDataService } from '../../services/ri-data.service';
import { RiCSVParserService } from '../../services/ri-import.service';

@Component({
  selector: 'app-ri-import-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="p-4 border rounded">
      <ng-container *ngIf="counts$ | async as c; else empty">
        <div *ngIf="c.total === 0">No rows</div>
        <div *ngIf="c.total > 0">
          <div *ngIf="c.metadata">
            Reserved Instance data overview: Data extract is date {{ c.ageText }} ({{ c.displayDate }}).
            Total RIs <strong>{{ c.total }}</strong> coming from <strong>{{ c.unique }}</strong> purchases.
            <div *ngIf="c.latestExpiry">Latest RI expiry: <strong>{{ c.latestExpiry }}</strong></div>
          </div>
        </div>
      </ng-container>
      <ng-template #empty><div>No import loaded</div></ng-template>
    </div>
  `
})
export class RiImportPreviewComponent implements OnDestroy {
  import$ = this.data.riPortfolio$;
  counts$ = this.import$.pipe(
    map((imp) => {
      if (!imp) return { total: 0, unique: 0 };
      const total = imp.rows.reduce((acc, r) => acc + (r.count ?? 0), 0);
      // Prefer Reservation ID if present in raw; otherwise fall back to composite key
      // unique RIs here should reflect number of rows (distinct RI entries)
      const unique = imp.rows.length;

      // compute human friendly age text from metadata.importedAt
      let ageText = '';

      // Prefer fileLastModified for age calculations when available
      const dateSource = imp.metadata?.fileLastModified ?? imp.metadata?.importedAt;
      let displayDate = '';
      if (dateSource) {
        const parsed = Date.parse(dateSource);
        if (!Number.isNaN(parsed)) {
          const diffMs = Date.now() - parsed;
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (days <= 0) ageText = 'today';
          else if (days === 1) ageText = '1 day old';
          else ageText = `${days} days old`;
          // display only the date part in YYYY-MM-DD
          const d = new Date(parsed);
          displayDate = d.toISOString().slice(0, 10);
        }
      }

      // compute latest expiry date (most distant endDate among rows)
      let latestExpiry: string | null = null;
      try {
        const endDates = imp.rows
          .map((r: any) => r.endDate)
          .filter((d: any) => d)
          .map((d: any) => Date.parse(d))
          .filter((n: number) => !Number.isNaN(n));
        if (endDates.length > 0) {
          const maxMs = Math.max(...endDates);
          latestExpiry = new Date(maxMs).toISOString().slice(0, 10);
        }
      } catch (e) {
        latestExpiry = null;
      }

      return { total, unique, metadata: imp.metadata, ageText, displayDate, latestExpiry };
    })
  );

  private readonly unregister: () => void = () => {};

  constructor(
    private readonly data: RiDataService,
    private readonly pageState: PageStateService,
    private readonly storage: StorageService,
    private readonly importer: RiCSVParserService
  ) {
    this.unregister = this.pageState.register(
      'ri-import',
      // load callback: restore saved RiImport into RiDataService
      async (s) => {
        const stored = await s.get('ri-import');
        if (stored && this.data && typeof (this.data as any).setRiPortfolio === 'function') {
          // Re-normalize stored data to ensure old imports with un-normalized engine/edition fields
          // get updated to match current normalization logic (e.g., 'oracle-se2 (byol)' → engine='oracle', edition='se2-byol')
          const storedImport = stored as any;
          if (storedImport.rows && Array.isArray(storedImport.rows)) {
            // Serialize rows back to CSV format and re-parse to apply current normalization
            const headers = ['startDate', 'endDate', 'count', 'instanceClass', 'region', 'multiAZ', 'engine', 'edition', 'upfront', 'durationMonths'];
            const csvLines = [headers.join(',')];
            for (const row of storedImport.rows) {
              const vals = headers.map(h => {
                const val = row[h];
                // Quote values that might contain commas or special chars
                if (val === null || val === undefined) return '';
                const str = String(val);
                return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
              });
              csvLines.push(vals.join(','));
            }
            const csv = csvLines.join('\n');
            const parsed = this.importer.parseText(csv, storedImport.metadata?.source ?? 'storage');
            if (parsed.riPortfolio) {
              // Preserve original metadata but update rows with normalized data
              const normalized = {
                ...parsed.riPortfolio,
                metadata: storedImport.metadata // keep original metadata (importedAt, fileLastModified, etc.)
              };
              (this.data as any).setRiPortfolio(normalized);
              // Re-save the normalized version
              await s.set('ri-import', normalized);
              return;
            }
          }
          // Fallback: if re-parsing fails, use stored data as-is
          (this.data as any).setRiPortfolio(storedImport);
        }
      },
      // save callback: persist current import from RiDataService
      async (s) => {
        const { firstValueFrom } = await import('rxjs');
        const cur = await firstValueFrom(this.data.riPortfolio$ as any);
        if (cur) await s.set('ri-import', cur as any);
        else await s.remove('ri-import');
      }
    );
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
