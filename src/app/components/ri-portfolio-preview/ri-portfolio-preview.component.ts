import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';

import { StorageService } from '../../services/storage.service';
import { RiDataService } from '../ri-portfolio-upload/ri-portfolio-data.service';
import { RiCSVParserService } from '../ri-portfolio-upload/ri-portfolio-import.service';

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
export class RiImportPreviewComponent implements OnInit {
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
          .filter((d: any) => d != null)
          .map((d: any) => Date.parse(d))
          .filter((n: number) => !Number.isNaN(n));
        if (endDates.length > 0) {
          const maxMs = Math.max(...endDates);
          latestExpiry = new Date(maxMs).toISOString().slice(0, 10);
        }
      } catch {
        latestExpiry = null;
      }

      return { total, unique, metadata: imp.metadata, ageText, displayDate, latestExpiry };
    })
  );

  constructor(
    private readonly data: RiDataService,
    private readonly storage: StorageService,
    private readonly importer: RiCSVParserService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const stored = await this.storage.get('ri-import');
      if (stored && this.data && typeof (this.data as any).setRiPortfolio === 'function') {
        const storedImport = stored as any;
        if (storedImport.rows && Array.isArray(storedImport.rows)) {
          const headers = ['startDate', 'endDate', 'count', 'instanceClass', 'region', 'multiAZ', 'engine', 'edition', 'upfront', 'durationMonths'];
          const csvLines = [headers.join(',')];
          for (const row of storedImport.rows) {
            const vals = headers.map((h) => {
              const val = row[h];
              if (val === null || val === undefined) return '';
              const str = String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replaceAll('"', '""')}"` : str;
            });
            csvLines.push(vals.join(','));
          }
          const csv = csvLines.join('\n');
          const parsed = this.importer.parseText(csv, storedImport.metadata?.source ?? 'storage');
          if (parsed.riPortfolio) {
            const normalized = {
              ...parsed.riPortfolio,
              metadata: storedImport.metadata
            };
            (this.data as any).setRiPortfolio(normalized);
            await this.storage.set('ri-import', normalized);
            return;
          }
        }
        (this.data as any).setRiPortfolio(storedImport);
      }
    } catch (e) {
      console.debug('[RiImportPreview] load from storage failed', e);
    }
  }
}
