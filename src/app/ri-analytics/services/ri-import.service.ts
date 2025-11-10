import { Injectable } from '@angular/core';

import { RiImport, RiImportMetadata } from '../models/ri-import.model';
import { RiRow } from '../models/ri-row.model';

export interface RiImportParseResult {
  import?: RiImport;
  errors?: string[];
}

const REQUIRED_COLUMNS = ['startDate', 'instanceClass', 'region', 'count'];

@Injectable({ providedIn: 'root' })
export class RiImportService {
  // optional fileLastModifiedIso can be provided when the source is a File
  parseText(text: string, source = 'clipboard', fileLastModifiedIso?: string): RiImportParseResult {
    if (!text) return { errors: ['empty input'] };

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { errors: ['no rows'] };

    const header = this.parseCsvLine(lines[0]);
    const headers = header.map(h => h.trim());

    // Map common CSV header variants to canonical keys used by the domain model.
    const headerToKey: Record<string, string> = {};
    const presentKeys = new Set<string>();
    const normalize = (s: string): string => this.normalizeHeaderKey(s);
    for (const h of headers) {
      const n = normalize(h);
      let key = h; // default: keep original header
      if (['start', 'startdate', 'start_date'].includes(n)) key = 'startDate';
      else if (['end', 'enddate', 'end_date'].includes(n)) key = 'endDate';
      else if (n.includes('instancetype') || (n.includes('instance') && n.includes('type')) || n === 'instancetype') key = 'instanceClass';
      else if (n.includes('region')) key = 'region';
      else if (n.includes('count')) key = 'count';
      else if (n === 'multiaz' || n === 'multiaz') key = 'multiAZ';
      else if (n.includes('engine') || n.includes('product')) key = 'engine';
      else key = h; // fall back to original header
      headerToKey[h] = key;
      presentKeys.add(key);
    }

    // Debug: print detected headers and mapping to help diagnose real-world CSVs
    // (temporary — will be removed once mapping is reliable)
    // NOTE: logging removed — parser should be deterministic. Keep headerToKey
    // built above for further processing.

    let missing = REQUIRED_COLUMNS.filter(c => !presentKeys.has(c));
    // Fallback: common Cloudability header names (Start, Instance Type, Region, Count)
    if (missing.length) {
      const headersLower = headers.map(h => h.toLowerCase());
      const fallbackMap: Record<string, string> = {};
      if (headersLower.includes('start')) fallbackMap['start'] = 'startDate';
      if (headersLower.includes('instance type') || headersLower.includes('instancetype')) fallbackMap['instance type'] = 'instanceClass';
      if (headersLower.includes('region')) fallbackMap['region'] = 'region';
      if (headersLower.includes('count')) fallbackMap['count'] = 'count';
      if (Object.keys(fallbackMap).length > 0) {
        for (const h of headers) {
          const hl = h.toLowerCase();
          if (fallbackMap[hl]) {
            headerToKey[h] = fallbackMap[hl];
            presentKeys.add(fallbackMap[hl]);
          }
        }
        missing = REQUIRED_COLUMNS.filter(c => !presentKeys.has(c));
      }
    }
    if (missing.length) return { errors: [`missing required columns: ${missing.join(',')}`] };

    const rows: RiRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      if (row.length === 0) continue;

      const objRaw: Record<string, string> = {};
      const obj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const rawHeader = headers[j];
        const value = row[j] ?? '';
        objRaw[rawHeader] = value;
        const mappedKey = headerToKey[rawHeader] ?? rawHeader;
        obj[mappedKey] = value;
      }

      // basic normalization
      const start = obj['startDate'] ?? obj['Start'] ?? objRaw['Start'];
      const startIso = this.normalizeDate(start);
      if (!startIso) {
        errors.push(`invalid startDate at line ${i + 1}`);
        continue;
      }

      const count = Number.parseInt((obj['count'] ?? objRaw['Count'] ?? '0') as string, 10) || 0;

      rows.push({
        raw: objRaw,
        startDate: startIso,
        endDate: obj['endDate'] ? this.normalizeDate(obj['endDate']) ?? undefined : undefined,
        count,
        instanceClass: (obj['instanceClass'] ?? obj['Instance Type'] ?? objRaw['Instance Type'] ?? '') as string,
        region: (obj['region'] ?? objRaw['Region'] ?? '') as string,
        multiAZ: ((obj['multiAZ'] ?? objRaw['multiAZ'] ?? objRaw['multiAz'] ?? '') as string).toLowerCase() === 'true',
        engine: obj['engine'] ?? '',
        edition: obj['edition'],
        upfront: obj['upfront'],
        durationMonths: obj['durationMonths'] ? Number.parseInt(obj['durationMonths'], 10) : undefined
      });
    }

    if (errors.length) return { errors };

    const metadata: RiImportMetadata = {
      source,
      importedAt: new Date().toISOString(),
      columns: headers,
      rowsCount: rows.length,
      fileLastModified: fileLastModifiedIso
    };

    return { import: { metadata, rows } };
  }

  private normalizeHeaderKey(s: string): string {
    // Use split/join to remove non-alphanumerics to avoid replaceAll rule issues
    return s.split(/[^a-zA-Z0-9]/g).join('').toLowerCase();
  }

  async parseFile(file: File): Promise<RiImportParseResult> {
    const text = await file.text();
    const lm = (file && typeof (file as any).lastModified === 'number') ? new Date((file as any).lastModified).toISOString() : undefined;
    return this.parseText(text, file.name || 'file', lm);
  }

  // Very small CSV parser for quoted fields and commas
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i++;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
        i++;
        continue;
      }
      cur += ch;
      i++;
    }
    result.push(cur);
    return result;
  }

  private normalizeDate(input?: string): string | null {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
}
