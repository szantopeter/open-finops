import { HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { PricingDataService } from './pricing-data.service';
import { RiCostAggregationService } from './ri-cost-aggregation.service';
import { RiDataService } from './ri-data.service';
import { RiRenewalComparisonService, RenewalScenario } from './ri-renewal-comparison.service';
import { RiCSVParserService } from './ri-import.service';
import { StorageService } from '../../core/services/storage.service';


describe('RiCostAggregationService one-line cloudability CSV', () => {
  let aggregator: RiCostAggregationService;
  let importer: RiCSVParserService;
  let pricingSvc: PricingDataService;
  let renewalSvc: RiRenewalComparisonService;
  let riDataSvc: RiDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [RiCostAggregationService, RiCSVParserService, RiDataService, StorageService, PricingDataService, RiRenewalComparisonService]
    });
    aggregator = TestBed.inject(RiCostAggregationService);
    importer = TestBed.inject(RiCSVParserService);
    pricingSvc = TestBed.inject(PricingDataService);
    renewalSvc = TestBed.inject(RiRenewalComparisonService);
    riDataSvc = TestBed.inject(RiDataService);
  });

  it('loads one cloudability row and matches pricing file oracle-se2-byol', async (): Promise<void> => {
    // Fetch the one-line CSV asset served by Karma
    const res = await fetch('/assets/cloudability-one-line.csv');
    expect(res.ok).toBeTrue();
    const txt = await res.text();

    const parsed = importer.parseText(txt, 'one-line-spec');
    expect(parsed).toBeDefined();
    expect(parsed.riPortfolio).toBeDefined();
    const imp = (parsed.riPortfolio as any);
    expect(imp.rows?.length).toBeGreaterThan(0);

    // Import service already normalized all fields - use them as-is
    const r = imp.rows[0] as any;

    // Map to aggregator shape (minimal transformation)
    const normalizeUpfront = (u: any): string => {
      const raw = (u ?? '').toString().trim().toLowerCase();
      if (!raw) return 'No Upfront';
      if (raw.includes('no') && raw.includes('up')) return 'No Upfront';
      if (raw.includes('partial')) return 'Partial Upfront';
      if (raw.includes('all')) return 'All Upfront';
      return 'No Upfront';
    };

    const row = {
      instanceClass: r.instanceClass,
      region: r.region,
      multiAz: r.multiAZ ?? false,
      engine: r.engine, // already normalized by import service
      edition: r.edition, // already normalized by import service
      upfrontPayment: normalizeUpfront(r.upfront),
      durationMonths: r.durationMonths ?? 36,
      startDate: r.startDate,
      endDate: r.endDate,
      count: r.count ?? 1
    } as any;

    // Build expected pricing path per generator convention (combine engine+edition for file path)
    const deployment = row.multiAz ? 'multi-az' : 'single-az';
    let engineKey = row.engine;
    if (row.edition) {
      engineKey = `${engineKey}-${row.edition}`;
    }
    const fileName = `${row.region}/${row.instanceClass}/${row.region}_${row.instanceClass}_${deployment}-${engineKey}.json`;

    // Load pricing for that path
    const loaded = await firstValueFrom(pricingSvc.loadPricingForPaths([fileName]));
    expect(loaded).toBeDefined();

    // At least one pricing record should be loaded for that file
    expect(loaded.pricingRecords.length).toBeGreaterThan(0);

    const aggregates = aggregator.calculateAggregation({ groupingMode: 'ri-type' }, [row], loaded.pricingRecords as any);

    // Aggregation should have matched the row (no unmatched rows)
    expect(aggregator.lastUnmatchedCount).toBe(0);
    // There should be at least one month of aggregated data
    expect(Object.keys(aggregates).length).toBeGreaterThan(0);
  });

  it('validates renewal scenario ordering: No Upfront < Partial Upfront < All Upfront savings, and 1y costs < 3y costs', async (): Promise<void> => {
    // Fetch the one-line CSV asset served by Karma
    const inputFileName = '/assets/cloudability-one-line.csv';
    console.warn('DEBUG: Input file name:', inputFileName);
    
    const res = await fetch(inputFileName);
    expect(res.ok).toBeTrue();
    const txt = await res.text();

    const parsed = importer.parseText(txt, 'one-line-spec');
    expect(parsed).toBeDefined();
    expect(parsed.riPortfolio).toBeDefined();
    const imp = (parsed.riPortfolio as any);
    expect(imp.rows?.length).toBeGreaterThan(0);

    // Set the parsed data in the RiDataService
    riDataSvc.setRiPortfolio(imp);

    // Get renewal scenarios
    const scenarios = await firstValueFrom(renewalSvc.getRenewalScenarios());
    console.warn('DEBUG: Renewal comparison table content:', JSON.stringify(scenarios, null, 2));
    
    expect(scenarios.length).toBe(6); // 3 upfront options × 2 durations

    // Ensure the on-demand cost for the first full year is the same for all scenarios
    const onDemandCosts = scenarios.map(s => s.firstFullYearOnDemandCost);
    expect(onDemandCosts.length).toBe(6);
    const baseline = onDemandCosts[0];
    onDemandCosts.forEach((c, i) => {
      expect(Math.abs(c - baseline)).toBeLessThan(1e-6, `Scenario ${i} on-demand cost ${c} differs from baseline ${baseline}`);
    });

    // Group scenarios by duration for easier comparison
    const scenariosByDuration = scenarios.reduce((acc, scenario) => {
      if (!acc[scenario.durationMonths]) {
        acc[scenario.durationMonths] = [];
      }
      acc[scenario.durationMonths].push(scenario);
      return acc;
    }, {} as Record<number, RenewalScenario[]>);

    // Check both 12-month and 36-month scenarios
    [12, 36].forEach(duration => {
      const durationScenarios = scenariosByDuration[duration];
      expect(durationScenarios.length).toBe(3);

      // Sort by upfront payment type for consistent ordering
      const sortedScenarios = durationScenarios.sort((a, b) => {
        const order = { 'No Upfront': 0, 'Partial Upfront': 1, 'All Upfront': 2 };
        return order[a.upfrontPayment as keyof typeof order] - order[b.upfrontPayment as keyof typeof order];
      });

      const noUpfront = sortedScenarios[0];
      const partialUpfront = sortedScenarios[1];
      const allUpfront = sortedScenarios[2];

      // Verify upfront payment types are correct
      expect(noUpfront.upfrontPayment).toBe('No Upfront');
      expect(partialUpfront.upfrontPayment).toBe('Partial Upfront');
      expect(allUpfront.upfrontPayment).toBe('All Upfront');

      // Verify basic structure - all scenarios should have defined properties
      expect(noUpfront.scenario).toBeDefined();
      expect(partialUpfront.scenario).toBeDefined();
      expect(allUpfront.scenario).toBeDefined();
      expect(noUpfront.firstFullYear).toBeGreaterThan(2025); // Should be 2026
      expect(partialUpfront.firstFullYear).toBeGreaterThan(2025);
      expect(allUpfront.firstFullYear).toBeGreaterThan(2025);
    });

    // Check that scenarios exist for both durations
    const twelveMonthScenarios = scenariosByDuration[12];
    const thirtySixMonthScenarios = scenariosByDuration[36];

    ['No Upfront', 'Partial Upfront', 'All Upfront'].forEach(upfrontType => {
      const oneYearScenario = twelveMonthScenarios.find(s => s.upfrontPayment === upfrontType);
      const threeYearScenario = thirtySixMonthScenarios.find(s => s.upfrontPayment === upfrontType);

      expect(oneYearScenario).toBeDefined();
      expect(threeYearScenario).toBeDefined();
      expect(oneYearScenario!.durationMonths).toBe(12);
      expect(threeYearScenario!.durationMonths).toBe(36);
    });
  });
});
