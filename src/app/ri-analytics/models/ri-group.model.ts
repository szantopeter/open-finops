import { RiMatchingCriteria } from './ri-matching-criteria.model';
import { RiRow } from './ri-row.model';

export class RiGroup {
  criteria: RiMatchingCriteria;
  ris: RiRow[];

  constructor(criteria: RiMatchingCriteria, ris: RiRow[] = []) {
    this.criteria = criteria;
    this.ris = ris;
  }

  addRi(ri: RiRow): void {
    this.ris.push(ri);
  }

  getTotalRis(): number {
    return this.ris.length;
  }
}
