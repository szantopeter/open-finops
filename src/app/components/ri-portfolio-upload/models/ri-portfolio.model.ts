import type { PricingData, UpfrontPayment } from './pricing.model';

export interface RiImportMetadata {
  source: string;
  importedAt: string; // ISO
  fileLastModified?: string;
  firstFullYear: number;
}

export interface RiPortfolio {
  metadata: RiImportMetadata;
  rows: { riRow: RiRow; pricingData: PricingData }[];
}

export interface RiRow {
  id: string;
  raw: Record<string, string>;
  startDate: Date;
  endDate: Date;
  count: number;
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition: string;
  upfrontPayment: UpfrontPayment;
  durationMonths: number;
  type: 'actual' | 'projected';
}
