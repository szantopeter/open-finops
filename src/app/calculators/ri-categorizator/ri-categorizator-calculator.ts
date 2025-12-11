import { RiPortfolio, RiRow } from "src/app/components/ri-portfolio-upload/models/ri-portfolio.model";

export interface  RiKey {
  region : string;
  instanceClass : string;
  deployment : string;
  engineKey : string;
}

export class RiCategorizatorCalculator {
  // Prevent instantiation — this class only contains static helpers
  private constructor() {}

  /**
   * Reads a portfolio and categorizes each RI row into its appropriate category as per pricing files.
   *
   * @param riPortfolio The RI portfolio to categorize.
   * @returns The RiCategories and the number of RI rows matching the categories.
   */
  static categorizeRiPortfolio(riPortfolio: RiPortfolio): Map<string, number> {
    const categoryCounts = new Map<string, number>();
    for (const row of riPortfolio.rows) {
      const key = RiCategorizatorCalculator.getRiKey(row.riRow);
      const currentCount = categoryCounts.get(key) || 0;
      categoryCounts.set(key, currentCount + row.riRow.count);
    }
    return categoryCounts;
  }

  public static getRiKey(riRow: RiRow) {
    const region = riRow.region;
    const instance = riRow.instanceClass;
    const deployment = riRow.multiAz ? 'multi-az' : 'single-az';

    let engineKey = riRow.engine;
    if (riRow.edition && riRow.edition.toLowerCase() !== 'standard') {
      engineKey = `${engineKey}-${riRow.edition}`;
    }

    const riKey = `${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}`;
    return riKey;
  }  

}