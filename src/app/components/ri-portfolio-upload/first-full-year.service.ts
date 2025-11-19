import { Injectable } from '@angular/core';

import { RiRow } from '../../models/ri-portfolio.model';

@Injectable({ providedIn: 'root' })
export class FirstFullYearService {
  computeFirstFullYear(rows: RiRow[]): number {
    if (!rows || rows.length === 0) {
      return new Date().getUTCFullYear() + 1;
    }

    const endDates = rows
      .map(r => r.endDate)
      .filter(d => !!d)
      .map(d => Date.parse(d))
      .filter(n => !Number.isNaN(n));

    if (endDates.length === 0) {
      return new Date().getUTCFullYear() + 1;
    }

    const maxMs = Math.max(...endDates);
    const dt = new Date(maxMs);
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth() + 1;
    const day = dt.getUTCDate();

    return (month === 1 && day === 1) ? year : year + 1;
  }

  monthsForYear(year: number): string[] {
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return months;
  }
}
