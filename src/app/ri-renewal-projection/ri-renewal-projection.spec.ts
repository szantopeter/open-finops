import { RiRenewalProjection } from './ri-renewal-projection';
import type { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('RiRenewalProjection', () => {
  it('preserves original term and upfront when savingsKey is not provided', () => {
    // We'll set a concrete projection end date and assert the projection includes that date (inclusive)
    const projectionEnd = new Date(Date.UTC(2027, 11, 31)); // 2027-12-31 UTC

    // Create a portfolio with RI rows covering 1yr and 3yr saving types / upfront options
      const riRows: RiPortfolio = {
        metadata: { source: 'test', importedAt: new Date().toISOString(), projectionStartDate: new Date(2024,0,1) as any, projectionEndDate: projectionEnd},
      rows: [
        // 1yr No Upfront
        {
          riRow: {
            id: 'r1', raw: {}, startDate: new Date(2024, 0, 1), endDate: new Date(2024, 11, 31), count: 1,
            instanceClass: 'db.t3.micro', region: 'us-east-1', multiAz: false, engine: 'mysql', edition: 'standard',
            upfrontPayment: 'No Upfront', durationMonths: 12, type: 'actual'
          } as RiRow,
          pricingData: {} as any
        },
        // 1yr Partial
        {
          riRow: {
            id: 'r2', raw: {}, startDate: new Date(2024, 3, 1), endDate: new Date(2025, 2, 28), count: 1,
            instanceClass: 'db.t3.micro', region: 'us-east-1', multiAz: false, engine: 'mysql', edition: 'standard',
            upfrontPayment: 'Partial', durationMonths: 12, type: 'actual'
          } as RiRow,
          pricingData: {} as any
        },
        // 1yr All Upfront
        {
          riRow: {
            id: 'r3', raw: {}, startDate: new Date(2024, 6, 1), endDate: new Date(2025, 5, 31), count: 1,
            instanceClass: 'db.t3.micro', region: 'us-east-1', multiAz: false, engine: 'mysql', edition: 'standard',
            upfrontPayment: 'All Upfront', durationMonths: 12, type: 'actual'
          } as RiRow,
          pricingData: {} as any
        },
        // 3yr Partial
        {
          riRow: {
            id: 'r4', raw: {}, startDate: new Date(2024, 0, 1), endDate: new Date(2026, 11, 31), count: 1,
            instanceClass: 'db.t3.micro', region: 'us-east-1', multiAz: false, engine: 'mysql', edition: 'standard',
            upfrontPayment: 'Partial', durationMonths: 36, type: 'actual'
          } as RiRow,
          pricingData: {} as any
        },
        // 3yr All Upfront
        {
          riRow: {
            id: 'r5', raw: {}, startDate: new Date(2024, 2, 1), endDate: new Date(2027, 1, 28), count: 1,
            instanceClass: 'db.t3.micro', region: 'us-east-1', multiAz: false, engine: 'mysql', edition: 'standard',
            upfrontPayment: 'All Upfront', durationMonths: 36, type: 'actual'
          } as RiRow,
          pricingData: {} as any
        }
      ]
    };

    // Act: call without savingsKey
    const projected = RiRenewalProjection.projectRiRenewal(riRows as any);

    // Assert: for each original row, ensure each renewal uses the same upfrontPayment and durationMonths
    const grouped = new Map<string, any[]>();
    for (const entry of projected.rows) {
      const origin = (entry.riRow.raw && (entry.riRow.raw as any).originId) || entry.riRow.id;
      if (!grouped.has(origin)) grouped.set(origin, []);
      grouped.get(origin)!.push(entry.riRow);
    }

    // original rows should have groups for all five
    expect(grouped.has('r1')).toBeTrue();
    expect(grouped.has('r2')).toBeTrue();
    expect(grouped.has('r3')).toBeTrue();
    expect(grouped.has('r4')).toBeTrue();
    expect(grouped.has('r5')).toBeTrue();

    const checkSame = (originId: string, expectedUpfront: string | undefined, expectedDuration: number) => {
      const rows = grouped.get(originId)!;
      for (const r of rows) {
        expect(r.upfrontPayment).toBe(expectedUpfront);
        expect(r.durationMonths).toBe(expectedDuration);
      }
    };

    checkSame('r1', 'No Upfront', 12);
    checkSame('r2', 'Partial', 12);
    checkSame('r3', 'All Upfront', 12);
    checkSame('r4', 'Partial', 36);
    checkSame('r5', 'All Upfront', 36);

    // The projection should include renewals up to and including the projectionEndDate.
    const projectionIso = projectionEnd.toISOString().slice(0, 10);
    // DEBUG: list all projected end dates (ISO)
    // eslint-disable-next-line no-console
    console.debug('projected end dates:', projected.rows.map(e => e.riRow.endDate.toISOString()));
    const hasProjectionDate = projected.rows.some(entry => {
      const d = entry.riRow.endDate.toISOString().slice(0, 10);
      return d === projectionIso;
    });

    // Expect at least one projected row ends exactly on the projection end date (inclusive)
    expect(hasProjectionDate).toBeTrue();

  });
});

