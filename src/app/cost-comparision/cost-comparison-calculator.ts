import type CostTimeseries from '../cost-timeseries/costTimeseries.model';

export interface CostComparison {
  scenario: string;
  totalCost: number;
  totalUpfront: number;
  totalMonthlyPayment: number;
  highestMonthlySpend: number;
  highestMonthlySpendMonth?: { year: number; month: number };
  savingsPercent?: number;
  monthlyBreakdown: CostTimeseries[];
}

export interface CostTimeseriesByScenario {
  onDemand: CostTimeseries;
  noUpfront_1y: CostTimeseries;
  partialUpfront_1y: CostTimeseries;
  fullUpfront_1y: CostTimeseries;
  partialUpfront_3y: CostTimeseries;
  fullUpfront_3y: CostTimeseries;
}

export interface CostComparisonByScenario {
  onDemand: CostComparison;
  noUpfront_1y: CostComparison;
  partialUpfront_1y: CostComparison;
  fullUpfront_1y: CostComparison;
  partialUpfront_3y: CostComparison;
  fullUpfront_3y: CostComparison;
}

export const CostComparisonCalculator = {
  /**
   * Merges multiple RiRows into a single CostTimeseries, combining rows that represent the same month and year. Values are summed.
   * @param costTimeseriesArray
   * @returns
   */
  mergeRiRows(costTimeseriesArray: CostTimeseries[]): CostTimeseries {
    if (costTimeseriesArray.length === 0) {
      // Return a default empty CostTimeseries
      return {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: []
      };
    }

    if (costTimeseriesArray.length === 1) {
      return costTimeseriesArray[0];
    }

    // Use a Map to group monthly costs by year/month
    const monthlyCostMap = new Map<string, any>();

    // Process each CostTimeseries
    for (const costTimeseries of costTimeseriesArray) {
      for (const monthlyCost of costTimeseries.monthlyCost) {
        const key = `${monthlyCost.year}-${monthlyCost.month}`;

        if (!monthlyCostMap.has(key)) {
          monthlyCostMap.set(key, {
            year: monthlyCost.year,
            month: monthlyCost.month,
            cost: {}
          });
        }

        const existingCost = monthlyCostMap.get(key).cost;
        const newCost = monthlyCost.cost;

        // Merge costs for each saving scenario
        const scenarioKeys: (keyof typeof newCost)[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];

        for (const scenario of scenarioKeys) {
          const scenarioCost = newCost[scenario];
          if (scenarioCost && typeof scenarioCost === 'object') {
            if (!existingCost[scenario]) {
              existingCost[scenario] = {
                upfrontCost: 0,
                monthlyCost: 0
              };
            }

            existingCost[scenario].upfrontCost += scenarioCost.upfrontCost || 0;
            existingCost[scenario].monthlyCost += scenarioCost.monthlyCost || 0;
          }
        }
      }
    }

    // Create the merged CostTimeseries
    const mergedMonthlyCosts = Array.from(monthlyCostMap.values());

    const mergedCostTimeseries: CostTimeseries = {
      riRow: costTimeseriesArray[0].riRow, // Use the first one as reference
      pricingData: costTimeseriesArray[0].pricingData, // Use the first one as reference
      monthlyCost: mergedMonthlyCosts
    };

    return mergedCostTimeseries;
  },

  /**
   * Calculates cost comparisons from cost timeseries for different scenarios.
   * @param costTimeseriesByScenario timeseries for different scenarios
   * @param firstFullYear The year to consider for total cost calculations.
   * @returns
   */
  calculateCostComparison(costTimeseriesByScenario: CostTimeseriesByScenario, _firstFullYear: number): CostComparisonByScenario {
    const result: Partial<CostComparisonByScenario> = {};
    const scenarioKeys: (keyof CostTimeseriesByScenario)[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];

    // First, calculate onDemand to use for savings percent
    const onDemandScenario = 'onDemand';
    const onDemandTs = costTimeseriesByScenario[onDemandScenario];
    let onDemandTotalUpfront = 0;
    let onDemandTotalMonthly = 0;
    let onDemandMaxMonthly = 0;
    let onDemandHighestMonth: { year: number; month: number } | undefined;
    let onDemandUpfrontAdded = false;

    for (const mc of onDemandTs.monthlyCost) {
      const costData = mc.cost[onDemandScenario];
      if (costData) {
        onDemandTotalMonthly += costData.monthlyCost;
        const monthlyCost = costData.monthlyCost + costData.upfrontCost;
        if (monthlyCost > onDemandMaxMonthly) {
          onDemandMaxMonthly = monthlyCost;
          onDemandHighestMonth = { year: mc.year, month: mc.month };
        }
        if (!onDemandUpfrontAdded) {
          onDemandTotalUpfront += costData.upfrontCost;
          onDemandUpfrontAdded = true;
        }
      }
    }

    const onDemandTotalCost = onDemandTotalMonthly + onDemandTotalUpfront;

    result[onDemandScenario] = {
      scenario: onDemandScenario,
      totalCost: onDemandTotalCost,
      totalUpfront: onDemandTotalUpfront,
      totalMonthlyPayment: onDemandTotalMonthly,
      highestMonthlySpend: onDemandMaxMonthly,
      highestMonthlySpendMonth: onDemandHighestMonth,
      monthlyBreakdown: [onDemandTs]
    };

    // Now calculate other scenarios
    for (const scenario of scenarioKeys.slice(1)) {
      const ts = costTimeseriesByScenario[scenario];
      let totalUpfront = 0;
      let totalMonthlyPayment = 0;
      let highestMonthlySpend = 0;
      let highestMonthlySpendMonth: { year: number; month: number } | undefined;
      let upfrontAdded = false;

      for (const mc of ts.monthlyCost) {
        const costData = mc.cost[scenario];
        if (costData) {
          totalMonthlyPayment += costData.monthlyCost;
          const monthlyCost = costData.monthlyCost + costData.upfrontCost;
          if (monthlyCost > highestMonthlySpend) {
            highestMonthlySpend = monthlyCost;
            highestMonthlySpendMonth = { year: mc.year, month: mc.month };
          }
          if (!upfrontAdded) {
            totalUpfront += costData.upfrontCost;
            upfrontAdded = true;
          }
        }
      }

      const totalCost = totalMonthlyPayment + totalUpfront;

      const savingsPercent = onDemandTotalCost > 0 ? ((onDemandTotalCost - totalCost) / onDemandTotalCost) * 100 : 0;

      result[scenario] = {
        scenario,
        totalCost,
        totalUpfront,
        totalMonthlyPayment,
        highestMonthlySpend,
        highestMonthlySpendMonth,
        savingsPercent,
        monthlyBreakdown: [ts]
      };
    }

    return result as CostComparisonByScenario;
  }
};
