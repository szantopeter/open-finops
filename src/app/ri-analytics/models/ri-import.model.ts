import { RiRow } from './ri-row.model';

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

export interface RiImport {
  metadata: RiImportMetadata;
  rows: RiRow[];
}
