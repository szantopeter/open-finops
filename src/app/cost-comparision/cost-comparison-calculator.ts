import type CostTimeseries from '../cost-timeseries/costTimeseries.model';

export interface CostComparison {
  scenario: string;
  totalCost: number;
  totalAdjustedAmortised?: number;
  totalUpfront: number;
  totalMonthlyPayment: number;
  highestMonthlySpend: number;
  highestMonthlySpendMonth?: { year: number; month: number };
  savingsPercent?: number;
  savingsValue?: number;
  savingsValueOnDemand?: number;
  savingsPercentOnDemand?: number;
  savingsValueCurrent?: number;
  savingsPercentCurrent?: number;
  
  monthlyBreakdown: CostTimeseries[];
}

export interface CostTimeseriesByScenario {
  onDemand: CostTimeseries;
  current: CostTimeseries;
  noUpfront_1y: CostTimeseries;
  partialUpfront_1y: CostTimeseries;
  fullUpfront_1y: CostTimeseries;
  partialUpfront_3y: CostTimeseries;
  fullUpfront_3y: CostTimeseries;
}

export interface CostComparisonByScenario {
  onDemand: CostComparison;
  current: CostComparison;
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
                monthlyCost: 0,
                adjustedAmortisedCost: 0
              };
            }

            existingCost[scenario].upfrontCost += scenarioCost.upfrontCost || 0;
            existingCost[scenario].monthlyCost += scenarioCost.monthlyCost || 0;
            existingCost[scenario].adjustedAmortisedCost += scenarioCost.adjustedAmortisedCost || 0;
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
  calculateAnnualisedCostComparison(costTimeseriesByScenario: CostTimeseriesByScenario, _firstFullYear: number): CostComparisonByScenario {
    const result: Partial<CostComparisonByScenario> = {};
    const scenarioKeys: (keyof CostTimeseriesByScenario)[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];

    // Helper to accumulate totals for a given CostTimeseries and scenario key
    const accumulateTotals = (ts: CostTimeseries, scenarioKey?: keyof CostTimeseries['monthlyCost'][0]['cost']) => {
      let sumUpfront = 0;
      let sumMonthly = 0;
      let sumAdjusted = 0;
      let maxMonthly = 0;
      let highestMonth: { year: number; month: number } | undefined;

      const months = ts.monthlyCost.length;

      for (const mc of ts.monthlyCost) {
        let key: any = scenarioKey as string | undefined;
        if (!key) {
          const keys = Object.keys(mc.cost || {});
          key = keys.length > 0 ? keys[0] : undefined;
        }
        const costData = key ? (mc.cost as any)[key] : undefined;
        if (costData) {
          sumMonthly += costData.monthlyCost || 0;
          sumAdjusted += (typeof costData.adjustedAmortisedCost === 'number') ? costData.adjustedAmortisedCost : 0;
          const monthlyCost = (costData.monthlyCost || 0) + (costData.upfrontCost || 0);
          if (monthlyCost > maxMonthly) {
            maxMonthly = monthlyCost;
            highestMonth = { year: mc.year, month: mc.month };
          }
          sumUpfront += costData.upfrontCost || 0;
        }
      }

      const factor = 12 / Math.max(1, months);

      return {
        totalUpfront: sumUpfront * factor,
        totalMonthlyPayment: sumMonthly * factor,
        totalAdjustedAmortised: sumAdjusted * factor,
        maxMonthly,
        highestMonth
      };
    };

    // First, calculate onDemand to use for savings percent
    const onDemandScenario = 'onDemand';
    const onDemandTs = costTimeseriesByScenario[onDemandScenario];
    const onDemandTotals = accumulateTotals(onDemandTs, onDemandScenario);
    const onDemandTotalAdjusted = onDemandTotals.totalAdjustedAmortised;

      result[onDemandScenario] = {
      scenario: onDemandScenario,
      totalCost: onDemandTotalAdjusted,
      totalAdjustedAmortised: onDemandTotalAdjusted,
      totalUpfront: onDemandTotals.totalUpfront,
      totalMonthlyPayment: onDemandTotals.totalMonthlyPayment,
      highestMonthlySpend: onDemandTotals.maxMonthly,
      highestMonthlySpendMonth: onDemandTotals.highestMonth,
        savingsValue: undefined,
        savingsValueOnDemand: 0,
        savingsPercentOnDemand: 0,
        monthlyBreakdown: onDemandTs ? [onDemandTs] : []
    };


    // Calculate 'current' scenario (required)
      const currentTotals = accumulateTotals(costTimeseriesByScenario.current);
      const currentTotalAdjusted = currentTotals.totalAdjustedAmortised;
      const savingsValueOnDemandForCurrent = onDemandTotalAdjusted - currentTotalAdjusted;
      const savingsPercentOnDemandForCurrent = onDemandTotalAdjusted > 0 ? (savingsValueOnDemandForCurrent / onDemandTotalAdjusted) * 100 : 0;
      result.current = {
        scenario: 'current',
        totalCost: currentTotalAdjusted,
        totalAdjustedAmortised: currentTotalAdjusted,
        totalUpfront: currentTotals.totalUpfront,
        totalMonthlyPayment: currentTotals.totalMonthlyPayment,
        highestMonthlySpend: currentTotals.maxMonthly,
        highestMonthlySpendMonth: currentTotals.highestMonth,
        savingsValue: undefined,
        savingsValueOnDemand: savingsValueOnDemandForCurrent,
        savingsPercentOnDemand: savingsPercentOnDemandForCurrent,
        monthlyBreakdown: [costTimeseriesByScenario.current]
      };

    // Now calculate other scenarios and compute savings vs onDemand and vs current
    for (const scenario of scenarioKeys.slice(1)) {
      const ts = costTimeseriesByScenario[scenario];
      const totals = accumulateTotals(ts, scenario as any);
      const totalAdjusted = totals.totalAdjustedAmortised;
      const savingsPercent = onDemandTotalAdjusted > 0 ? ((onDemandTotalAdjusted - totalAdjusted) / onDemandTotalAdjusted) * 100 : 0;
      const savingsValue = onDemandTotalAdjusted - totalAdjusted;

      // compute savings vs current
      const currentTotal = result.current.totalAdjustedAmortised || result.current.totalCost || 0;
      const savingsPercentCurrent = currentTotal > 0 ? ((currentTotal - totalAdjusted) / currentTotal) * 100 : 0;
      const savingsValueCurrent = currentTotal - totalAdjusted;

      const comparison: any = {
        scenario,
        totalCost: totalAdjusted,
        totalAdjustedAmortised: totalAdjusted,
        totalUpfront: totals.totalUpfront,
        totalMonthlyPayment: totals.totalMonthlyPayment,
        highestMonthlySpend: totals.maxMonthly,
        highestMonthlySpendMonth: totals.highestMonth,
        savingsPercent,
        savingsValue,
        savingsValueOnDemand: savingsValue,
        savingsPercentOnDemand: savingsPercent,
        monthlyBreakdown: [ts]
      };

      comparison.savingsPercentCurrent = savingsPercentCurrent;
      comparison.savingsValueCurrent = savingsValueCurrent;

      result[scenario] = comparison;
    }

    return result as CostComparisonByScenario;
  }
};
