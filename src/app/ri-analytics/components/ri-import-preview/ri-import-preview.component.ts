import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs/operators';
import { RiDataService } from '../../services/ri-data.service';

@Component({
  selector: 'app-ri-import-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 mt-4 border rounded">
      <ng-container *ngIf="counts$ | async as c; else empty">
        <div *ngIf="c.total === 0">No rows</div>
        <div *ngIf="c.total > 0">
          <div *ngIf="c.metadata">
            Reserved Instance data overview: Data extract is date {{ c.ageText }} ({{ c.displayDate }}). 
            Total RIs <strong>{{ c.total }}</strong> coming from <strong>{{ c.unique }}</strong> purchases.
          </div>
        </div>
      </ng-container>
      <ng-template #empty><div>No import loaded</div></ng-template>
    </div>
  `,
})
export class RiImportPreviewComponent {
  import$ = this.data.currentImport$;
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

  return { total, unique, metadata: imp.metadata, ageText, displayDate };
    })
  );

  constructor(private readonly data: RiDataService) {}
}
