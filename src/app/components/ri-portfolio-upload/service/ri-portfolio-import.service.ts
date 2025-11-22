import { Injectable } from '@angular/core';

import { PricingLoaderService } from './pricing-loader.service';
import { RiPortfolioDataService } from './ri-portfolio-data.service';
import { StorageService } from '../../../storage-service/storage.service';
import { PricingData } from '../models/pricing.model';
import { RiRow, RiPortfolio, RiImportMetadata } from '../models/ri-portfolio.model';

export interface RiImportParseResult {
  riPortfolio?: RiPortfolio;
  errors?: string[];
}

const REQUIRED_HEADERS = ['Start', 'Instance Type', 'Region', 'Count', 'Term', 'Product', 'End', 'multiAZ', 'RI Type'];

@Injectable({ providedIn: 'root' })
export class RiCSVParserService {

  constructor(private readonly pricingLoader: PricingLoaderService) {}

  async parseText(text: string, source = 'clipboard', fileLastModifiedIso?: string): Promise<RiImportParseResult> {
    if (!text) return { errors: ['empty input'] };

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { errors: ['no rows'] };

    const header = this.parseCsvLine(lines[0]);
    const headers = header.map(h => h.trim());

    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length) return { errors: [`missing required headers: ${missing.join(', ')}`] };

    const rows: RiRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      if (row.length === 0) continue;

      const objRaw: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        objRaw[headers[j]] = row[j] ?? '';
      }

      // check required fields are not empty
      const requiredFields = ['Start', 'Instance Type', 'Region', 'Count', 'Term', 'Product', 'End', 'multiAZ', 'RI Type'];
      const missingFields = requiredFields.filter(f => !objRaw[f]);
      if (missingFields.length) {
        errors.push(`missing required fields at line ${i + 1}: ${missingFields.join(', ')}`);
        continue;
      }

      // basic normalization
      const start = objRaw['Start'];
      const startIso = this.parseDate(start);
      if (!startIso) {
        errors.push(`invalid Start at line ${i + 1}`);
        continue;
      }

      const endIso = this.parseDate(objRaw['End']);
      if (!endIso) {
        errors.push(`invalid End at line ${i + 1}`);
        continue;
      }

      const count = Number.parseInt(objRaw['Count'], 10);
      if (Number.isNaN(count) || count <= 0) {
        errors.push(`invalid Count at line ${i + 1}`);
        continue;
      }

      if (!objRaw['Instance Type']) {
        errors.push(`missing Instance Type at line ${i + 1}`);
        continue;
      }

      if (!objRaw['Region']) {
        errors.push(`missing Region at line ${i + 1}`);
        continue;
      }

      if (!objRaw['multiAZ']) {
        errors.push(`missing multiAZ at line ${i + 1}`);
        continue;
      }

      // derive duration from Term
      let durationMonths: number;
      const termRaw = objRaw['Term'];
      const t = termRaw.toString().toLowerCase();
      if (t.includes('1 year') || t.includes('1yr') || t.includes('12')) durationMonths = 12;
      else if (t.includes('3 year') || t.includes('3yr') || t.includes('36')) durationMonths = 36;
      else {
        errors.push(`invalid Term at line ${i + 1}`);
        continue;
      }

      const { engine, edition } = this.parseEngine(objRaw['Product']);

      if (!engine) {
        errors.push(`invalid engine at line ${i + 1}`);
        continue;
      }

      if (!edition) {
        errors.push(`invalid edition at line ${i + 1}`);
        continue;
      }

      rows.push({
        id: objRaw['RI ID'] || `${objRaw['Instance Type']}-${objRaw['Region']}-${i}`,
        raw: objRaw,
        startDate: startIso,
        endDate: endIso,
        count,
        instanceClass: objRaw['Instance Type'],
        region: objRaw['Region'],
        multiAz: objRaw['multiAZ'].toLowerCase() === 'true',
        engine,
        edition,
        upfrontPayment: this.normalizeUpfront(objRaw['RI Type']),
        durationMonths,
        type: 'actual'
      });
    }

    const rowsWithPricing = await Promise.all(rows.map(async (riRow) => {
      try {
        const pricingData = await this.pricingLoader.loadPricingForRiRow(riRow);
        return { riRow, pricingData };
      } catch (error) {
        errors.push(`Failed to load pricing for row: ${riRow.instanceClass} in ${riRow.region} - ${(error as Error).message}`);
        return null; // will filter out
      }
    }));

    if (errors.length) return { errors };

    const validRows = rowsWithPricing.filter(row => row !== null) as { riRow: RiRow; pricingData: PricingData }[];

    const firstFullYear = this.computeFirstFullYear(validRows.map(r => r.riRow));

    const metadata: RiImportMetadata = {
      source,
      importedAt: new Date().toISOString(),
      fileLastModified: fileLastModifiedIso,
      firstFullYear
    };

    return { riPortfolio: { metadata, rows: validRows } };
  }

  private normalizeEngine(dbEngine: string): string {
    const lower = (dbEngine || '').toString().toLowerCase();
    if (lower.includes('aurora') && lower.includes('mysql')) return 'aurora-mysql';
    if (lower.includes('aurora') && (lower.includes('postgres') || lower.includes('postgresql'))) return 'aurora-postgresql';
    if (lower.includes('mysql')) return 'mysql';
    if (lower.includes('postgres') || lower.includes('postgresql')) return 'postgresql';
    if (lower.includes('mariadb')) return 'mariadb';
    if (lower.includes('oracle')) return 'oracle';
    if (lower.includes('sql server') || lower.includes('sqlserver')) return 'sqlserver';
    return dbEngine || '';
  }

  private normalizeUpfront(u: any): string {
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
  }

  private parseEngine(rawEngine: string): { engine: string; edition: string | undefined } {
    // Clean engine string and extract parenthetical license tokens
    const engineStr = (rawEngine || '').toString();
    const parenMatch = /\(([^)]+)\)/.exec(engineStr);
    const parenToken = parenMatch ? parenMatch[1].toString().toLowerCase() : null;
    const engineNoParen = engineStr.replace(/\([^)]+\)/, '').trim();
    const engineBaseLower = engineNoParen.toString().toLowerCase();

    const enginesWithVariants = new Set(['oracle', 'db2', 'sqlserver']);

    // Derive edition: try to extract from engine token
    let editionOnly: string | undefined = undefined;
    // if engineNoParen contains hyphenated tokens like 'oracle-se2', take the tail as edition
    if (engineNoParen.includes('-')) {
      const parts = engineNoParen.split(/[-\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) editionOnly = parts.slice(1).join('-');
    }

    // Normalize license token: prefer parenthesis content
    let licenseToken: string | undefined = undefined;
    if (parenToken) licenseToken = parenToken;
    if (licenseToken) {
      // normalize common phrases
      if (licenseToken.includes('bring') || licenseToken.includes('byol')) licenseToken = 'byol';
      else if (licenseToken.includes('license') || licenseToken.includes('included') || licenseToken.includes('li')) licenseToken = 'li';
    }

    // Final normalized tokens
    const engineNormalizedBase = this.normalizeEngine(engineBaseLower || editionOnly || '');

    // For engines that support editions (oracle, sqlserver, db2), keep engine and edition separate
    // For other engines, append license to the engine token itself
    let finalEngineToken: string;
    let finalEdition: string | undefined = undefined;

    if (enginesWithVariants.has(engineNormalizedBase)) {
      // Keep engine as base (e.g., 'oracle')
      finalEngineToken = engineNormalizedBase;
      // Build edition with license suffix (e.g., 'se2-byol')
      if (editionOnly) finalEdition = editionOnly.toString();
      if (finalEdition && licenseToken) finalEdition = `${finalEdition}-${licenseToken}`;
      else if (!finalEdition && licenseToken) finalEdition = licenseToken;
    } else {
      // For engines without editions (mysql, postgresql, etc.), append license to engine
      finalEngineToken = engineNormalizedBase + (licenseToken ? `-${licenseToken}` : '');
    }

    if (!finalEdition) finalEdition = 'standard';

    return { engine: finalEngineToken, edition: finalEdition };
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

  private parseDate(input: string): Date | undefined {
    if (!input) return undefined;
    const trimmed = input.toString().trim();
    const m = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(trimmed);
    if (!m) return undefined;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return undefined;
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return undefined;
    return dt;
  }

  private computeFirstFullYear(rows: RiRow[]): number {
    if (!rows || rows.length === 0) {
      return new Date().getUTCFullYear() + 1;
    }

    const endDates = rows
      .map(r => r.endDate)
      // .filter((d): d is string => !!d)
      .map(d => d.valueOf())
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
}

@Injectable({ providedIn: 'root' })
export class RiImportService {
  RI_IMPORT_KEY = 'ri-import';

  constructor(
    private readonly storageService: StorageService,
    private readonly riCSVParserService: RiCSVParserService,
    private readonly riDataService: RiPortfolioDataService
  ) {}

  async saveImportResult(riImportParseResult: RiImportParseResult): Promise<string | null> {
    if (riImportParseResult.errors) {
      this.riDataService.clear();
      try {
        console.debug('[RiImportService] import errors:', riImportParseResult.errors.slice(0, 10));
        console.info('[RiImportService] import errors:', riImportParseResult.errors.slice(0, 10));
      } catch {
        // ignore diagnostics logging failures
      }
      return riImportParseResult.errors.join('; ');
    }
    if (riImportParseResult.riPortfolio) {
      this.riDataService.setRiPortfolio(riImportParseResult.riPortfolio);
      // persist via generic storage and notify the framework coordinator
      await this.storageService.set(this.RI_IMPORT_KEY, riImportParseResult.riPortfolio as any);
      try {
        console.debug('[RiImportService] saved import result, key:', this.RI_IMPORT_KEY);
        console.info('[RiImportService] saved import result, key:', this.RI_IMPORT_KEY);
      } catch {
        // ignore logging failures
      }
    }
    return null;
  }

  async loadDefaultRiPortfolioIfMissing(): Promise<void> {
    try {
      const existing = await this.storageService.get(this.RI_IMPORT_KEY);
      if (existing) {
        this.riDataService.setRiPortfolio(existing as RiPortfolio);
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
