
import type { CostTimeseriesByScenario } from './cost-comparison-calculator';
import { CostComparisonCalculator } from './cost-comparison-calculator';
import type CostTimeseries from '../cost-timeseries/costTimeseries.model';

describe('CostComparisonCalculator', () => {
  describe('calculateCostComparison', () => {
    it('should calculate cost comparison for on-demand, 1yr no upfront, and 3yr full upfront scenarios', () => {
      const firstFullYear = 2025;

      // Define pricing for each scenario
      const scenarios = [
        { name: 'onDemand', upfront: 0, monthly: 100 },
        { name: 'noUpfront_1y', upfront: 0, monthly: 90 },
        { name: 'partialUpfront_1y', upfront: 50, monthly: 85 },
        { name: 'fullUpfront_1y', upfront: 100, monthly: 0 },
        { name: 'partialUpfront_3y', upfront: 150, monthly: 75 },
        { name: 'fullUpfront_3y', upfront: 200, monthly: 0 }
      ];

      // Create mock CostTimeseries for each scenario
      const createMockCostTimeseries: (scenario: string, upfrontCost: number, monthlyCost: number) => CostTimeseries = (scenario: string, upfrontCost: number, monthlyCost: number): CostTimeseries => ({
        riRow: {
          id: 'mock-id',
          raw: {},
          startDate: new Date(firstFullYear , 0, 1),
          endDate: new Date(firstFullYear , 11, 31),
          count: 1,
          instanceClass: 'db.t3.micro',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          edition: 'standard',
          upfrontPayment: 'No Upfront',
          durationMonths: 12,
          type: 'actual'
        },
        pricingData: {} as any,
        monthlyCost: Array.from({ length: 12 }, (_, i) => ({
          year: firstFullYear,
          month: i + 1,
          cost: {
              [scenario]: {
                upfrontCost: i === 0 ? upfrontCost : 0, // upfront only in first month
                monthlyCost,
                adjustedAmortisedCost: i === 0 ? monthlyCost + upfrontCost : monthlyCost,
                totalMonthlyCost: (i === 0 ? upfrontCost : 0) + monthlyCost
              }
            }
        }))
      });

      const onDemandCostTimeseries = [createMockCostTimeseries(scenarios[0].name, scenarios[0].upfront, scenarios[0].monthly)];
      const noUpfront1yCostTimeseries = [createMockCostTimeseries(scenarios[1].name, scenarios[1].upfront, scenarios[1].monthly)];
      const partialUpfront1yCostTimeseries = [createMockCostTimeseries(scenarios[2].name, scenarios[2].upfront, scenarios[2].monthly)];
      const fullUpfront1yCostTimeseries = [createMockCostTimeseries(scenarios[3].name, scenarios[3].upfront, scenarios[3].monthly)];
      const partialUpfront3yCostTimeseries = [createMockCostTimeseries(scenarios[4].name, scenarios[4].upfront, scenarios[4].monthly)];
      const fullUpfront3yCostTimeseries = [createMockCostTimeseries(scenarios[5].name, scenarios[5].upfront, scenarios[5].monthly)];

      const costTimeseriesByScenario: CostTimeseriesByScenario = {
        onDemand: onDemandCostTimeseries[0],
        current: onDemandCostTimeseries[0],
        noUpfront_1y: noUpfront1yCostTimeseries[0],
        partialUpfront_1y: partialUpfront1yCostTimeseries[0],
        fullUpfront_1y: fullUpfront1yCostTimeseries[0],
        partialUpfront_3y: partialUpfront3yCostTimeseries[0],
        fullUpfront_3y: fullUpfront3yCostTimeseries[0]
      };

      // Act
      const result = CostComparisonCalculator.calculateAnnualisedCostComparison(costTimeseriesByScenario);

      // Assert
      expect(result).toBeDefined();

      // Expected calculations: sum all months across the full timeseries and annualise (avg monthly * 12)
      const computeAnnualisedForKey = (ts: CostTimeseries, key: string) => {
        const months = ts.monthlyCost.length;
        const sumUpfront = ts.monthlyCost.reduce((s, m) => s + (((m.cost as any)[key] && (m.cost as any)[key].upfrontCost) || 0), 0);
        const sumMonthly = ts.monthlyCost.reduce((s, m) => s + (((m.cost as any)[key] && (m.cost as any)[key].monthlyCost) || 0), 0);
        const sumAdjusted = ts.monthlyCost.reduce((s, m) => s + (((m.cost as any)[key] && (m.cost as any)[key].adjustedAmortisedCost) || 0), 0);
        const factor = 12 / Math.max(1, months);
        return {
          annualUpfront: sumUpfront * factor,
          annualMonthly: sumMonthly * factor,
          annualAdjusted: sumAdjusted * factor
        };
      };

      const onDemandAnnual = computeAnnualisedForKey(onDemandCostTimeseries[0], 'onDemand');
      const onDemandMaxMonthly = scenarios[0].monthly;

      expect(result.onDemand).withContext('On Demand scenario').toEqual({
        scenario: 'onDemand',
        totalCost: onDemandAnnual.annualAdjusted,
        totalAdjustedAmortised: onDemandAnnual.annualAdjusted,
        totalUpfront: onDemandAnnual.annualUpfront,
        totalMonthlyPayment: onDemandAnnual.annualMonthly,
        highestMonthlySpend: onDemandMaxMonthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsValue: undefined,
        savingsValueOnDemand: 0,
        savingsPercentOnDemand: 0,
        monthlyBreakdown: [onDemandCostTimeseries[0]]
      });

      // Verify total cost formula (annualised monthly + annualised upfront == totalCost)
      expect(result.onDemand.totalCost).toBeCloseTo(result.onDemand.totalMonthlyPayment + result.onDemand.totalUpfront, 6);

      // No Upfront 1y
      const onDemandTotalAdjusted = onDemandAnnual.annualAdjusted;

      const noUpfrontAnnual = computeAnnualisedForKey(noUpfront1yCostTimeseries[0], 'noUpfront_1y');
      const noUpfrontSavingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - noUpfrontAnnual.annualAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const noUpfrontSavingsValue = onDemandTotalAdjusted - noUpfrontAnnual.annualAdjusted;

      expect(result.noUpfront_1y).withContext('No Upfront 1y scenario').toEqual({
        scenario: 'noUpfront_1y',
        totalCost: noUpfrontAnnual.annualAdjusted,
        totalAdjustedAmortised: noUpfrontAnnual.annualAdjusted,
        totalUpfront: noUpfrontAnnual.annualUpfront,
        totalMonthlyPayment: noUpfrontAnnual.annualMonthly,
        highestMonthlySpend: scenarios[1].monthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsPercent: noUpfrontSavingsPercent,
        savingsValue: noUpfrontSavingsValue,
        savingsValueOnDemand: noUpfrontSavingsValue,
        savingsPercentOnDemand: noUpfrontSavingsPercent,
        savingsPercentCurrent: noUpfrontSavingsPercent,
        savingsValueCurrent: noUpfrontSavingsValue,
        monthlyBreakdown: [noUpfront1yCostTimeseries[0]]
      });

      // Verify total cost formula
      expect(result.noUpfront_1y.totalCost).toBeCloseTo(result.noUpfront_1y.totalMonthlyPayment + result.noUpfront_1y.totalUpfront, 6);

      // Partial Upfront 1y
      const partialUpfrontAnnual = computeAnnualisedForKey(partialUpfront1yCostTimeseries[0], 'partialUpfront_1y');
      const partialUpfrontSavingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - partialUpfrontAnnual.annualAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const partialUpfrontSavingsValue = onDemandTotalAdjusted - partialUpfrontAnnual.annualAdjusted;

      expect(result.partialUpfront_1y).withContext('Partial Upfront 1y scenario').toEqual({
        scenario: 'partialUpfront_1y',
        totalCost: partialUpfrontAnnual.annualAdjusted,
        totalAdjustedAmortised: partialUpfrontAnnual.annualAdjusted,
        totalUpfront: partialUpfrontAnnual.annualUpfront,
        totalMonthlyPayment: partialUpfrontAnnual.annualMonthly,
        highestMonthlySpend: scenarios[2].upfront + scenarios[2].monthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsPercent: partialUpfrontSavingsPercent,
        savingsValue: partialUpfrontSavingsValue,
        savingsValueOnDemand: partialUpfrontSavingsValue,
        savingsPercentOnDemand: partialUpfrontSavingsPercent,
        savingsPercentCurrent: partialUpfrontSavingsPercent,
        savingsValueCurrent: partialUpfrontSavingsValue,
        monthlyBreakdown: [partialUpfront1yCostTimeseries[0]]
      });

      // Verify total cost formula
      expect(result.partialUpfront_1y.totalCost).toBeCloseTo(result.partialUpfront_1y.totalMonthlyPayment + result.partialUpfront_1y.totalUpfront, 6);

      // Full Upfront 1y
      const fullUpfront1yAnnual = computeAnnualisedForKey(fullUpfront1yCostTimeseries[0], 'fullUpfront_1y');
      const fullUpfront1ySavingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - fullUpfront1yAnnual.annualAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const fullUpfront1ySavingsValue = onDemandTotalAdjusted - fullUpfront1yAnnual.annualAdjusted;

      expect(result.fullUpfront_1y).withContext('Full Upfront 1y scenario').toEqual({
        scenario: 'fullUpfront_1y',
        totalCost: fullUpfront1yAnnual.annualAdjusted,
        totalAdjustedAmortised: fullUpfront1yAnnual.annualAdjusted,
        totalUpfront: fullUpfront1yAnnual.annualUpfront,
        totalMonthlyPayment: fullUpfront1yAnnual.annualMonthly,
        highestMonthlySpend: scenarios[3].upfront + scenarios[3].monthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsPercent: fullUpfront1ySavingsPercent,
        savingsValue: fullUpfront1ySavingsValue,
        savingsValueOnDemand: fullUpfront1ySavingsValue,
        savingsPercentOnDemand: fullUpfront1ySavingsPercent,
        savingsPercentCurrent: fullUpfront1ySavingsPercent,
        savingsValueCurrent: fullUpfront1ySavingsValue,
        monthlyBreakdown: [fullUpfront1yCostTimeseries[0]]
      });

      // Verify total cost formula
      expect(result.fullUpfront_1y.totalCost).toBeCloseTo(result.fullUpfront_1y.totalMonthlyPayment + result.fullUpfront_1y.totalUpfront, 6);

      // Partial Upfront 3y
      const partialUpfront3yAnnual = computeAnnualisedForKey(partialUpfront3yCostTimeseries[0], 'partialUpfront_3y');
      const partialUpfront3ySavingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - partialUpfront3yAnnual.annualAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const partialUpfront3ySavingsValue = onDemandTotalAdjusted - partialUpfront3yAnnual.annualAdjusted;

      expect(result.partialUpfront_3y).withContext('Partial Upfront 3y scenario').toEqual({
        scenario: 'partialUpfront_3y',
        totalCost: partialUpfront3yAnnual.annualAdjusted,
        totalAdjustedAmortised: partialUpfront3yAnnual.annualAdjusted,
        totalUpfront: partialUpfront3yAnnual.annualUpfront,
        totalMonthlyPayment: partialUpfront3yAnnual.annualMonthly,
        highestMonthlySpend: scenarios[4].upfront + scenarios[4].monthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsPercent: partialUpfront3ySavingsPercent,
        savingsValue: partialUpfront3ySavingsValue,
        savingsValueOnDemand: partialUpfront3ySavingsValue,
        savingsPercentOnDemand: partialUpfront3ySavingsPercent,
        savingsPercentCurrent: partialUpfront3ySavingsPercent,
        savingsValueCurrent: partialUpfront3ySavingsValue,
        monthlyBreakdown: [partialUpfront3yCostTimeseries[0]]
      });

      // Verify total cost formula
      expect(result.partialUpfront_3y.totalCost).toBeCloseTo(result.partialUpfront_3y.totalMonthlyPayment + result.partialUpfront_3y.totalUpfront, 6);

      // Full Upfront 3y
      const fullUpfront3yAnnual = computeAnnualisedForKey(fullUpfront3yCostTimeseries[0], 'fullUpfront_3y');
      const fullUpfront3ySavingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - fullUpfront3yAnnual.annualAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const fullUpfront3ySavingsValue = onDemandTotalAdjusted - fullUpfront3yAnnual.annualAdjusted;

      expect(result.fullUpfront_3y).withContext('Full Upfront 3y scenario').toEqual({
        scenario: 'fullUpfront_3y',
        totalCost: fullUpfront3yAnnual.annualAdjusted,
        totalAdjustedAmortised: fullUpfront3yAnnual.annualAdjusted,
        totalUpfront: fullUpfront3yAnnual.annualUpfront,
        totalMonthlyPayment: fullUpfront3yAnnual.annualMonthly,
        highestMonthlySpend: scenarios[5].upfront + scenarios[5].monthly,
        highestMonthlySpendMonth: { year: 2025, month: 1 },
        savingsPercent: fullUpfront3ySavingsPercent,
        savingsValue: fullUpfront3ySavingsValue,
        savingsValueOnDemand: fullUpfront3ySavingsValue,
        savingsPercentOnDemand: fullUpfront3ySavingsPercent,
        savingsPercentCurrent: fullUpfront3ySavingsPercent,
        savingsValueCurrent: fullUpfront3ySavingsValue,
        monthlyBreakdown: [fullUpfront3yCostTimeseries[0]]
      });

      // Verify total cost formula
      expect(result.fullUpfront_3y.totalCost).toBeCloseTo(result.fullUpfront_3y.totalMonthlyPayment + result.fullUpfront_3y.totalUpfront, 6);
    });
  });

  describe('calculateCostComparison - multiple upfronts', () => {
    it('sums multiple upfront payments when RiRows start in different months', () => {
      const year = 2025;

      // Create two RiRows that have fullUpfront_1y upfronts in different months
      const ct1: any = {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year, month: 1, cost: { fullUpfront_1y: { upfrontCost: 1000, monthlyCost: 0, adjustedAmortisedCost: 0, totalMonthlyCost: 1000 } } },
          { year, month: 2, cost: { fullUpfront_1y: { upfrontCost: 0, monthlyCost: 0, adjustedAmortisedCost: 0, totalMonthlyCost: 0 } } }
        ]
      };

      const ct2: any = {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year, month: 1, cost: { fullUpfront_1y: { upfrontCost: 0, monthlyCost: 0, adjustedAmortisedCost: 0, totalMonthlyCost: 0 } } },
          { year, month: 2, cost: { fullUpfront_1y: { upfrontCost: 2000, monthlyCost: 0, adjustedAmortisedCost: 0, totalMonthlyCost: 2000 } } }
        ]
      };

      // mergeRiRows should sum upfronts per month
      const merged = CostComparisonCalculator.mergeRiRows([ct1, ct2]);

      // Build onDemand timeseries for savings calculation (small monthly values)
      const onDemandTs: any = {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: merged.monthlyCost.map((mc: any) => ({ year: mc.year, month: mc.month, cost: { onDemand: { upfrontCost: 0, monthlyCost: 10, adjustedAmortisedCost: 0, totalMonthlyCost: 0 + 10 } } }))
      };

      const byScenario: any = {
        onDemand: onDemandTs,
        current: onDemandTs,
        noUpfront_1y: merged,
        partialUpfront_1y: merged,
        fullUpfront_1y: merged,
        partialUpfront_3y: merged,
        fullUpfront_3y: merged
      };

      const result = CostComparisonCalculator.calculateAnnualisedCostComparison(byScenario);

      // Expect totalUpfront to be summed from both RiRows and annualised across timeseries months
      const months = merged.monthlyCost.length;
      const sumUpfront = merged.monthlyCost.reduce((s: number, m: any) => s + ((m.cost.fullUpfront_1y && m.cost.fullUpfront_1y.upfrontCost) || 0), 0);
      const expectedAnnualisedUpfront = sumUpfront * (12 / Math.max(1, months));
      expect(result.fullUpfront_1y.totalUpfront).toBeCloseTo(expectedAnnualisedUpfront, 6);
    });
  });
});

describe('mergeRiRows', () => {
  it('should merge multiple CostTimeseries within the same scenario, summing costs for the same year/month', () => {
    const year = 2025;

    // Define cost constants for different RI rows
    const row1JanOnDemandUpfront = 10;
    const row1JanOnDemandMonthly = 100;
    const row1FebOnDemandUpfront = 0;
    const row1FebOnDemandMonthly = 100;

    const row2JanOnDemandUpfront = 5;
    const row2JanOnDemandMonthly = 50;
    const row2FebOnDemandUpfront = 0;
    const row2FebOnDemandMonthly = 75;

    const row3MarOnDemandUpfront = 0;
    const row3MarOnDemandMonthly = 120;

    // Create first CostTimeseries (representing one RI row)
    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: row1JanOnDemandUpfront, monthlyCost: row1JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row1JanOnDemandUpfront + row1JanOnDemandMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            onDemand: { upfrontCost: row1FebOnDemandUpfront, monthlyCost: row1FebOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row1FebOnDemandUpfront + row1FebOnDemandMonthly }
          }
        }
      ]
    };

    // Create second CostTimeseries (representing another RI row)
    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: row2JanOnDemandUpfront, monthlyCost: row2JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row2JanOnDemandUpfront + row2JanOnDemandMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            onDemand: { upfrontCost: row2FebOnDemandUpfront, monthlyCost: row2FebOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row2FebOnDemandUpfront + row2FebOnDemandMonthly }
          }
        }
      ]
    };

    // Create third CostTimeseries (representing a third RI row with different months)
    const ts3: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 3,
          cost: {
            onDemand: { upfrontCost: row3MarOnDemandUpfront, monthlyCost: row3MarOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row3MarOnDemandUpfront + row3MarOnDemandMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2, ts3];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    expect(result.monthlyCost).toBeDefined();

    // Check merged data for each month
    const janData = result.monthlyCost.find(mc => mc.year === year && mc.month === 1);
    expect(janData).toBeDefined();
      expect(janData!.cost).toEqual({
      onDemand: { upfrontCost: row1JanOnDemandUpfront + row2JanOnDemandUpfront, monthlyCost: row1JanOnDemandMonthly + row2JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (row1JanOnDemandUpfront + row2JanOnDemandUpfront) + (row1JanOnDemandMonthly + row2JanOnDemandMonthly) }
    });

    const febData = result.monthlyCost.find(mc => mc.year === year && mc.month === 2);
    expect(febData).toBeDefined();
    expect(febData!.cost).toEqual({
      onDemand: { upfrontCost: row1FebOnDemandUpfront + row2FebOnDemandUpfront, monthlyCost: row1FebOnDemandMonthly + row2FebOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (row1FebOnDemandUpfront + row2FebOnDemandUpfront) + (row1FebOnDemandMonthly + row2FebOnDemandMonthly) }
    });

    const marData = result.monthlyCost.find(mc => mc.year === year && mc.month === 3);
    expect(marData).toBeDefined();
    expect(marData!.cost).toEqual({
      onDemand: { upfrontCost: row3MarOnDemandUpfront, monthlyCost: row3MarOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: row3MarOnDemandUpfront + row3MarOnDemandMonthly }
    });

    // Ensure no other months
    expect(result.monthlyCost.length).toBe(3);
  });

  it('should handle merging CostTimeseries with different saving scenarios', () => {
    const year = 2025;

    // Define cost constants for noUpfront_1y scenario
    const ts1JanNoUpfrontUpfront = 0;
    const ts1JanNoUpfrontMonthly = 90;
    const ts1FebNoUpfrontUpfront = 0;
    const ts1FebNoUpfrontMonthly = 85;

    const ts2JanNoUpfrontUpfront = 0;
    const ts2JanNoUpfrontMonthly = 45;
    const ts2FebNoUpfrontUpfront = 0;
    const ts2FebNoUpfrontMonthly = 40;

    // Create CostTimeseries for noUpfront_1y scenario
    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanNoUpfrontUpfront + ts1JanNoUpfrontMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            noUpfront_1y: { upfrontCost: ts1FebNoUpfrontUpfront, monthlyCost: ts1FebNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1FebNoUpfrontUpfront + ts1FebNoUpfrontMonthly }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            noUpfront_1y: { upfrontCost: ts2JanNoUpfrontUpfront, monthlyCost: ts2JanNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanNoUpfrontUpfront + ts2JanNoUpfrontMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            noUpfront_1y: { upfrontCost: ts2FebNoUpfrontUpfront, monthlyCost: ts2FebNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2FebNoUpfrontUpfront + ts2FebNoUpfrontMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront + ts2JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly + ts2JanNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1JanNoUpfrontUpfront + ts2JanNoUpfrontUpfront) + (ts1JanNoUpfrontMonthly + ts2JanNoUpfrontMonthly) }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      noUpfront_1y: { upfrontCost: ts1FebNoUpfrontUpfront + ts2FebNoUpfrontUpfront, monthlyCost: ts1FebNoUpfrontMonthly + ts2FebNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1FebNoUpfrontUpfront + ts2FebNoUpfrontUpfront) + (ts1FebNoUpfrontMonthly + ts2FebNoUpfrontMonthly) }
    });
  });

  it('should handle merging CostTimeseries with partial upfront scenarios', () => {
    const year = 2025;

    // Define cost constants for partialUpfront_1y scenario
    const ts1JanPartialUpfront = 50;
    const ts1JanPartialMonthly = 85;
    const ts1FebPartialUpfront = 0;
    const ts1FebPartialMonthly = 80;

    const ts2JanPartialUpfront = 25;
    const ts2JanPartialMonthly = 40;
    const ts2FebPartialUpfront = 0;
    const ts2FebPartialMonthly = 35;

    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            partialUpfront_1y: { upfrontCost: ts1JanPartialUpfront, monthlyCost: ts1JanPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanPartialUpfront + ts1JanPartialMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_1y: { upfrontCost: ts1FebPartialUpfront, monthlyCost: ts1FebPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1FebPartialUpfront + ts1FebPartialMonthly }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanPartialUpfront + ts2JanPartialMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_1y: { upfrontCost: ts2FebPartialUpfront, monthlyCost: ts2FebPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2FebPartialUpfront + ts2FebPartialMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      partialUpfront_1y: { upfrontCost: ts1JanPartialUpfront + ts2JanPartialUpfront, monthlyCost: ts1JanPartialMonthly + ts2JanPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1JanPartialUpfront + ts2JanPartialUpfront) + (ts1JanPartialMonthly + ts2JanPartialMonthly) }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      partialUpfront_1y: { upfrontCost: ts1FebPartialUpfront + ts2FebPartialUpfront, monthlyCost: ts1FebPartialMonthly + ts2FebPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1FebPartialUpfront + ts2FebPartialUpfront) + (ts1FebPartialMonthly + ts2FebPartialMonthly) }
    });
  });

  it('should handle merging CostTimeseries with full upfront scenarios', () => {
    const year = 2025;

    // Define cost constants for fullUpfront_1y scenario
    const ts1JanFullUpfront = 100;
    const ts1JanFullMonthly = 0;
    const ts1FebFullUpfront = 0;
    const ts1FebFullMonthly = 0;

    const ts2JanFullUpfront = 50;
    const ts2JanFullMonthly = 0;
    const ts2FebFullUpfront = 0;
    const ts2FebFullMonthly = 0;

    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            fullUpfront_1y: { upfrontCost: ts1JanFullUpfront, monthlyCost: ts1JanFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanFullUpfront + ts1JanFullMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            fullUpfront_1y: { upfrontCost: ts1FebFullUpfront, monthlyCost: ts1FebFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1FebFullUpfront + ts1FebFullMonthly }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            fullUpfront_1y: { upfrontCost: ts2JanFullUpfront, monthlyCost: ts2JanFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanFullUpfront + ts2JanFullMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            fullUpfront_1y: { upfrontCost: ts2FebFullUpfront, monthlyCost: ts2FebFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2FebFullUpfront + ts2FebFullMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      fullUpfront_1y: { upfrontCost: ts1JanFullUpfront + ts2JanFullUpfront, monthlyCost: ts1JanFullMonthly + ts2JanFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1JanFullUpfront + ts2JanFullUpfront) + (ts1JanFullMonthly + ts2JanFullMonthly) }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      fullUpfront_1y: { upfrontCost: ts1FebFullUpfront + ts2FebFullUpfront, monthlyCost: ts1FebFullMonthly + ts2FebFullMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1FebFullUpfront + ts2FebFullUpfront) + (ts1FebFullMonthly + ts2FebFullMonthly) }
    });
  });

  it('should handle merging CostTimeseries with 3-year scenarios', () => {
    const year = 2025;

    // Define cost constants for partialUpfront_3y scenario
    const ts1JanPartial3yUpfront = 150;
    const ts1JanPartial3yMonthly = 75;
    const ts1FebPartial3yUpfront = 0;
    const ts1FebPartial3yMonthly = 70;

    const ts2JanPartial3yUpfront = 75;
    const ts2JanPartial3yMonthly = 35;
    const ts2FebPartial3yUpfront = 0;
    const ts2FebPartial3yMonthly = 30;

    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            partialUpfront_3y: { upfrontCost: ts1JanPartial3yUpfront, monthlyCost: ts1JanPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanPartial3yUpfront + ts1JanPartial3yMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_3y: { upfrontCost: ts1FebPartial3yUpfront, monthlyCost: ts1FebPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1FebPartial3yUpfront + ts1FebPartial3yMonthly }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            partialUpfront_3y: { upfrontCost: ts2JanPartial3yUpfront, monthlyCost: ts2JanPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanPartial3yUpfront + ts2JanPartial3yMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_3y: { upfrontCost: ts2FebPartial3yUpfront, monthlyCost: ts2FebPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2FebPartial3yUpfront + ts2FebPartial3yMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      partialUpfront_3y: { upfrontCost: ts1JanPartial3yUpfront + ts2JanPartial3yUpfront, monthlyCost: ts1JanPartial3yMonthly + ts2JanPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1JanPartial3yUpfront + ts2JanPartial3yUpfront) + (ts1JanPartial3yMonthly + ts2JanPartial3yMonthly) }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      partialUpfront_3y: { upfrontCost: ts1FebPartial3yUpfront + ts2FebPartial3yUpfront, monthlyCost: ts1FebPartial3yMonthly + ts2FebPartial3yMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1FebPartial3yUpfront + ts2FebPartial3yUpfront) + (ts1FebPartial3yMonthly + ts2FebPartial3yMonthly) }
    });
  });

  it('should handle merging CostTimeseries with mixed scenarios in the same month', () => {
    const year = 2025;

    // Define cost constants
    const ts1JanOnDemandUpfront = 10;
    const ts1JanOnDemandMonthly = 100;
    const ts1JanNoUpfrontUpfront = 0;
    const ts1JanNoUpfrontMonthly = 90;

    const ts2JanOnDemandUpfront = 5;
    const ts2JanOnDemandMonthly = 50;
    const ts2JanPartialUpfront = 25;
    const ts2JanPartialMonthly = 40;

    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: ts1JanOnDemandUpfront, monthlyCost: ts1JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanOnDemandUpfront + ts1JanOnDemandMonthly },
            noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanNoUpfrontUpfront + ts1JanNoUpfrontMonthly }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: ts2JanOnDemandUpfront, monthlyCost: ts2JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanOnDemandUpfront + ts2JanOnDemandMonthly },
            partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanPartialUpfront + ts2JanPartialMonthly }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      onDemand: { upfrontCost: ts1JanOnDemandUpfront + ts2JanOnDemandUpfront, monthlyCost: ts1JanOnDemandMonthly + ts2JanOnDemandMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: (ts1JanOnDemandUpfront + ts2JanOnDemandUpfront) + (ts1JanOnDemandMonthly + ts2JanOnDemandMonthly) },
      noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts1JanNoUpfrontUpfront + ts1JanNoUpfrontMonthly },
      partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly, adjustedAmortisedCost: 0, totalMonthlyCost: ts2JanPartialUpfront + ts2JanPartialMonthly }
    });
  });

  it('should handle empty input array', () => {
    const result = CostComparisonCalculator.mergeRiRows([]);
    expect(result.monthlyCost).toEqual([]);
  });

  it('should handle single CostTimeseries input', () => {
    const year = 2025;
    const ts: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
          }
        }
      ]
    };

    const result = CostComparisonCalculator.mergeRiRows([ts]);
    expect(result).toEqual(ts);
  });

  it('should handle CostTimeseries with empty monthlyCost arrays', () => {
    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: []
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year: 2025,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;
    expect(mergedTs.monthlyCost.length).toBe(1);
      expect(mergedTs.monthlyCost[0].cost).toEqual({
      onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
    });
  });

  it('should handle CostTimeseries with null cost data', () => {
    const year = 2025;
    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year,
          month: 1,
          cost: {
            onDemand: null as any // null cost data
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;

    const janData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 1);
    expect(janData!.cost).toEqual({
      onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
    });
  });

  it('should handle overlapping months across different years', () => {
    const ts1: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year: 2024,
          month: 12,
          cost: {
            onDemand: { upfrontCost: 0, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 0 + 100 }
          }
        },
        {
          year: 2025,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 10, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 10 + 100 }
          }
        }
      ]
    };

    const ts2: CostTimeseries = {
      riRow: {} as any,
      pricingData: {} as any,
      monthlyCost: [
        {
          year: 2025,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 5, monthlyCost: 50, adjustedAmortisedCost: 0, totalMonthlyCost: 5 + 50 }
          }
        },
        {
          year: 2025,
          month: 2,
          cost: {
            onDemand: { upfrontCost: 0, monthlyCost: 75, adjustedAmortisedCost: 0, totalMonthlyCost: 0 + 75 }
          }
        }
      ]
    };

    const costTimeseriesArray: CostTimeseries[] = [ts1, ts2];

    // Act
    const result = CostComparisonCalculator.mergeRiRows(costTimeseriesArray);

    // Assert
    expect(result).toBeDefined();
    const mergedTs = result;
    expect(mergedTs.monthlyCost.length).toBe(3);

    // Check December 2024
    const dec2024Data = mergedTs.monthlyCost.find((mc: any) => mc.year === 2024 && mc.month === 12);
    expect(dec2024Data!.cost).toEqual({
      onDemand: { upfrontCost: 0, monthlyCost: 100, adjustedAmortisedCost: 0, totalMonthlyCost: 0 + 100 }
    });

    // Check January 2025 (merged)
    const jan2025Data = mergedTs.monthlyCost.find((mc: any) => mc.year === 2025 && mc.month === 1);
    expect(jan2025Data!.cost).toEqual({
      onDemand: { upfrontCost: 15, monthlyCost: 150, adjustedAmortisedCost: 0, totalMonthlyCost: 15 + 150 }
    });

    // Check February 2025
    const feb2025Data = mergedTs.monthlyCost.find((mc: any) => mc.year === 2025 && mc.month === 2);
    expect(feb2025Data!.cost).toEqual({
      onDemand: { upfrontCost: 0, monthlyCost: 75, adjustedAmortisedCost: 0, totalMonthlyCost: 0 + 75 }
    });
  });
});
