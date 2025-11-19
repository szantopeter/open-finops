import { HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
// of is not used in this spec

import { FirstFullYearService } from './first-full-year.service';
import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiCSVParserService } from './ri-import.service';
import { RiMonthlySpendingService } from './ri-monthly-spending.service';
import { RiRenewalComparisonService } from './ri-renewal-comparison.service';
import { StorageService } from '../../core/services/storage.service';
// PricingRecord not used in this spec

describe('RiMonthlySpendingService', () => {
  let service: RiMonthlySpendingService;
  let parser: RiCSVParserService;
  let pricingSvc: PricingDataService;
  let aggregationSvc: RiCostAggregationService;
  let riDataSvc: RiDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [
        RiMonthlySpendingService,
        RiCSVParserService,
        FirstFullYearService,
        RiCostAggregationService,
        PricingDataService,
        RiRenewalComparisonService,
        RiDataService,
        StorageService
      ]
    });

    service = TestBed.inject(RiMonthlySpendingService);
    parser = TestBed.inject(RiCSVParserService);
    pricingSvc = TestBed.inject(PricingDataService);
    aggregationSvc = TestBed.inject(RiCostAggregationService);
    TestBed.inject(RiRenewalComparisonService);
    riDataSvc = TestBed.inject(RiDataService);
  });

  it('places full upfront exactly once (expiry month) for All Upfront scenarios and monthly payments are zero', async () => {
    // Load the one-line CSV
    const res = await fetch('/assets/cloudability-one-line.csv');
    expect(res.ok).toBeTrue();
    const csvContent = await res.text();

    const parsed = parser.parseText(csvContent);
    expect(parsed.errors).toBeUndefined();
    expect(parsed.riPortfolio).toBeDefined();
    const portfolio = parsed.riPortfolio as any;
    expect(portfolio.rows.length).toBeGreaterThan(0);

    // For real services we need to set the portfolio on RiDataService so renewal scenarios can be computed
    riDataSvc.setRiPortfolio(portfolio);

    // Build the pricing path like other tests and load the real pricing record(s)
    const r = portfolio.rows[0];
    const deployment = r.multiAZ || r.multiAz ? 'multi-az' : 'single-az';
    let engineKey = r.engine;
    if (r.edition) engineKey = `${engineKey}-${r.edition}`;
    const fileName = `${r.region}/${r.instanceClass}/${r.region}_${r.instanceClass}_${deployment}-${engineKey}.json`;

    const { firstValueFrom } = await import('rxjs');
    const pricingResult = await firstValueFrom(pricingSvc.loadPricingForPaths([fileName]));
    const pricingRecords = (pricingResult).pricingRecords || [];
    // Find the All Upfront record
    const allUpfrontRecord = pricingRecords.find((p: any) => p.upfrontPayment === 'All Upfront') || pricingRecords[0];
    const upfrontAmount = allUpfrontRecord?.upfrontCost ?? 0;
    expect(upfrontAmount).toBeGreaterThanOrEqual(0);

    // Determine expiry month key from CSV row (end date)
    const row = portfolio.rows[0];
    const endDate = row.endDate || row.End || row.EndDate || row.end;
    const end = new Date(endDate + 'T00:00:00Z');
    const expiryMonthKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}`;

    // Use the real aggregation service; no mocking here
    // (RiMonthlySpendingService will call calculateAggregation on the real service)

    // Call the service
    const result = await service.getMonthlyTablesForRiPortfolio(portfolio);

    expect(result).toBeDefined();
    const { scenarios: gotScenarios, aggregatesByScenario } = result;
    expect(gotScenarios.length).toBe(6);

    // Diagnostics: ensure pricing files loaded and aggregation reported no errors
    expect(pricingRecords.length).toBeGreaterThan(0);
    // aggregationSvc is the same injectable used by the service; check for errors
    expect(aggregationSvc.lastErrors.unmatchedPricing.length).toBe(0);
    expect(aggregationSvc.lastErrors.missingRates.length).toBe(0);
    expect(aggregationSvc.lastErrors.renewalErrors.length).toBe(0);

    // Find All Upfront scenarios and validate rules
    const allUpfront = gotScenarios.filter((s: any) => s.upfrontPayment === 'All Upfront');
    expect(allUpfront.length).toBe(2);

    for (const s of allUpfront) {
      const agg = aggregatesByScenario[s.scenario];
      expect(agg).toBeDefined();

      // Identify months where the renewal upfront is recorded
      const months = Object.keys(agg);
      const upfrontMonths = months.filter(mk => (agg[mk]?.['Savings Upfront']?.renewalCost || 0) > 0);
      expect(upfrontMonths.length).toBe(1);
      expect(upfrontMonths[0]).toBe(expiryMonthKey);
      // Sum upfront values from details flagged as renewals in Savings Upfront group
      const su = agg[expiryMonthKey]?.['Savings Upfront'];
      const renewalUpfrontDetails = (su?.details || []).filter((d: any) => d.isRenewal);
      const sumRenewalUpfront = renewalUpfrontDetails.reduce((acc: number, d: any) => acc + (d.upfront || 0), 0);
      // pick the pricing record that matches the scenario duration (12 or 36 months)
      const matchingPricing = pricingRecords.find((p: any) => p.upfrontPayment === 'All Upfront' && p.durationMonths === s.durationMonths) || allUpfrontRecord;
      const expectedUpfrontForScenario = matchingPricing?.upfrontCost ?? 0;
      expect(sumRenewalUpfront).withContext(`Sum of renewal upfront details (${sumRenewalUpfront}) should match pricing upfront (${expectedUpfrontForScenario})`).toBeCloseTo(expectedUpfrontForScenario, 2);

      // For All Upfront scenarios, renewal recurring costs (in Savings Monthly details marked isRenewal)
      // must be zero. We examine details flagged as renewals to verify this.
      for (const mk of months) {
        const sm = agg[mk]?.['Savings Monthly'];
        if (!sm || !Array.isArray(sm.details)) continue;
        const renewalDetails = sm.details.filter((d: any) => d.isRenewal);
        const totalRenewalRecurring = renewalDetails.reduce((acc: number, d: any) => acc + (d.recurringCost || 0), 0);
        expect(totalRenewalRecurring).toBe(0);
      }
    }
  });
});
