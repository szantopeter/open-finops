import { Injectable } from '@angular/core';

import { RiDataService } from './ri-data.service';
import { PageStateService } from '../../core/services/page-state.service';
import { StorageService } from '../../core/services/storage.service';
import { RiPorftolio, RiImportMetadata } from '../models/ri-import.model';
import { RiRow } from '../models/ri-row.model';

export interface RiImportParseResult {
  riPortfolio?: RiPorftolio;
  errors?: string[];
}

const REQUIRED_COLUMNS = ['startDate', 'instanceClass', 'region', 'count'];

@Injectable({ providedIn: 'root' })
export class RiCSVParserService {
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

      // --- Enhanced normalization for engine/edition/license and duration ---
      const rawEngine = (obj['engine'] ?? objRaw['Product'] ?? objRaw['Product'] ?? '') as string;
      const rawEditionField = (obj['edition'] ?? objRaw['Edition'] ?? '') as string;
      // prefer an explicit license field if present (some CSVs expose it)
      const rawLicenseField = (obj['license'] ?? objRaw['License'] ?? '') as string;

      // derive duration from common Term values (e.g. '1 year' -> 12)
      let durationMonths: number | undefined = undefined;
      const termRaw = (obj['term'] ?? objRaw['Term'] ?? objRaw['term'] ?? '') as string;
      if (termRaw) {
        const t = termRaw.toString().toLowerCase();
        if (t.includes('1 year') || t.includes('1yr') || t.includes('12')) durationMonths = 12;
        else if (t.includes('3 year') || t.includes('3yr') || t.includes('36')) durationMonths = 36;
      }

      // Clean engine string and extract parenthetical license tokens
      const engineStr = (rawEngine || '').toString();
      const parenMatch = engineStr.match(/\(([^)]+)\)/);
      const parenToken = parenMatch ? parenMatch[1].toString().toLowerCase() : null;
      const engineNoParen = engineStr.replace(/\([^)]+\)/, '').trim();
      const engineBaseLower = engineNoParen.toString().toLowerCase();

      // Normalize engine family (same rules as used in the chart component)
      const normalizeEngine = (dbEngine: string): string => {
        const lower = (dbEngine || '').toString().toLowerCase();
        if (lower.includes('aurora') && lower.includes('mysql')) return 'aurora-mysql';
        if (lower.includes('aurora') && (lower.includes('postgres') || lower.includes('postgresql'))) return 'aurora-postgresql';
        if (lower.includes('mysql')) return 'mysql';
        if (lower.includes('postgres') || lower.includes('postgresql')) return 'postgresql';
        if (lower.includes('mariadb')) return 'mariadb';
        if (lower.includes('oracle')) return 'oracle';
        if (lower.includes('sql server') || lower.includes('sqlserver')) return 'sqlserver';
        return dbEngine || '';
      };

      const enginesWithVariants = new Set(['oracle', 'db2', 'sqlserver']);

      // Derive edition: prefer explicit edition field; else try to extract from engine token
      let editionOnly: string | null = null;
      const explicitEdition = (rawEditionField || '').toString();
      if (explicitEdition) {
        // strip parentheses inside edition if present
        editionOnly = explicitEdition.replace(/\([^)]+\)/, '').trim() || null;
      } else {
        // if engineNoParen contains hyphenated tokens like 'oracle-se2', take the tail as edition
        if (engineNoParen.includes('-')) {
          const parts = engineNoParen.split(/[-\s]+/).map(p => p.trim()).filter(Boolean);
          if (parts.length > 1) editionOnly = parts.slice(1).join('-');
        }
      }

      // Normalize license token: prefer parenthesis content, else license field
      let licenseToken: string | null = null;
      if (parenToken) licenseToken = parenToken;
      else if (rawLicenseField) licenseToken = rawLicenseField.toString().toLowerCase();
      if (licenseToken) {
        // normalize common phrases
        if (licenseToken.includes('bring') || licenseToken.includes('byol')) licenseToken = 'byol';
        else if (licenseToken.includes('license') || licenseToken.includes('included') || licenseToken.includes('li')) licenseToken = 'li';
      }

      // Final normalized tokens
      const engineNormalizedBase = normalizeEngine(engineBaseLower || editionOnly || '');

      // For engines that support editions (oracle, sqlserver, db2), keep engine and edition separate
      // For other engines, append license to the engine token itself
      let finalEngineToken = engineNormalizedBase;
      let finalEdition: string | null = null;

      if (enginesWithVariants.has(engineNormalizedBase)) {
        // Keep engine as base (e.g., 'oracle')
        finalEngineToken = engineNormalizedBase;
        // Build edition with license suffix (e.g., 'se2-byol')
        if (editionOnly) finalEdition = editionOnly.toString();
        if (finalEdition && licenseToken) finalEdition = `${finalEdition}-${licenseToken}`;
        else if (!finalEdition && licenseToken) finalEdition = licenseToken;
      } else {
        // For engines without editions (mysql, postgresql, etc.), append license to engine
        if (licenseToken) finalEngineToken = `${engineNormalizedBase}-${licenseToken}`;
      }

      // If durationMonths was not derived from Term, attempt to read numeric durationMonths field
      durationMonths ??= obj['durationMonths'] ? Number.parseInt(obj['durationMonths'], 10) : undefined;

      // Import service already normalized all fields - just pass through with upfront normalization
      const normalizeUpfront = (u: any): string => {
        const raw = (u ?? '').toString().trim().toLowerCase();
        if (!raw) return 'No Upfront';
        if (raw.includes('no') && raw.includes('up')) return 'No Upfront';
        if (raw.includes('partial') || raw.includes('partial up')) return 'Partial Upfront';
        if (raw.includes('all') || raw.includes('all up') || raw.includes('allupfront') || raw.includes('all-upfront')) return 'All Upfront';
        // common alternate spellings
        if (raw.includes('no-upfront') || raw.includes('noupfront')) return 'No Upfront';
        if (raw.includes('partial-upfront')) return 'Partial Upfront';
        if (raw.includes('all-upfront')) return 'All Upfront';
        // fallback: title-case the raw value replacing hyphens/underscores with spaces
        return raw.replaceAll(/[-_]+/g, ' ').replaceAll(/\b\w/g, (c: string) => c.toUpperCase());
      };

      rows.push({
        raw: objRaw,
        startDate: startIso,
        endDate: obj['endDate'] ? this.normalizeDate(obj['endDate']) ?? undefined : undefined,
        count,
        instanceClass: (obj['instanceClass'] ?? obj['Instance Type'] ?? objRaw['Instance Type'] ?? ''),
        region: (obj['region'] ?? objRaw['Region'] ?? ''),
        multiAz: ((obj['multiAZ'] ?? objRaw['multiAZ'] ?? objRaw['multiAz'] ?? '')).toLowerCase() === 'true',
        engine: finalEngineToken,
        edition: finalEdition,
        upfrontPayment: normalizeUpfront(obj['upfront'] ?? obj['RI Type'] ?? objRaw['RI Type'] ?? objRaw['RI Type']),
        durationMonths: durationMonths
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

    // Diagnostics: expose parse summary to console for developer visibility
    try {
      console.debug('[RiCSVParserService] parsed rows:', rows.length, 'columns:', headers.length, 'sampleRow:', rows[0] ? { startDate: rows[0].startDate, instanceClass: rows[0].instanceClass, region: rows[0].region } : null);
      console.info('[RiCSVParserService] parsed rows:', rows.length, 'columns:', headers.length, 'sampleRow:', rows[0] ? { startDate: rows[0].startDate, instanceClass: rows[0].instanceClass, region: rows[0].region } : null);
    } catch (e) {
      // swallow diagnostics errors
      // eslint-disable-next-line no-console
      console.debug('[RiCSVParserService] diagnostics error', e);
      // eslint-disable-next-line no-console
      console.info('[RiCSVParserService] diagnostics error', e);
    }

    return { riPortfolio: { metadata, rows } };
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

@Injectable({ providedIn: 'root' })
export class RiImportService {
  RI_IMPORT_KEY = 'ri-import';

  constructor(
    private readonly storageService: StorageService,
    private readonly riCSVParserService: RiCSVParserService,
    private readonly riDataService: RiDataService,
    private readonly pageState: PageStateService
  ) {}

  async saveImportResult(riImportParseResult: RiImportParseResult): Promise<string | null> {
    if (riImportParseResult.errors) {
      this.riDataService.clear();
      try {
        console.debug('[RiImportService] import errors:', riImportParseResult.errors.slice(0, 10));
        console.info('[RiImportService] import errors:', riImportParseResult.errors.slice(0, 10));
      } catch {}
      return riImportParseResult.errors.join('; ');
    }
    if (riImportParseResult.riPortfolio) {
      this.riDataService.setRiPortfolio(riImportParseResult.riPortfolio);
      // persist via generic storage and notify the framework coordinator
      await this.storageService.set(this.RI_IMPORT_KEY, riImportParseResult.riPortfolio as any);
      await this.pageState.saveKey(this.RI_IMPORT_KEY);
      try {
        console.debug('[RiImportService] saved import result:', riImportParseResult.riPortfolio.metadata.rowsCount, 'rows, key:', this.RI_IMPORT_KEY);
        console.info('[RiImportService] saved import result:', riImportParseResult.riPortfolio.metadata.rowsCount, 'rows, key:', this.RI_IMPORT_KEY);
      } catch {}
    }
    return null;
  }

  async loadDefaultRiPortfolioIfMissing(): Promise<void> {
    try {
      const existing = await this.storageService.get(this.RI_IMPORT_KEY);
      if (existing) {
        this.riDataService.setRiPortfolio(existing as RiPorftolio);
        return;
      }

      const res = await fetch('/assets/cloudability-rds-reservations.csv');
      if (!res.ok) return;
      const txt = await res.text();

      const parsed = await this.riCSVParserService.parseText(txt, 'default-assets');

      await this.saveImportResult(parsed);

    } catch (e) {
      console.error('[DEFAULT_IMPORT] failed to load default import', e);
    }
  }
}
