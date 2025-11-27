/* eslint-disable @typescript-eslint/no-extraneous-class */
import type { SavingsKey, UpfrontPayment } from '../components/ri-portfolio-upload/models/pricing.model';
import type { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow where day might be adjusted (leave as is)
  if (d.getDate() !== day) {
    d.setDate(0); // go to last day of previous month
  }
  return d;
}

export class RiRenewalProjection {
  private constructor() {}

  /**
   * Projects renewals for all RIs in the given portfolio until at least the end of the first full year.
   * @param riPortfolio 
   * @param savingsKey If savingsKey is provided, it determines the renewal term and upfront payment. If not provided then it will renew every RI with it's own original term and upfront.
   * @returns 
   */
  static projectRiRenewal(riPortfolio: RiPortfolio, savingsKey?: SavingsKey): RiPortfolio {
    const result: RiPortfolio = {
      metadata: { ...riPortfolio.metadata },
      rows: []
    };

    const firstFullYear = riPortfolio.metadata.firstFullYear;
    const targetEndOfYear = new Date(firstFullYear, 11, 31);

    const termMonthsFromSavings = (key: SavingsKey): number => {
      if (key.startsWith('3yr')) return 36;
      if (key.startsWith('1yr')) return 12;
      return 12;
    };

    const upfrontFromSavings = (key: SavingsKey): UpfrontPayment => {
      if (key.includes('No Upfront')) return 'No Upfront';
      if (key.includes('Partial')) return 'Partial';
      return 'All Upfront';
    };

    for (const originalPortfolioEntry of riPortfolio.rows) {
      const originalRiRow = originalPortfolioEntry.riRow;

      // Preserve original entry
      result.rows.push({ riRow: { ...originalRiRow }, pricingData: originalPortfolioEntry.pricingData });

      // Always create at least one renewal and continue until one ends after firstFullYear
      let prevEnd = new Date(originalRiRow.endDate);
      let idx = 1;

      // Create renewals until one ends after the target end of firstFullYear
      while (true) {
        const startMs = prevEnd.getTime() + 1; // start just after previous end
        const startDate = new Date(startMs);

          // determine renewal term and upfront for this original row: if savingsKey is provided use it,
          // otherwise preserve the original riRow's duration and upfrontPayment
          const renewalTermMonths = savingsKey ? termMonthsFromSavings(savingsKey) : originalRiRow.durationMonths;
          const renewalUpfront = savingsKey ? upfrontFromSavings(savingsKey) : originalRiRow.upfrontPayment;

          const endCandidate = addMonths(startDate, renewalTermMonths);
        // make endDate inclusive by subtracting one day
        const endDate = new Date(endCandidate);
        endDate.setDate(endDate.getDate() - 1);

        const renewal: RiRow = {
          id: `${originalRiRow.id}-renew-${idx}`,
          raw: { originId: originalRiRow.id },
          startDate,
          endDate,
          count: originalRiRow.count,
          instanceClass: originalRiRow.instanceClass,
          region: originalRiRow.region,
          multiAz: originalRiRow.multiAz,
          engine: originalRiRow.engine,
          edition: originalRiRow.edition,
          upfrontPayment: renewalUpfront,
          durationMonths: renewalTermMonths,
          type: 'projected'
        };

        result.rows.push({ riRow: renewal, pricingData: originalPortfolioEntry.pricingData });

        // stop if this renewal ends after target end of first full year
        if (endDate.getTime() > targetEndOfYear.getTime()) {
          break;
        }

        // otherwise continue chaining
        prevEnd = endDate;
        idx += 1;
      }
    }

    return result;
  }

}
