import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PricingRecord } from '../../models/pricing-record.model';
import { RiPorftolio } from '../../models/ri-portfolio.model';

@Injectable({ providedIn: 'root' })
export class PricingDataService {

  constructor(private readonly http: HttpClient) {}

  private loadPricingForPaths(paths: string[]): Observable<{ pricingRecords: PricingRecord[]; missingFiles: string[] }> {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return throwError(() => new Error('no pricing paths provided'));
    }

    // For each path, attempt to GET it, but convert errors to null so a single 404 doesn't fail all.
    const requests = paths.map((path) => this.http.get<any>(`/assets/pricing/${path}`).pipe(
      // map success to payload, errors become null
      catchError(() => [null] as any)
    ));

    return forkJoin(requests).pipe(
      map((pricingFiles) => {
        const pricingRecords: PricingRecord[] = [];
        const missingFiles: string[] = [];
        for (let i = 0; i < pricingFiles.length; i++) {
          const pricingFile = pricingFiles[i];
          if (pricingFile == null) {
            missingFiles.push(paths[i]);
            continue;
          }

          // The pricing files produced by the generator have a different shape
          // Example file keys: region, instance, deployment (single-az|multi-az), engine, license, onDemand, savingsOptions
          // We need to expand savingsOptions (which contains entries like '1yr_Partial Upfront') into one PricingRecord per variant
          const fileObj = pricingFile as Record<string, any>;
          const instanceClass = fileObj.instance || fileObj.instanceClass || '';
          const region = fileObj.region || '';
          const multiAz = (fileObj.deployment || '').toString().toLowerCase() === 'multi-az' || Boolean(fileObj.multiAz);
          const engine = fileObj.engine || '';

          const savings = (fileObj.savingsOptions || {}) as Record<string, any>;
          const expanded = this.expandSavings(instanceClass, region, multiAz, engine, fileObj, savings);
          pricingRecords.push(...expanded);
        }
        if (!pricingRecords || pricingRecords.length === 0) throw new Error('no pricing files available');

        // Diagnostics: surface what was loaded to help debugging asset lookup
        try {
          // limit verbosity in console
          console.debug('[PricingDataService] requested paths:', paths);
          console.info('[PricingDataService] requested paths:', paths);
          console.debug('[PricingDataService] missing files:', missingFiles.slice(0, 10));
          console.info('[PricingDataService] missing files:', missingFiles.slice(0, 10));
          console.debug('[PricingDataService] pricingRecords loaded:', pricingRecords.length, 'sample:', pricingRecords.slice(0, 5).map((r: any) => ({ instance: r.instanceClass, region: r.region, duration: r.durationMonths, upfront: r.upfrontCost })));
          console.info('[PricingDataService] pricingRecords loaded:', pricingRecords.length, 'sample:', pricingRecords.slice(0, 5).map((r: any) => ({ instance: r.instanceClass, region: r.region, duration: r.durationMonths, upfront: r.upfrontCost })));
        } catch (e) {
          // swallow diagnostics errors

          console.debug('[PricingDataService] diagnostics error', e);

          console.info('[PricingDataService] diagnostics error', e);
        }

        return { pricingRecords, missingFiles };
      }),
      catchError((err) => throwError(() => new Error(`Failed to load pricing data: ${err?.message ?? err}`)))
    );
  }

  /**
   * Public API: accept either a RIPortfolio-like object (`{ rows: [...] }`) or an
   * explicit array of paths and load the pricing files for them.
   */
  // Public API: accept a RIPortfolio object and load pricing files for rows it contains
  loadPricingForPortfolio(riPortfolio: RiPorftolio): Observable<{ pricingRecords: PricingRecord[]; missingFiles: string[] }> {
    const rows = riPortfolio?.rows || [];
    const candidatePaths = new Set<string>();
    for (const r of rows) {
      const region = r.region || '';
      const instance = r.instanceClass || '';
      const deployment = r.multiAz ? 'multi-az' : 'single-az';

      let engineKey = r.engine || 'mysql';
      if (r.edition) engineKey = `${engineKey}-${r.edition}`;

      const p = `${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}.json`;
      candidatePaths.add(p);
    }

    const paths = Array.from(candidatePaths);
    return this.loadPricingForPaths(paths);
  }

  private expandSavings(
    instanceClass: string,
    region: string,
    multiAz: boolean,
    engine: string,
    fileObj: Record<string, any>,
    savings: Record<string, any>
  ): PricingRecord[] {
    const records: PricingRecord[] = [];
    for (const savKey of Object.keys(savings)) {
      const sav = savings[savKey];
      if (!sav) continue;

      // parse duration and upfront kind
      let durationMonths = 12;
      if (savKey.toLowerCase().startsWith('3yr')) durationMonths = 36;

      const parts = savKey.split('_');
      const upfrontDescriptor = parts.length > 1 ? parts.slice(1).join('_').replaceAll('_', ' ') : 'No Upfront';
      const upfrontPayment = upfrontDescriptor;

      let dailyReservedRate: number | undefined;
      if (typeof sav.daily === 'number') {
        dailyReservedRate = sav.daily;
      } else if (sav.effectiveHourly) {
        dailyReservedRate = Number((sav.effectiveHourly * 24).toFixed(6));
      }

      const upfrontCost = typeof sav.upfront === 'number' ? sav.upfront : undefined;
      const dailyOnDemandRate = fileObj.onDemand?.daily ?? (fileObj.onDemand?.hourly ? (fileObj.onDemand.hourly * 24) : undefined);

      const pricingRecord = new PricingRecord({
        instanceClass,
        region,
        multiAz,
        engine,
        edition: null,
        upfrontPayment,
        durationMonths,
        dailyOnDemandRate,
        dailyReservedRate,
        upfrontCost
      });
      records.push(pricingRecord);
    }
    return records;
  }
}
