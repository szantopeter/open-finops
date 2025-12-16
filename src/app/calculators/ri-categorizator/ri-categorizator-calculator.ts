import { PricingKey } from "src/app/components/ri-portfolio-upload/models/pricing.model";
import { RiPortfolio, RiRow } from "src/app/components/ri-portfolio-upload/models/ri-portfolio.model";

export class RiCategorizatorCalculator {
  // Prevent instantiation — this class only contains static helpers
  private constructor() {}

  /**
   * Reads a portfolio and categorizes each RI row into its appropriate category as per pricing files.
   *
   * @param riPortfolio The RI portfolio to categorize.
   * @returns The RiCategories and the number of RI rows matching the categories.
   */
  static categorizeRiPortfolio(riPortfolio: RiPortfolio): Map<PricingKey, number> {
    const categoryCountsByString = new Map<string, { key: PricingKey; count: number }>();
    
    for (const row of riPortfolio.rows) {
      const riPricingKey = RiCategorizatorCalculator.getPricingKey(row.riRow);
      const keyString = riPricingKey.toString();
      const existing = categoryCountsByString.get(keyString);
      
      if (existing) {
        existing.count += row.riRow.count;
      } else {
        categoryCountsByString.set(keyString, { key: riPricingKey, count: row.riRow.count });
      }
    }
    
    const categoryCounts = new Map<PricingKey, number>();
    for (const { key, count } of categoryCountsByString.values()) {
      categoryCounts.set(key, count);
    }
    
    return categoryCounts;
  }

  public static getPricingKey(riRow: RiRow): PricingKey {
    const region = riRow.region;
    const instanceClass = riRow.instanceClass;
    const deployment = riRow.multiAz ? 'multi-az' : 'single-az';

    let engineKey = riRow.engine;
    if (riRow.edition && riRow.edition.toLowerCase() !== 'standard') {
      engineKey = `${engineKey}-${riRow.edition}`;
    }

    return new PricingKey(region, instanceClass, deployment, engineKey);
  }

}