/* eslint-disable @typescript-eslint/no-extraneous-class */
import { SavingsKey, UpfrontPayment } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
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

  static projectRiRenewal(riPortfolio: RiPortfolio, savingsKey: SavingsKey): RiPortfolio {
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

    const renewalTermMonths = termMonthsFromSavings(savingsKey);
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
      let prevEnd = new Date(originalRiRow.endDate.getTime());
      let idx = 1;

      // Create renewals until one ends after the target end of firstFullYear
      while (true) {
        const startMs = prevEnd.getTime() + 1; // start just after previous end
        const startDate = new Date(startMs);

        const endCandidate = addMonths(startDate, renewalTermMonths);
        // make endDate inclusive by subtracting one day
        const endDate = new Date(endCandidate.getTime());
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
          upfrontPayment: upfrontFromSavings(savingsKey),
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
