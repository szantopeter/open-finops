import { RiRenewalProjection } from './ri-renewal-projection';
import { SavingsKey } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('RiRenewalProjection', () => {
  const firstFullYear = 2029;

  // Helper to run the common test logic for a given savingsKey
  const runProjectionTest = (savingsKey: SavingsKey): void => {
    // Two RIs: one 3-year and one 1-year, same year but different month/day
    const ri1: RiRow = {
      id: 'r1',
      raw: { originId: 'r1' },
      startDate: new Date('2025-02-15'),
      endDate: new Date('2028-02-14'), // 3 years
      count: 1,
      instanceClass: 'db.r5.large',
      region: 'eu-west-1',
      multiAz: false,
      engine: 'postgres',
      edition: 'standard',
      upfrontPayment: 'All Upfront',
      durationMonths: 36,
      type: 'actual'
    };

    const ri2: RiRow = {
      id: 'r2',
      raw: { originId: 'r2' },
      startDate: new Date('2025-06-10'),
      endDate: new Date('2026-06-09'), // 1 year
      count: 2,
      instanceClass: 'db.r5.large',
      region: 'eu-west-1',
      multiAz: false,
      engine: 'postgres',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 12,
      type: 'actual'
    };

    const inputPortfolio: RiPortfolio = {
      metadata: {
        source: 'test',
        importedAt: new Date().toISOString(),
        firstFullYear
      },
      rows: [
        { riRow: ri1, pricingData: ({} as any) },
        { riRow: ri2, pricingData: ({} as any) }
      ]
    };

    // Act
    const projected = RiRenewalProjection.projectRiRenewal(inputPortfolio, savingsKey);

    expect(projected).toBeDefined();

    const targetEndOfYear = new Date(firstFullYear, 11, 31);

    // Helper to match instance identity
    const matchesInstance = (a: RiRow, b: RiRow): boolean =>
      a.instanceClass === b.instanceClass && a.region === b.region && a.multiAz === b.multiAz && a.engine === b.engine && a.edition === b.edition;

    for (const inputEntries of inputPortfolio.rows) {
      const inputRiRow = inputEntries.riRow;

      // Locate the original row in the projected result (type 'actual') and assert
      const projectedOriginalEntry = projected.rows.find((p: { riRow: RiRow }) => p.riRow.id === inputRiRow.id && p.riRow.type === 'actual');
      expect(projectedOriginalEntry).toBeDefined();
      const resultActualRiRow: RiRow = projectedOriginalEntry!.riRow;
      // Ensure the projected original preserves the same instance identity
      expect(matchesInstance(resultActualRiRow, inputRiRow)).toBeTrue();

      // Collect all entries in projected that cover the same instances (original + renewals)
      const chain = projected.rows
        .map((x: { riRow: RiRow; pricingData: any }) => x.riRow)
        .filter((r: RiRow) => matchesInstance(r, inputRiRow) && r.count === inputRiRow.count)
        .sort((a: RiRow, b: RiRow) => a.startDate.getTime() - b.startDate.getTime());

      // There must be at least the original in the chain
      expect(chain.length).toBeGreaterThanOrEqual(1);

      // Verify no gaps between consecutive reservations (next.startDate - prev.endDate <= 1 day and >= 0)
      for (let i = 1; i < chain.length; i++) {
        const prev = chain[i - 1];
        const next = chain[i];
        const diffMs = next.startDate.getTime() - prev.endDate.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        expect(diffMs).toBeGreaterThanOrEqual(0);
        expect(diffMs).toBeLessThanOrEqual(oneDayMs);
      }

      // At least one entry in the chain should use the upfront implied by the savingsKey
      const expectedUpfront = savingsKey.includes('Partial') ? 'Partial' : savingsKey.includes('No Upfront') ? 'No Upfront' : 'All Upfront';
      const hasExpectedUpfront = chain.some((r: RiRow) => r.upfrontPayment === expectedUpfront);
      expect(hasExpectedUpfront).toBeTrue();

      // Renewals should follow the id convention: originalId-renew-1, originalId-renew-2, ...
      const renewalPrefix = `${inputRiRow.id}-renew-`;
      const renewals = projected.rows
        .map((x: { riRow: RiRow; pricingData: any }) => x.riRow)
        .filter((r: RiRow) => r.id.startsWith(renewalPrefix))
        .sort((a: RiRow, b: RiRow) => a.startDate.getTime() - b.startDate.getTime());

      // There should be at least one renewal in the chain (per requirements)
      expect(renewals.length).toBeGreaterThanOrEqual(1);

      // Check renewal id numbering is sequential starting at 1
      const renewalSequence = renewals.map((r: RiRow) => {
        const m = r.id.match(/-renew-(\d+)$/);
        return m ? parseInt(m[1], 10) : NaN;
      });
      // All must parse
      expect(renewalSequence.every((n: number) => !isNaN(n))).toBeTrue();
      // Sorted numeric order
      const sortedNums = [...renewalSequence].sort((a, b) => a - b);
      expect(sortedNums[0]).toBe(1);
      for (let i = 0; i < sortedNums.length; i++) {
        expect(sortedNums[i]).toBe(i + 1);
      }

      // Ensure renewals in the same chain don't have gaps between them
      for (let i = 1; i < renewals.length; i++) {
        const prev = renewals[i - 1];
        const next = renewals[i];
        const diffMs = next.startDate.getTime() - prev.endDate.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        expect(diffMs).toBeGreaterThanOrEqual(0);
        expect(diffMs).toBeLessThanOrEqual(oneDayMs);
      }

      // Renewals should continue until one of them ends after the end of the firstFullYear
      const endsAfterYear = chain.some((r: RiRow) => r.endDate.getTime() > targetEndOfYear.getTime());
      expect(endsAfterYear).toBeTrue();
    }
  };

  it('handles 1yr_No Upfront', () => runProjectionTest('1yr_No Upfront'));
  it('handles 1yr_Partial Upfront', () => runProjectionTest('1yr_Partial Upfront'));
  it('handles 1yr_All Upfront', () => runProjectionTest('1yr_All Upfront'));
  it('handles 3yr_Partial Upfront', () => runProjectionTest('3yr_Partial Upfront'));
  it('handles 3yr_All Upfront', () => runProjectionTest('3yr_All Upfront'));
});
