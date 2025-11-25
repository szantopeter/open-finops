
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
              monthlyCost
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
        noUpfront_1y: noUpfront1yCostTimeseries[0],
        partialUpfront_1y: partialUpfront1yCostTimeseries[0],
        fullUpfront_1y: fullUpfront1yCostTimeseries[0],
        partialUpfront_3y: partialUpfront3yCostTimeseries[0],
        fullUpfront_3y: fullUpfront3yCostTimeseries[0]
      };

      // Act
      const result = CostComparisonCalculator.calculateCostComparison(costTimeseriesByScenario, firstFullYear);

      // Assert
      expect(result).toBeDefined();

      // Expected calculations
      const onDemandTotalCost = (scenarios[0].monthly * 12) + scenarios[0].upfront;
      const onDemandTotalUpfront = scenarios[0].upfront;
      const onDemandTotalMonthly = scenarios[0].monthly * 12;
      const onDemandMaxMonthly = scenarios[0].monthly;

      expect(result.onDemand).withContext('On-demand scenario').toEqual({
        scenario: 'onDemand',
        totalCost: onDemandTotalCost,
        totalUpfront: onDemandTotalUpfront,
        totalMonthlyPayment: onDemandTotalMonthly,
        maximumMonthlyCost: onDemandMaxMonthly,
        monthlyBreakdown: [onDemandCostTimeseries[0]]
      });

      // No Upfront 1y
      const noUpfrontTotalCost = (scenarios[1].monthly * 12) + scenarios[1].upfront;
      const noUpfrontTotalUpfront = scenarios[1].upfront;
      const noUpfrontTotalMonthly = scenarios[1].monthly * 12;
      const noUpfrontMaxMonthly = scenarios[1].monthly;
      const noUpfrontSavingsPercent = ((onDemandTotalCost - noUpfrontTotalCost) / onDemandTotalCost) * 100;

      expect(result.noUpfront_1y).withContext('No Upfront 1y scenario').toEqual({
        scenario: 'noUpfront_1y',
        totalCost: noUpfrontTotalCost,
        totalUpfront: noUpfrontTotalUpfront,
        totalMonthlyPayment: noUpfrontTotalMonthly,
        maximumMonthlyCost: noUpfrontMaxMonthly,
        savingsPercent: noUpfrontSavingsPercent,
        monthlyBreakdown: [noUpfront1yCostTimeseries[0]]
      });

      // Partial Upfront 1y
      const partialUpfrontTotalCost = (scenarios[2].monthly * 12) + scenarios[2].upfront;
      const partialUpfrontTotalUpfront = scenarios[2].upfront;
      const partialUpfrontTotalMonthly = scenarios[2].monthly * 12;
      const partialUpfrontMaxMonthly = scenarios[2].upfront + scenarios[2].monthly;
      const partialUpfrontSavingsPercent = ((onDemandTotalCost - partialUpfrontTotalCost) / onDemandTotalCost) * 100;

      expect(result.partialUpfront_1y).withContext('Partial Upfront 1y scenario').toEqual({
        scenario: 'partialUpfront_1y',
        totalCost: partialUpfrontTotalCost,
        totalUpfront: partialUpfrontTotalUpfront,
        totalMonthlyPayment: partialUpfrontTotalMonthly,
        maximumMonthlyCost: partialUpfrontMaxMonthly,
        savingsPercent: partialUpfrontSavingsPercent,
        monthlyBreakdown: [partialUpfront1yCostTimeseries[0]]
      });

      // Full Upfront 1y
      const fullUpfront1yTotalCost = (scenarios[3].monthly * 12) + scenarios[3].upfront;
      const fullUpfront1yTotalUpfront = scenarios[3].upfront;
      const fullUpfront1yTotalMonthly = scenarios[3].monthly * 12;
      const fullUpfront1yMaxMonthly = scenarios[3].upfront + scenarios[3].monthly;
      const fullUpfront1ySavingsPercent = ((onDemandTotalCost - fullUpfront1yTotalCost) / onDemandTotalCost) * 100;

      expect(result.fullUpfront_1y).withContext('Full Upfront 1y scenario').toEqual({
        scenario: 'fullUpfront_1y',
        totalCost: fullUpfront1yTotalCost,
        totalUpfront: fullUpfront1yTotalUpfront,
        totalMonthlyPayment: fullUpfront1yTotalMonthly,
        maximumMonthlyCost: fullUpfront1yMaxMonthly,
        savingsPercent: fullUpfront1ySavingsPercent,
        monthlyBreakdown: [fullUpfront1yCostTimeseries[0]]
      });

      // Partial Upfront 3y
      const partialUpfront3yTotalCost = (scenarios[4].monthly * 12) + scenarios[4].upfront;
      const partialUpfront3yTotalUpfront = scenarios[4].upfront;
      const partialUpfront3yTotalMonthly = scenarios[4].monthly * 12;
      const partialUpfront3yMaxMonthly = scenarios[4].upfront + scenarios[4].monthly;
      const partialUpfront3ySavingsPercent = ((onDemandTotalCost - partialUpfront3yTotalCost) / onDemandTotalCost) * 100;

      expect(result.partialUpfront_3y).withContext('Partial Upfront 3y scenario').toEqual({
        scenario: 'partialUpfront_3y',
        totalCost: partialUpfront3yTotalCost,
        totalUpfront: partialUpfront3yTotalUpfront,
        totalMonthlyPayment: partialUpfront3yTotalMonthly,
        maximumMonthlyCost: partialUpfront3yMaxMonthly,
        savingsPercent: partialUpfront3ySavingsPercent,
        monthlyBreakdown: [partialUpfront3yCostTimeseries[0]]
      });

      // Full Upfront 3y
      const fullUpfront3yTotalCost = (scenarios[5].monthly * 12) + scenarios[5].upfront;
      const fullUpfront3yTotalUpfront = scenarios[5].upfront;
      const fullUpfront3yTotalMonthly = scenarios[5].monthly * 12;
      const fullUpfront3yMaxMonthly = scenarios[5].upfront + scenarios[5].monthly;
      const fullUpfront3ySavingsPercent = ((onDemandTotalCost - fullUpfront3yTotalCost) / onDemandTotalCost) * 100;

      expect(result.fullUpfront_3y).withContext('Full Upfront 3y scenario').toEqual({
        scenario: 'fullUpfront_3y',
        totalCost: fullUpfront3yTotalCost,
        totalUpfront: fullUpfront3yTotalUpfront,
        totalMonthlyPayment: fullUpfront3yTotalMonthly,
        maximumMonthlyCost: fullUpfront3yMaxMonthly,
        savingsPercent: fullUpfront3ySavingsPercent,
        monthlyBreakdown: [fullUpfront3yCostTimeseries[0]]
      });
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
            onDemand: { upfrontCost: row1JanOnDemandUpfront, monthlyCost: row1JanOnDemandMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            onDemand: { upfrontCost: row1FebOnDemandUpfront, monthlyCost: row1FebOnDemandMonthly }
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
            onDemand: { upfrontCost: row2JanOnDemandUpfront, monthlyCost: row2JanOnDemandMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            onDemand: { upfrontCost: row2FebOnDemandUpfront, monthlyCost: row2FebOnDemandMonthly }
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
            onDemand: { upfrontCost: row3MarOnDemandUpfront, monthlyCost: row3MarOnDemandMonthly }
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
      onDemand: { upfrontCost: row1JanOnDemandUpfront + row2JanOnDemandUpfront, monthlyCost: row1JanOnDemandMonthly + row2JanOnDemandMonthly }
    });

    const febData = result.monthlyCost.find(mc => mc.year === year && mc.month === 2);
    expect(febData).toBeDefined();
    expect(febData!.cost).toEqual({
      onDemand: { upfrontCost: row1FebOnDemandUpfront + row2FebOnDemandUpfront, monthlyCost: row1FebOnDemandMonthly + row2FebOnDemandMonthly }
    });

    const marData = result.monthlyCost.find(mc => mc.year === year && mc.month === 3);
    expect(marData).toBeDefined();
    expect(marData!.cost).toEqual({
      onDemand: { upfrontCost: row3MarOnDemandUpfront, monthlyCost: row3MarOnDemandMonthly }
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
            noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            noUpfront_1y: { upfrontCost: ts1FebNoUpfrontUpfront, monthlyCost: ts1FebNoUpfrontMonthly }
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
            noUpfront_1y: { upfrontCost: ts2JanNoUpfrontUpfront, monthlyCost: ts2JanNoUpfrontMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            noUpfront_1y: { upfrontCost: ts2FebNoUpfrontUpfront, monthlyCost: ts2FebNoUpfrontMonthly }
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
      noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront + ts2JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly + ts2JanNoUpfrontMonthly }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      noUpfront_1y: { upfrontCost: ts1FebNoUpfrontUpfront + ts2FebNoUpfrontUpfront, monthlyCost: ts1FebNoUpfrontMonthly + ts2FebNoUpfrontMonthly }
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
            partialUpfront_1y: { upfrontCost: ts1JanPartialUpfront, monthlyCost: ts1JanPartialMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_1y: { upfrontCost: ts1FebPartialUpfront, monthlyCost: ts1FebPartialMonthly }
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
            partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_1y: { upfrontCost: ts2FebPartialUpfront, monthlyCost: ts2FebPartialMonthly }
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
      partialUpfront_1y: { upfrontCost: ts1JanPartialUpfront + ts2JanPartialUpfront, monthlyCost: ts1JanPartialMonthly + ts2JanPartialMonthly }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      partialUpfront_1y: { upfrontCost: ts1FebPartialUpfront + ts2FebPartialUpfront, monthlyCost: ts1FebPartialMonthly + ts2FebPartialMonthly }
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
            fullUpfront_1y: { upfrontCost: ts1JanFullUpfront, monthlyCost: ts1JanFullMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            fullUpfront_1y: { upfrontCost: ts1FebFullUpfront, monthlyCost: ts1FebFullMonthly }
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
            fullUpfront_1y: { upfrontCost: ts2JanFullUpfront, monthlyCost: ts2JanFullMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            fullUpfront_1y: { upfrontCost: ts2FebFullUpfront, monthlyCost: ts2FebFullMonthly }
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
      fullUpfront_1y: { upfrontCost: ts1JanFullUpfront + ts2JanFullUpfront, monthlyCost: ts1JanFullMonthly + ts2JanFullMonthly }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      fullUpfront_1y: { upfrontCost: ts1FebFullUpfront + ts2FebFullUpfront, monthlyCost: ts1FebFullMonthly + ts2FebFullMonthly }
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
            partialUpfront_3y: { upfrontCost: ts1JanPartial3yUpfront, monthlyCost: ts1JanPartial3yMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_3y: { upfrontCost: ts1FebPartial3yUpfront, monthlyCost: ts1FebPartial3yMonthly }
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
            partialUpfront_3y: { upfrontCost: ts2JanPartial3yUpfront, monthlyCost: ts2JanPartial3yMonthly }
          }
        },
        {
          year,
          month: 2,
          cost: {
            partialUpfront_3y: { upfrontCost: ts2FebPartial3yUpfront, monthlyCost: ts2FebPartial3yMonthly }
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
      partialUpfront_3y: { upfrontCost: ts1JanPartial3yUpfront + ts2JanPartial3yUpfront, monthlyCost: ts1JanPartial3yMonthly + ts2JanPartial3yMonthly }
    });

    const febData = mergedTs.monthlyCost.find((mc: any) => mc.year === year && mc.month === 2);
    expect(febData!.cost).toEqual({
      partialUpfront_3y: { upfrontCost: ts1FebPartial3yUpfront + ts2FebPartial3yUpfront, monthlyCost: ts1FebPartial3yMonthly + ts2FebPartial3yMonthly }
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
            onDemand: { upfrontCost: ts1JanOnDemandUpfront, monthlyCost: ts1JanOnDemandMonthly },
            noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly }
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
            onDemand: { upfrontCost: ts2JanOnDemandUpfront, monthlyCost: ts2JanOnDemandMonthly },
            partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly }
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
      onDemand: { upfrontCost: ts1JanOnDemandUpfront + ts2JanOnDemandUpfront, monthlyCost: ts1JanOnDemandMonthly + ts2JanOnDemandMonthly },
      noUpfront_1y: { upfrontCost: ts1JanNoUpfrontUpfront, monthlyCost: ts1JanNoUpfrontMonthly },
      partialUpfront_1y: { upfrontCost: ts2JanPartialUpfront, monthlyCost: ts2JanPartialMonthly }
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
            onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
            onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
      onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
            onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
      onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
            onDemand: { upfrontCost: 0, monthlyCost: 100 }
          }
        },
        {
          year: 2025,
          month: 1,
          cost: {
            onDemand: { upfrontCost: 10, monthlyCost: 100 }
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
            onDemand: { upfrontCost: 5, monthlyCost: 50 }
          }
        },
        {
          year: 2025,
          month: 2,
          cost: {
            onDemand: { upfrontCost: 0, monthlyCost: 75 }
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
      onDemand: { upfrontCost: 0, monthlyCost: 100 }
    });

    // Check January 2025 (merged)
    const jan2025Data = mergedTs.monthlyCost.find((mc: any) => mc.year === 2025 && mc.month === 1);
    expect(jan2025Data!.cost).toEqual({
      onDemand: { upfrontCost: 15, monthlyCost: 150 }
    });

    // Check February 2025
    const feb2025Data = mergedTs.monthlyCost.find((mc: any) => mc.year === 2025 && mc.month === 2);
    expect(feb2025Data!.cost).toEqual({
      onDemand: { upfrontCost: 0, monthlyCost: 75 }
    });
  });
});
