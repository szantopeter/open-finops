/* eslint-disable @typescript-eslint/no-extraneous-class */
import { CostTimeseriesCalculator } from './cost-timeseries-calculator';
import CostTimeseries from './costTimeseries.model';
import { SavingsOption } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

export interface CostComparison {
  scenario: string;
  total3yrFullUpfront: number;
  total1yrFullUpfront: number;
  total3yrPartialUpfront: number;
  total1yrPartialUpfront: number;
  total3yrMonthly: number;
  total1yrMonthly: number;
  totalOnDemand: number;
  totalCost: number;
  highestMonthlyCost: number;
  totalCostSavingPercent?: number;
  monthlyBreakdown: CostTimeseries[];
}

export class CostComparisonCalculator {
  // Prevent instantiation — class used as namespace for static helpers
  private constructor() {}

  static calculateCostComparison(riPortfolio: RiPortfolio): CostComparison[] {
    const _firstFullYear = riPortfolio.metadata.firstFullYear;
    const scenarios: { name: string; savingsOption: SavingsOption }[] = [
      { name: 'On Demand', savingsOption: { purchaseOption: 'On Demand', term: '1yr' as any } },
      { name: '1yr No Upfront', savingsOption: { purchaseOption: 'No Upfront', term: '1yr' } },
      { name: '3yr Full Upfront', savingsOption: { purchaseOption: 'All Upfront', term: '3yr' } }
    ];

    const results: CostComparison[] = [];

    //TODO compare on demand to RIs
    for (const scenario of scenarios) {
      const costTimeseries = this.getCostTimeseries(riPortfolio, scenario.savingsOption);
      const upfrontCosts = this.calculateUpfrontCosts(costTimeseries, _firstFullYear);
      const monthlyCosts = this.calculateMonthlyCosts(costTimeseries, _firstFullYear);

      const highestMonthlyCost = monthlyCosts.highestMonthlyCost;
      const totalCost = upfrontCosts.total3yrFullUpfront + upfrontCosts.total1yrFullUpfront + upfrontCosts.total3yrPartialUpfront + upfrontCosts.total1yrPartialUpfront + monthlyCosts.total3yrMonthly + monthlyCosts.total1yrMonthly;
      const totalOnDemand = monthlyCosts.totalOnDemand;

      results.push({
        scenario: scenario.name,
        total3yrFullUpfront: upfrontCosts.total3yrFullUpfront,
        total1yrFullUpfront: upfrontCosts.total1yrFullUpfront,
        total3yrPartialUpfront: upfrontCosts.total3yrPartialUpfront,
        total1yrPartialUpfront: upfrontCosts.total1yrPartialUpfront,
        total3yrMonthly: monthlyCosts.total3yrMonthly,
        total1yrMonthly: monthlyCosts.total1yrMonthly,
        totalOnDemand,
        totalCost,
        highestMonthlyCost,
        monthlyBreakdown: costTimeseries
      });
    }

    // Calculate savings vs RI baseline (1yr No Upfront)
    const riBaseline = results.find(r => r.scenario === '1yr No Upfront');
    if (riBaseline) {
      for (const result of results) {
        if (result.scenario !== '1yr No Upfront') {
          result.totalCostSavingPercent = Math.round(((riBaseline.totalCost - result.totalCost) / riBaseline.totalCost) * 100);
        }
      }
    }

    return results;
  }

  private static getCostTimeseries(riPortfolio: RiPortfolio, savingsOption: SavingsOption): CostTimeseries[] {
    return CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, savingsOption);
  }

  private static calculateUpfrontCosts(costTimeseries: CostTimeseries[], firstFullYear: number): {
        total3yrFullUpfront: number;
        total1yrFullUpfront: number;
        total3yrPartialUpfront: number;
        total1yrPartialUpfront: number;
    } {
    const totals = {
      total3yrFullUpfront: 0,
      total1yrFullUpfront: 0,
      total3yrPartialUpfront: 0,
      total1yrPartialUpfront: 0
    };

    for (const ts of costTimeseries) {
      if (ts.monthlyCost.length > 0) {
        const cost = ts.monthlyCost[0].cost;
        const count = ts.riRow.count;

        if (cost.fullUpfront_3y?.upfrontCost) {
          totals.total3yrFullUpfront += cost.fullUpfront_3y.upfrontCost * count;
        }
        if (cost.fullUpfront_1y?.upfrontCost) {
          totals.total1yrFullUpfront += cost.fullUpfront_1y.upfrontCost * count;
        }
        if (cost.partialUpfront_3y?.upfrontCost) {
          totals.total3yrPartialUpfront += cost.partialUpfront_3y.upfrontCost * count;
        }
        if (cost.partialUpfront_1y?.upfrontCost) {
          totals.total1yrPartialUpfront += cost.partialUpfront_1y.upfrontCost * count;
        }
      }
    }

    return totals;
  }

  private static calculateMonthlyCosts(costTimeseries: CostTimeseries[], firstFullYear: number): {
        total3yrMonthly: number;
        total1yrMonthly: number;
        totalOnDemand: number;
        highestMonthlyCost: number;
    } {
    let total3yrMonthly = 0;
    let total1yrMonthly = 0;
    let totalOnDemand = 0;
    let highestMonthlyCost = 0;

    for (const timeseries of costTimeseries) {
      for (const monthly of timeseries.monthlyCost) {
        if (monthly.year === firstFullYear) {
          let monthlyCost = 0;

          // Sum monthly costs and categorize based on which cost field is populated
          if (monthly.cost.fullUpfront_3y) {
            monthlyCost += monthly.cost.fullUpfront_3y.monthlyCost;
            total3yrMonthly += monthly.cost.fullUpfront_3y.monthlyCost;
          } else if (monthly.cost.partialUpfront_3y) {
            monthlyCost += monthly.cost.partialUpfront_3y.monthlyCost;
            total3yrMonthly += monthly.cost.partialUpfront_3y.monthlyCost;
          } else if (monthly.cost.fullUpfront_1y) {
            monthlyCost += monthly.cost.fullUpfront_1y.monthlyCost;
            total1yrMonthly += monthly.cost.fullUpfront_1y.monthlyCost;
          } else if (monthly.cost.partialUpfront_1y) {
            monthlyCost += monthly.cost.partialUpfront_1y.monthlyCost;
            total1yrMonthly += monthly.cost.partialUpfront_1y.monthlyCost;
          } else if (monthly.cost.noUpfront_1y) {
            monthlyCost += monthly.cost.noUpfront_1y.monthlyCost;
            total1yrMonthly += monthly.cost.noUpfront_1y.monthlyCost;
          } else if (monthly.cost.onDemand) {
            monthlyCost += monthly.cost.onDemand.monthlyCost;
            totalOnDemand += monthly.cost.onDemand.monthlyCost;
          }

          highestMonthlyCost = Math.max(highestMonthlyCost, monthlyCost);
        }
      }
    }

    return { total3yrMonthly, total1yrMonthly, totalOnDemand, highestMonthlyCost };
  }

}
