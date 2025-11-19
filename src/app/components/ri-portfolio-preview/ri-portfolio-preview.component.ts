import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { map } from 'rxjs/operators';

import { RiPortfolioDataService } from '../ri-portfolio-upload/service/ri-portfolio-data.service';

@Component({
  selector: 'app-ri-import-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="p-4 border rounded">
      @if (portfolioStatistics$ | async; as statistics) {
        @if (statistics.total === 0) {
          <div>No rows</div>
        } @else {
          <div>
            @if (statistics.metadata) {
              Reserved Instance data overview: Data extract is date {{ statistics.ageText }} ({{ statistics.displayDate }}).
              Total RIs <strong>{{ statistics.total }}</strong> coming from <strong>{{ statistics.unique }}</strong> purchases.
              @if (statistics.latestExpiry) {
                <div>Latest RI expiry: <strong>{{ statistics.latestExpiry }}</strong></div>
              }
            }
          </div>
        }
      } @else {
        <div>No import loaded</div>
      }
    </div>
  `
})
export class RiImportPreviewComponent {
  import$ = this.riPortfolioDataService.riPortfolio$;
  portfolioStatistics$ = this.import$.pipe(
    map((imp) => {
      if (!imp) return { total: 0, unique: 0 };
      const total = imp.rows.reduce((acc, r) => acc + (r?.riRow?.count ?? 0), 0);
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
          .map((r: any) => r?.riRow?.endDate)
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
    private readonly riPortfolioDataService: RiPortfolioDataService
  ) {}
}
