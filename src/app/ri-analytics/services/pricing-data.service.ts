import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';

import { PricingRecord, PricingRecordProps } from '../models/pricing-record.model';

@Injectable({ providedIn: 'root' })
export class PricingDataService {
  private readonly indexPath = '/assets/pricing/index.json';

  constructor(private readonly http: HttpClient) {}

  /**
   * Load all pricing JSON files listed in assets/pricing/index.json
   * The index file must be an array of filenames (e.g. ["rds-pricing-us-east-1.json"]).
   */
  loadAllPricing(): Observable<PricingRecord[]> {
    return this.http.get<string[]>(this.indexPath).pipe(
      mergeMap((files) => {
        if (!files || !Array.isArray(files) || files.length === 0) {
          return throwError(() => new Error('pricing index empty or invalid'));
        }
        const requests = files.map((f) => this.http.get<PricingRecordProps>(`/assets/pricing/${f}`));
        return forkJoin(requests).pipe(map((arr) => arr.map((p) => new PricingRecord(p))));
      }),
      catchError((err) => throwError(() => new Error(`Failed to load pricing data: ${err?.message ?? err}`)))
    );
  }

  /**
   * Load pricing files by explicitly supplied relative paths (relative to /assets/pricing).
   * This avoids requiring an index.json and allows callers to request only the files they need.
   */
  /**
   * Load pricing files by explicitly supplied relative paths (relative to /assets/pricing).
   * Returns an object containing the loaded records and list of missing paths.
   */
  loadPricingForPaths(paths: string[]): Observable<{ records: PricingRecord[]; missing: string[] }> {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return throwError(() => new Error('no pricing paths provided'));
    }
    // For each path, attempt to GET it, but convert errors to null so a single 404 doesn't fail all.
    const requests = paths.map((p) => this.http.get<any>(`/assets/pricing/${p}`).pipe(
      // map success to payload, errors become null

      catchError(() => [null] as any)
    ));

    return forkJoin(requests).pipe(
      map((arr) => {
        const records: PricingRecord[] = [];
        const missing: string[] = [];
        for (let i = 0; i < arr.length; i++) {
          const val = arr[i];
          if (val == null) {
            missing.push(paths[i]);
            continue;
          }

          // The pricing files produced by the generator have a different shape
          // Example file keys: region, instance, deployment (single-az|multi-az), engine, license, onDemand, savingsOptions
          // We need to expand savingsOptions (which contains entries like '1yr_Partial Upfront') into one PricingRecord per variant
          const fileObj = val as any;
          const instanceClass = fileObj.instance || fileObj.instanceClass || '';
          const region = fileObj.region || '';
          const multiAz = (fileObj.deployment || '').toString().toLowerCase() === 'multi-az' || Boolean(fileObj.multiAz);
          const engine = fileObj.engine || '';

          const savings = fileObj.savingsOptions || {};
          // savings keys look like '1yr_Partial Upfront' or '3yr_All Upfront' or may be null
          for (const savKey of Object.keys(savings)) {
            const sav = savings[savKey];
            if (!sav) continue;
            // parse duration and upfront kind
            let durationMonths = 12;
            if (savKey.startsWith('3yr') || savKey.toLowerCase().startsWith('3yr')) durationMonths = 36;
            // upfront descriptor is text after the underscore
            const parts = savKey.split('_');
            const upfrontDescriptor = parts.length > 1 ? parts.slice(1).join('_').replace(/_/g, ' ') : 'No Upfront';
            const upfrontPayment = upfrontDescriptor;

            const dailyReservedRate = typeof sav.daily === 'number' ? sav.daily : (sav.effectiveHourly ? Number((sav.effectiveHourly * 24).toFixed(6)) : undefined);
            const upfrontCost = typeof sav.upfront === 'number' ? sav.upfront : undefined;

            const pr = new PricingRecord({
              instanceClass,
              region,
              multiAz,
              engine,
              edition: null,
              upfrontPayment: upfrontPayment as any,
              durationMonths,
              dailyOnDemandRate: fileObj.onDemand?.daily ?? fileObj.onDemand?.hourly ? (fileObj.onDemand.hourly * 24) : undefined,
              dailyReservedRate: dailyReservedRate,
              upfrontCost: upfrontCost
            });
            records.push(pr);
          }
        }
        if (!records || records.length === 0) throw new Error('no pricing files available');
        return { records, missing };
      }),
      catchError((err) => throwError(() => new Error(`Failed to load pricing data: ${err?.message ?? err}`)))
    );
  }
}
