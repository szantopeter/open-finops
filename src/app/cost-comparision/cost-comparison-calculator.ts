import CostTimeseries from '../cost-timeseries/costTimeseries.model';

export interface CostComparison {
  scenario: string;
  totalCost: number;
  totalUpfront: number;
  totalMonthlyPayment: number;
  maximumMonthlyCost: number;
  savingsPercent?: number;
  monthlyBreakdown: CostTimeseries[];
}

export type CostTimeseriesByScenario = {
  onDemand: CostTimeseries;
  noUpfront_1y: CostTimeseries;
  partialUpfront_1y: CostTimeseries;
  fullUpfront_1y: CostTimeseries;
  partialUpfront_3y: CostTimeseries;
  fullUpfront_3y: CostTimeseries;
};

export type CostComparisonByScenario = {
  onDemand: CostComparison;
  noUpfront_1y: CostComparison;
  partialUpfront_1y: CostComparison;
  fullUpfront_1y: CostComparison;
  partialUpfront_3y: CostComparison;
  fullUpfront_3y: CostComparison;
};

export class CostComparisonCalculator {
  // Prevent instantiation — class used as namespace for static helpers
  private constructor() {}

  /**
   * Merges multiple RiRows into a single CostTimeseries, combining rows that represent the same month and year. Values are summed.
   * @param costTimeseriesArray 
   * @returns 
   */
  static mergeRiRows(costTimeseriesArray: CostTimeseries[]): CostTimeseries {
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
  }

  /**
   * Calculates cost comparisons from cost timeseries for different scenarios.
   * @param costTimeseriesByScenario timeseries for different scenarios
   * @param firstFullYear The year to consider for total cost calculations.
   * @returns 
   */
  static calculateCostComparison(costTimeseriesByScenario: CostTimeseriesByScenario, firstFullYear: number): CostComparisonByScenario {
    const result: Partial<CostComparisonByScenario> = {};
    const scenarioKeys: (keyof CostTimeseriesByScenario)[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];

    // First, calculate onDemand to use for savings percent
    const onDemandScenario = 'onDemand';
    const onDemandTs = costTimeseriesByScenario[onDemandScenario];
    let onDemandTotalCost = 0;
    let onDemandTotalUpfront = 0;
    let onDemandTotalMonthly = 0;
    let onDemandMaxMonthly = 0;

    for (const mc of onDemandTs.monthlyCost) {
      if (mc.year === firstFullYear) {
        const costData = mc.cost[onDemandScenario];
        if (costData) {
          onDemandTotalCost += costData.monthlyCost + costData.upfrontCost;
          onDemandTotalMonthly += costData.monthlyCost;
          const monthlyCost = costData.monthlyCost + costData.upfrontCost;
          if (monthlyCost > onDemandMaxMonthly) {
            onDemandMaxMonthly = monthlyCost;
          }
          if (mc.month === 1) {
            onDemandTotalUpfront += costData.upfrontCost;
          }
        }
      }
    }

    result[onDemandScenario] = {
      scenario: onDemandScenario,
      totalCost: onDemandTotalCost,
      totalUpfront: onDemandTotalUpfront,
      totalMonthlyPayment: onDemandTotalMonthly,
      maximumMonthlyCost: onDemandMaxMonthly,
      monthlyBreakdown: [onDemandTs]
    };

    // Now calculate other scenarios
    for (const scenario of scenarioKeys.slice(1)) {
      const ts = costTimeseriesByScenario[scenario];
      let totalCost = 0;
      let totalUpfront = 0;
      let totalMonthlyPayment = 0;
      let maximumMonthlyCost = 0;

      for (const mc of ts.monthlyCost) {
        if (mc.year === firstFullYear) {
          const costData = mc.cost[scenario];
          if (costData) {
            totalCost += costData.monthlyCost + costData.upfrontCost;
            totalMonthlyPayment += costData.monthlyCost;
            const monthlyCost = costData.monthlyCost + costData.upfrontCost;
            if (monthlyCost > maximumMonthlyCost) {
              maximumMonthlyCost = monthlyCost;
            }
            if (mc.month === 1) {
              totalUpfront += costData.upfrontCost;
            }
          }
        }
      }

      const savingsPercent = onDemandTotalCost > 0 ? ((onDemandTotalCost - totalCost) / onDemandTotalCost) * 100 : 0;

      result[scenario] = {
        scenario,
        totalCost,
        totalUpfront,
        totalMonthlyPayment,
        maximumMonthlyCost,
        savingsPercent,
        monthlyBreakdown: [ts]
      };
    }

    return result as CostComparisonByScenario;
  }


}
