/* eslint-disable @typescript-eslint/no-extraneous-class */
import type CostTimeseries from './costTimeseries.model';
import type { UpfrontPayment } from '../components/ri-portfolio-upload/models/pricing.model';
import type { RiPortfolio } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

export class CostTimeseriesCalculator {
  // Prevent instantiation — this class only contains static helpers
  private constructor() {}

  static calculateCostTimeSeries(riPortfolio : RiPortfolio, calculateOnDemand : boolean) : CostTimeseries[] {
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

      const current = new Date(startDate);
      while (current <= endDate) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const activeDays = this.getActiveDaysInMonth(year, month, startDate, endDate);

        const cost = this.calculateCostForMonth(pricingData, calculateOnDemand, riRow.upfrontPayment, riRow.durationMonths, activeDays, riRow.count, monthlyCost.length === 0);

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
    const msPerDay = 24 * 60 * 60 * 1000;
    const startUtc = Date.UTC(activeStart.getFullYear(), activeStart.getMonth(), activeStart.getDate());
    const endUtc = Date.UTC(activeEnd.getFullYear(), activeEnd.getMonth(), activeEnd.getDate());
    const diffDays = (endUtc - startUtc) / msPerDay;
    return Math.round(diffDays);
  }

  private static calculateCostForMonth(pricingData: any, calculateOnDemand : boolean, upfrontPayment: UpfrontPayment, durationMonths: number, activeDays: number, count: number, isFirstMonth: boolean): any {
    const cost: any = {
      fullUpfront_3y: null,
      fullUpfront_1y: null,
      partialUpfront_3y: null,
      partialUpfront_1y: null,
      noUpfront_1y: null,
      onDemand: null
    };

    if (calculateOnDemand) {

      const dailyPrice = pricingData.onDemand.daily;
      const monthlyCost = dailyPrice * activeDays * count;
      cost.onDemand = {
        upfrontCost: 0,
        monthlyCost: monthlyCost,
        adjustedAmortisedCost: monthlyCost,
        totalMonthlyCost: monthlyCost
      };

    } else {

      const savingFieldName = this.getSavingFieldName(upfrontPayment, durationMonths);
      const savings = pricingData.savingsOptions?.[savingFieldName];
      if (savings) {
        const costFieldName = this.getCostFieldName(upfrontPayment, durationMonths);
        const adjustedDaily = savings.adjustedAmortisedDaily ?? null;
        const upfrontCost = isFirstMonth ? savings.upfront * count : 0;
        const monthlyCost = savings.daily * count * activeDays;
        cost[costFieldName] = {
          upfrontCost: upfrontCost,
          monthlyCost: monthlyCost,
          adjustedAmortisedCost: adjustedDaily * activeDays * count,
          totalMonthlyCost: upfrontCost + monthlyCost
        };

      } else {
        throw new Error(`Savings option not found for upfrontPayment: ${upfrontPayment}, durationMonths: ${durationMonths}`);
      }
    }

    return cost;
  }

  private static getSavingFieldName(upfrontPayment: UpfrontPayment, durationMonths: number): string {

    if (durationMonths === 36) {
      if (upfrontPayment === 'All Upfront') return '3yr_All Upfront';
      if (upfrontPayment === 'Partial') return '3yr_Partial Upfront';
    } else if (durationMonths === 12) {
      if (upfrontPayment === 'All Upfront') return '1yr_All Upfront';
      if (upfrontPayment === 'Partial') return '1yr_Partial Upfront';
      if (upfrontPayment === 'No Upfront') return '1yr_No Upfront';
    }

    throw new Error(`Invalid upfrontPayment: ${upfrontPayment} or durationMonths: ${durationMonths}`);
  }

  private static getCostFieldName(upfrontPayment: UpfrontPayment, durationMonths: number): string {
    if (durationMonths === 36) {
      if (upfrontPayment === 'All Upfront') return 'fullUpfront_3y';
      if (upfrontPayment === 'Partial') return 'partialUpfront_3y';
    } else if (durationMonths === 12) {
      if (upfrontPayment === 'All Upfront') return 'fullUpfront_1y';
      if (upfrontPayment === 'Partial') return 'partialUpfront_1y';
      if (upfrontPayment === 'No Upfront') return 'noUpfront_1y';
    }
    return 'onDemand'; // fallback
  }

}
