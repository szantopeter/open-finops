import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import Papa from 'papaparse';

import type { PricingData, OnDemandPricing, SavingsOptionsMap, SavingsTerm, PurchaseOption, SavingsKey, Deployment, LicenseToken, SavingsOption } from '../models/pricing.model';
import type { RiRow } from '../models/ri-portfolio.model';
import { RiCategorizatorCalculator } from 'src/app/calculators/ri-categorizator/ri-categorizator-calculator';

@Injectable({ providedIn: 'root' })
export class PricingLoaderService {

  constructor(private readonly http: HttpClient) {}

  async loadPricingForRiRow(riRow: RiRow): Promise<PricingData> {
    const filePath = this.getPricingFilePath(riRow);
    const csvText = await lastValueFrom(this.http.get(filePath, { responseType: 'text' }));
    const parsed = Papa.parse(csvText, { header: true });
    const data = parsed.data as Record<string, string>[];
    const rows = data.filter((row) => row.instance === riRow.instanceClass);

    const onDemandRow = rows.find((row) => row.type === 'onDemand');
    if (!onDemandRow) {
      throw new Error(`No onDemand row found for instance ${riRow.instanceClass} in file ${filePath}`);
    }
    const onDemandRowTyped = onDemandRow as Record<string, string>;

    const onDemand: OnDemandPricing = {
      hourly: parseFloat(onDemandRowTyped.hourly),
      daily: parseFloat(onDemandRowTyped.daily),
      adjustedAmortisedHourly: parseFloat(onDemandRowTyped.adjustedAmortisedHourly),
      adjustedAmortisedDaily: parseFloat(onDemandRowTyped.adjustedAmortisedDaily),
      sku: onDemandRowTyped.sku
    };

    const savingsRows = rows.filter((row) => row.type === 'savings');
    const savingsOptions = {} as Record<SavingsKey, SavingsOption | null>;
    for (const row of savingsRows) {
      const key = `${row.term}_${row.purchaseOption}` as SavingsKey;
      savingsOptions[key] = {
        term: row.term as SavingsTerm,
        purchaseOption: row.purchaseOption as PurchaseOption,
        upfront: row.upfront ? parseFloat(row.upfront) : null,
        hourly: row.hourly ? parseFloat(row.hourly) : null,
        daily: row.daily ? parseFloat(row.daily) : null,
        adjustedAmortisedHourly: row.adjustedAmortisedHourly ? parseFloat(row.adjustedAmortisedHourly) : null,
        adjustedAmortisedDaily: row.adjustedAmortisedDaily ? parseFloat(row.adjustedAmortisedDaily) : null,
      };
    }

    return {
      region: onDemandRowTyped.region,
      instance: onDemandRowTyped.instance,
      deployment: onDemandRowTyped.deployment as Deployment,
      engine: onDemandRowTyped.engine,
      license: (onDemandRowTyped.license === 'byol' || onDemandRowTyped.license === 'li') ? onDemandRowTyped.license as LicenseToken : undefined,
      onDemand,
      savingsOptions: savingsOptions as SavingsOptionsMap
    };
  }

  private getPricingFilePath(riRow: RiRow): string {
    const riKey = RiCategorizatorCalculator.getPricingKey(riRow);
    // Build the exact file name from riKey fields
    const instanceFamily = riRow.instanceClass.split('.')[1][0]; // Extract instance family (e.g., 'r' from 'db.r5.xlarge')
    const fileName = `${riKey.region}_${riKey.engineKey}_${riKey.deployment}_${instanceFamily}.csv`;
    return `assets/pricing/${fileName}`;
  }
}
