import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import Papa from 'papaparse';
import { PricingKey, PricingData, OnDemandPricing, SavingsOptionsMap, SavingsTerm, PurchaseOption, SavingsKey, Deployment, LicenseToken, SavingsOption } from "src/app/components/ri-portfolio-upload/models/pricing.model";

export class MigrationRecommendation {
    constructor(
        public originalPricingKey: PricingKey,
        public originalPricingData: PricingData,
        public count: number,
        public recommendedPricingKey: PricingKey,
        public recommendedPricingData: PricingData
    ) {} 
}

interface InstanceClassInfo {
  family: string;
  generation: number;
  suffix: string;
  size: string;
}

@Injectable({ providedIn: 'root' })
export class MigrationRecommender {

  private readonly pricingCache = new Map<string, PricingData>();

  constructor(private readonly http: HttpClient) {}

  /**
   * Makes migration recommendations by finding higher generations within the same instance family and using the same size, 
   * but lower price. For example for a db.m5.large, it would look for db.m6g.large and db.m6i.large options. 
   * Prices are compared using the 1year all upfront savings plan.
   *
   * @param categoryCounts The categorized RI portfolio.
   * @returns A list of migration recommendations.
   */
  public async recommendMigrations(categoryCounts: Map<PricingKey, number>): Promise<MigrationRecommendation[]> {
    const recommendations: MigrationRecommendation[] = [];

    for (const [pricingKey, count] of categoryCounts.entries()) {
      // Use a simpler algorithm: find cheaper same-size instances in the same pricing file
      const instanceInfo = this.parseInstanceClass(pricingKey.instanceClass);
      if (!instanceInfo) continue;

      try {
        const originalPricingData = await this.loadPricingData(pricingKey);
        const recommendation = await this.findCheaperInstanceClass(pricingKey, instanceInfo);
        if (recommendation) {
          recommendations.push(new MigrationRecommendation(
            pricingKey,
            originalPricingData,
            count,
            recommendation.key,
            recommendation.pricingData
          ));
        }
      } catch (error) {
        console.warn(`Failed to process pricing for ${pricingKey.instanceClass}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * CSV-based search for a cheaper instance within the same family and size.:
   * - Read pricing file for the pricing key
   * - Filter for savings rows that correspond to '1yr' + 'All Upfront'
   * - Filter rows to the same size suffix (e.g. '.xlarge')
   * - Sort by instance alphabetically ascending
   * - Scan from top: when we find the original instance remember price; when we find any row with upfront < originalPrice remember candidate; at the end pick the highest candidate below original
   */
  private async findCheaperInstanceClass(pricingKey: PricingKey, instanceInfo: InstanceClassInfo): Promise<{ key: PricingKey; pricingData: PricingData } | null> {
    const filePath = this.getPricingFilePath(pricingKey);
    const csvText = await lastValueFrom(this.http.get(filePath, { responseType: 'text' }));
    const parsed = Papa.parse(csvText, { header: true });
    const rows = (parsed.data as Record<string, string>[]).filter(Boolean);

    // Filter savings rows for 1yr_All Upfront
    const savingsRows = rows.filter(r => r.type === 'savings' && `${r.term}_${r.purchaseOption}` === '1yr_All Upfront');

    // Filter to same size suffix: match dot + size at the end
    const sizeSuffix = `.${instanceInfo.size}`;
    const sameSizeRows = savingsRows.filter(r => r.instance?.endsWith(sizeSuffix));

    //This is needed because without this db.x2iedn.4xlarge would be recommended to be migrated to db.x2iezn.4xlarge because 'z' comes before 'd' alphabetically
    //it is cheaper. In reality edn and ezn machines have different spec and not compatible with each other.
    const sameSizeAndCompatibleSuffixRows = sameSizeRows.filter(r => {
      const rowInstanceInfo = this.parseInstanceClass(r.instance);
      if (!rowInstanceInfo) return false;
      const originalSuffix = instanceInfo.suffix;
      const rowSuffix = rowInstanceInfo.suffix;
      if (originalSuffix.length <= 1) {
        return true;
      } else {
        return rowSuffix.length === originalSuffix.length && rowSuffix.slice(1) === originalSuffix.slice(1);
      }
    });

    // Sort alphabetically by instance
    sameSizeAndCompatibleSuffixRows.sort((a, b) => (a.instance || '').localeCompare(b.instance || ''));

    // Scan: find original price then keep a single proposed instance/upfront that is the
    // highest upfront value below the original price. Avoid storing an array of candidates.
    let originalUpfront: number | null = null;
    let proposedInstance: string | null = null;
    let proposedUpfront: number | null = null;

    for (const row of sameSizeAndCompatibleSuffixRows) {
      const upfront = row.upfront ? Number.parseFloat(row.upfront) : null;
      if (upfront === null || Number.isNaN(upfront)) continue;

      // When we encounter the original instance, record its upfront and initialize the proposal
      if (!originalUpfront && row.instance === pricingKey.instanceClass) {
        originalUpfront = upfront;
        proposedUpfront = upfront;
        proposedInstance = row.instance!;
        continue;
      }

      // Only consider proposals after we've seen the original
      if (originalUpfront !== null && proposedUpfront !== null) {
        // candidate must be cheaper than original and better (higher) than current proposal
        if (upfront < proposedUpfront ) {
          proposedUpfront = upfront;
          proposedInstance = row.instance!;
        }
      }
    }

    // If we never found the original row or no better proposal was found, return null
    if (originalUpfront === null || proposedUpfront === null || proposedUpfront === originalUpfront) return null;

    const recommendedKey = new PricingKey(pricingKey.region, proposedInstance!, pricingKey.deployment, pricingKey.engineKey);
    // reuse loadPricingData to build PricingData for the chosen instance
    const pricingData = await this.loadPricingData(recommendedKey);
    return { key: recommendedKey, pricingData };
  }

  /**
   * Parses an instance class into its components.
   * Example: 'db.m5.large' -> { family: 'm', generation: 5, suffix: '', size: 'large' }
   * Example: 'db.m6g.large' -> { family: 'm', generation: 6, suffix: 'g', size: 'large' }
   * Example: 'db.t4g.medium' -> { family: 't', generation: 4, suffix: 'g', size: 'medium' }
   */
  private parseInstanceClass(instanceClass: string): InstanceClassInfo | null {
    // Format: db.<family><generation><suffix>.<size>
    // Examples: db.m5.large, db.m6g.xlarge, db.t4g.medium, db.r7i.2xlarge
    const regex = /^db\.([a-z])(\d+)([a-z]*)\.(.+)$/;
    const match = regex.exec(instanceClass);
    if (!match) {
      return null;
    }

    return {
      family: match[1],
      generation: Number.parseInt(match[2], 10),
      suffix: match[3] || '',
      size: match[4]
    };
  }

  

  /**
   * Loads pricing data from a CSV file for a given pricing key.
   */
  private async loadPricingData(pricingKey: PricingKey): Promise<PricingData> {
    const cacheKey = pricingKey.toString();
    
    // Check cache first
    if (this.pricingCache.has(cacheKey)) {
      return this.pricingCache.get(cacheKey)!;
    }

    const filePath = this.getPricingFilePath(pricingKey);
    const csvText = await lastValueFrom(this.http.get(filePath, { responseType: 'text' }));
    const parsed = Papa.parse(csvText, { header: true });
    const data = parsed.data as Record<string, string>[];
    const rows = data.filter((row) => row.instance === pricingKey.instanceClass);

    const onDemandRow = rows.find((row) => row.type === 'onDemand');
    if (!onDemandRow) {
      throw new Error(`No onDemand row found for instance ${pricingKey.instanceClass} in file ${filePath}`);
    }

    const onDemand: OnDemandPricing = {
      hourly: Number.parseFloat(onDemandRow.hourly),
      daily: Number.parseFloat(onDemandRow.daily),
      adjustedAmortisedHourly: Number.parseFloat(onDemandRow.adjustedAmortisedHourly),
      adjustedAmortisedDaily: Number.parseFloat(onDemandRow.adjustedAmortisedDaily),
      sku: onDemandRow.sku
    };

    const savingsRows = rows.filter((row) => row.type === 'savings');
    const savingsOptions = {} as Record<SavingsKey, SavingsOption | null>;
    for (const row of savingsRows) {
      const key = `${row.term}_${row.purchaseOption}` as SavingsKey;
      savingsOptions[key] = {
        term: row.term as SavingsTerm,
        purchaseOption: row.purchaseOption as PurchaseOption,
        upfront: row.upfront ? Number.parseFloat(row.upfront) : null,
        hourly: row.hourly ? Number.parseFloat(row.hourly) : null,
        daily: row.daily ? Number.parseFloat(row.daily) : null,
        adjustedAmortisedHourly: row.adjustedAmortisedHourly ? Number.parseFloat(row.adjustedAmortisedHourly) : null,
        adjustedAmortisedDaily: row.adjustedAmortisedDaily ? Number.parseFloat(row.adjustedAmortisedDaily) : null,
      };
    }

    // Extract license from the engineKey
    const engineParts = pricingKey.engineKey.split('-');
    let license: LicenseToken | undefined;
    if (engineParts.includes('byol')) {
      license = 'byol';
    } else if (engineParts.includes('li')) {
      license = 'li';
    }

    const pricingData = {
      region: onDemandRow.region,
      instance: onDemandRow.instance,
      deployment: onDemandRow.deployment as Deployment,
      engine: pricingKey.engineKey,
      license,
      onDemand,
      savingsOptions: savingsOptions as SavingsOptionsMap
    };

    // Cache the result
    this.pricingCache.set(cacheKey, pricingData);

    return pricingData;
  }

  /**
   * Constructs the pricing file path from a pricing key.
   */
  private getPricingFilePath(pricingKey: PricingKey): string {
    // Extract instance family (e.g., 'r' from 'db.r5.xlarge')
    const instanceFamily = pricingKey.instanceClass.split('.')[1][0];
    const fileName = `${pricingKey.region}_${pricingKey.engineKey}_${pricingKey.deployment}_${instanceFamily}.csv`;
    return `assets/pricing/${fileName}`;
  }
}