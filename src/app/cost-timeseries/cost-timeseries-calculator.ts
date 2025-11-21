import CostTimeseries from './costTimeseries.model';
import { SavingsOption } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

export class CostTimeseriesCalculator {

  static calculateCostTimeSeries(riPortfolio : RiPortfolio, savingsOption : SavingsOption) : CostTimeseries[] {
    if (riPortfolio.rows.length === 0) {
      return [];
    }

    const result: CostTimeseries[] = [];

    for (const row of riPortfolio.rows) {
      const riRow = row.riRow;
      const pricingData = row.pricingData;
      const startDate = riRow.startDate;
      const endDate = riRow.endDate;

      const monthlyCost: CostTimeseries['monthlyCost'] = [];

      let current = startDate;
      while (current <= endDate) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const activeDays = this.getActiveDaysInMonth(year, month, startDate, endDate);
        const cost = this.calculateCostForMonth(pricingData, savingsOption, activeDays, riRow.count, monthlyCost.length === 0);

        monthlyCost.push({
          year,
          month,
          cost
        });

        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
      }

      result.push({
        riRow,
        pricingData,
        monthlyCost
      });
    }

    return result;
  }

  private static getActiveDaysInMonth(year: number, month: number, startDate: Date, endDate: Date): number {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const activeStart = startDate > monthStart ? startDate : monthStart;
    const activeEnd = endDate < monthEnd ? endDate : monthEnd;
    if (activeStart >= activeEnd) return 0;
    return Math.ceil((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  private static calculateCostForMonth(pricingData: any, savingsOption: SavingsOption, activeDays: number, count: number, isFirstMonth: boolean): any {
    const cost: any = {
      fullUpfront_3y: null,
      fullUpfront_1y: null,
      partialUpfront_3y: null,
      partialUpfront_1y: null,
      noUpfront_1y: null,
      onDemand: null
    };

    if (savingsOption.purchaseOption === 'On Demand') {
      const dailyPrice = pricingData.onDemand.daily;
      cost.onDemand = {
        upfrontCost: 0,
        monthlyCost: dailyPrice * activeDays * count
      };
    } else {
      // For RI, find the matching savings option
      const key = `${savingsOption.term}_${savingsOption.purchaseOption.replace(' ', '')}`;
      const savings = pricingData.savingsOptions?.[key];
      if (savings) {
        const field = this.getCostField(savingsOption);
        cost[field] = {
          upfrontCost: isFirstMonth ? savings.upfront * count : 0,
          monthlyCost: 0 // Assuming no monthly for upfront, but for no upfront, need to calculate
        };
        // For no upfront, monthly cost
        if (savingsOption.purchaseOption === 'No Upfront') {
          // Assume monthly rate, but since not in model, perhaps 0 for now
          cost[field].monthlyCost = 0; // TODO: calculate monthly
        }
      }
    }

    return cost;
  }

  private static getCostField(savingsOption: SavingsOption): string {
    if (savingsOption.term === '3yr') {
      if (savingsOption.purchaseOption === 'All Upfront') return 'fullUpfront_3y';
      if (savingsOption.purchaseOption === 'Partial Upfront') return 'partialUpfront_3y';
    } else if (savingsOption.term === '1yr') {
      if (savingsOption.purchaseOption === 'All Upfront') return 'fullUpfront_1y';
      if (savingsOption.purchaseOption === 'Partial Upfront') return 'partialUpfront_1y';
      if (savingsOption.purchaseOption === 'No Upfront') return 'noUpfront_1y';
    }
    return 'onDemand'; // fallback
  }

}
