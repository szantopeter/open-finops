export interface RiRow {
  id?: string;
  raw: Record<string, string>;
  startDate: string; // ISO date
  endDate?: string; // ISO date
  count: number;
  instanceClass: string;
  region: string;
  multiAZ: boolean;
  engine: string;
  edition?: string;
  upfront?: string; // e.g., NoUpfront, Partial, AllUpfront
  durationMonths?: number;
}
