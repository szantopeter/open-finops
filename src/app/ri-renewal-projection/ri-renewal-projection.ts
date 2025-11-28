/* eslint-disable @typescript-eslint/no-extraneous-class */
import type { SavingsKey, UpfrontPayment } from '../components/ri-portfolio-upload/models/pricing.model';
import type { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

function addMonthsUTC(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  let newMonth = month + months;
  const newYear = year + Math.floor(newMonth / 12);
  newMonth = ((newMonth % 12) + 12) % 12;

  // Try to create the same day in target month using UTC
  const candidate = new Date(Date.UTC(newYear, newMonth, day));
  if (candidate.getUTCDate() !== day) {
    // day overflowed (e.g., Feb 30). Return last day of the previous month in UTC
    return new Date(Date.UTC(newYear, newMonth + 1, 0));
  }
  return candidate;
}

export class RiRenewalProjection {
  private constructor() {}

  /**
   * Projects renewals for all RIs in the given portfolio until the projection end date.
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
    const defaultProjectionEnd = new Date(firstFullYear, 11, 31);
    const projectionEnd = (riPortfolio.metadata as any).projectionEndDate || defaultProjectionEnd;

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

      // Always create at least one renewal and continue until we reach projectionEnd
      // Normalize previous end to UTC midnight to avoid timezone/MS accumulation
      let prevEnd = new Date(originalRiRow.endDate);
      // Treat the original RiRow dates as calendar dates (year/month/day) to avoid timezone shifts
      prevEnd = new Date(Date.UTC(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate()));
      let idx = 1;

      // Create renewals until one ends after the target end of firstFullYear
      while (true) {
        // start the next renewal on the day after prevEnd (UTC midnight)
        let startDate = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), prevEnd.getUTCDate() + 1));

        // if the next renewal would start after the projection window, stop
        if (startDate.getTime() > projectionEnd.getTime()) break;

          // determine renewal term and upfront for this original row: if savingsKey is provided use it,
          // otherwise preserve the original riRow's duration and upfrontPayment
          let renewalTermMonths: number;
          let renewalUpfront: UpfrontPayment;
          if (savingsKey) {
            renewalTermMonths = termMonthsFromSavings(savingsKey);
            renewalUpfront = upfrontFromSavings(savingsKey);
          } else {
            renewalTermMonths = originalRiRow.durationMonths;
            renewalUpfront = originalRiRow.upfrontPayment;
          }

          const endCandidate = addMonthsUTC(startDate, renewalTermMonths);
        // make endDate inclusive by subtracting one day (UTC)
        let endDate = new Date(Date.UTC(endCandidate.getUTCFullYear(), endCandidate.getUTCMonth(), endCandidate.getUTCDate() - 1));

        // Normalize start/end to UTC midnight to avoid timezone shifts affecting date-only comparisons
        startDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        endDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

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

        // continue chaining; projectionEnd limits whether the next renewal's startDate is created
        prevEnd = endDate;
        idx += 1;
      }
    }

    return result;
  }

}
