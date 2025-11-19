import PricingData from "./pricing.model";

export interface RiImportMetadata {
  source: string;
  importedAt: string; // ISO
  columns: string[];
  rowsCount: number;
  // If the import originated from a File the browser exposes the lastModified
  // timestamp on the File object; this records that (ISO) when available.
  fileLastModified?: string;
  version?: string;
}

export interface RiPortfolio {
  metadata: RiImportMetadata;
  rows: { riRow: RiRow; pricingData: PricingData }[];
}

export interface RiRow {
  id?: string;
  raw: Record<string, string>;
  startDate: string; // ISO date
  endDate?: string; // ISO date
  count: number;
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string;
  upfrontPayment?: string; // e.g., NoUpfront, Partial, AllUpfront
  durationMonths?: number;
}
