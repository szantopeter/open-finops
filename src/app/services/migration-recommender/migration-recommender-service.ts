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
      const instanceInfo = this.parseInstanceClass(pricingKey.instanceClass);
      if (!instanceInfo) {
        continue; // Skip instances that can't be parsed
      }

      try {
        // Load pricing data for the current instance
        const originalPricingData = await this.loadPricingData(pricingKey);
        
        // Find cheaper alternatives in higher generations
        const cheaperAlternative = await this.findCheaperHigherGeneration(
          pricingKey,
          instanceInfo,
          originalPricingData
        );

        if (cheaperAlternative) {
          recommendations.push(new MigrationRecommendation(
            pricingKey,
            originalPricingData,
            count,
            cheaperAlternative.key,
            cheaperAlternative.pricingData
          ));
        }
      } catch (error) {
        // Skip instances where pricing data can't be loaded
        console.warn(`Failed to load pricing data for ${pricingKey.instanceClass}:`, error);
      }
    }

    return recommendations;
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
   * Finds the cheapest higher generation instance within the same family.
   * Returns null if no cheaper option is found.
   */
  private async findCheaperHigherGeneration(
    originalKey: PricingKey,
    originalInfo: InstanceClassInfo,
    originalPricingData: PricingData
  ): Promise<{ key: PricingKey; pricingData: PricingData } | null> {
    const originalPrice = this.get1YearAllUpfrontPrice(originalPricingData);
    if (originalPrice === null) {
      return null; // Can't compare if original doesn't have 1yr all upfront pricing
    }

    let cheapestAlternative: { key: PricingKey; pricingData: PricingData; price: number } | null = null;

    // Check generations from current+1 to current+5 (reasonable upper bound to limit HTTP calls)
    for (let gen = originalInfo.generation + 1; gen <= originalInfo.generation + 5; gen++) {
      const betterAlternative = await this.findCheaperAlternativeInGeneration(
        gen,
        originalKey,
        originalInfo,
        originalPrice,
        cheapestAlternative
      );
      
      if (betterAlternative) {
        cheapestAlternative = betterAlternative;
      }
    }

    return cheapestAlternative ? { key: cheapestAlternative.key, pricingData: cheapestAlternative.pricingData } : null;
  }

  /**
   * Searches for cheaper alternatives within a specific generation.
   */
  private async findCheaperAlternativeInGeneration(
    generation: number,
    originalKey: PricingKey,
    originalInfo: InstanceClassInfo,
    originalPrice: number,
    currentBest: { key: PricingKey; pricingData: PricingData; price: number } | null
  ): Promise<{ key: PricingKey; pricingData: PricingData; price: number } | null> {
    const suffixesToTry = ['', 'g', 'i', 'gd', 'id'];
    let bestAlternative = currentBest;

    for (const suffix of suffixesToTry) {
      const candidateInstanceClass = `db.${originalInfo.family}${generation}${suffix}.${originalInfo.size}`;
      const candidateKey = new PricingKey(
        originalKey.region,
        candidateInstanceClass,
        originalKey.deployment,
        originalKey.engineKey
      );

      try {
        const candidatePricingData = await this.loadPricingData(candidateKey);
        const candidatePrice = this.get1YearAllUpfrontPrice(candidatePricingData);

        if (candidatePrice !== null && candidatePrice < originalPrice) {
          if (!bestAlternative || candidatePrice < bestAlternative.price) {
            bestAlternative = {
              key: candidateKey,
              pricingData: candidatePricingData,
              price: candidatePrice
            };
          }
        }
      } catch (error: unknown) {
        // Pricing file doesn't exist or instance not found - skip
        console.debug(`Pricing not found for ${candidateInstanceClass}:`, error);
      }
    }

    return bestAlternative;
  }

  /**
   * Gets the 1-year all upfront daily amortized price for comparison.
   * Returns null if this pricing option is not available.
   */
  private get1YearAllUpfrontPrice(pricingData: PricingData): number | null {
    const savingsKey: SavingsKey = '1yr_All Upfront';
    const savingsOption = pricingData.savingsOptions?.[savingsKey];
    return savingsOption?.adjustedAmortisedDaily ?? null;
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