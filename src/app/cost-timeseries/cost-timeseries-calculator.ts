import CostTimeseries from './costTimeseries.model';
import { SavingsOption } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

export class CostTimeseriesCalculator {

  static calculateCostTimeSeries(riPortfolio : RiPortfolio, savingsOption : SavingsOption) : CostTimeseries[] {
    if (riPortfolio.rows.length === 0) {
      return [];
    }

    return riPortfolio.rows.map(({ riRow, pricingData }) => {
      const startDate = new Date(riRow.startDate);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1; // JS months are 0-based
      const endYear = riPortfolio.metadata.firstFullYear;

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + riRow.durationMonths);
      const riEndYear = endDate.getFullYear();
      const riEndMonth = endDate.getMonth() + 1;

      const monthlyCosts = [];

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 1;
        const monthEnd = 12;
        for (let month = monthStart; month <= monthEnd; month++) {
          const daysInMonth = new Date(year, month, 0).getDate();
          const isFirstMonth = year === startYear && month === startMonth;
          const isActive = year < riEndYear || (year === riEndYear && month <= riEndMonth);
          let activeDays = 0;
          if (isActive) {
            if (year === startYear && month === startMonth) {
              activeDays = daysInMonth - startDate.getDate() + 1;
            } else if (year === riEndYear && month === riEndMonth) {
              activeDays = endDate.getDate();
            } else {
              activeDays = daysInMonth;
            }
          }
          const cost = this.calculateMonthlyCost(pricingData, savingsOption, riRow.count, isFirstMonth, activeDays);
          monthlyCosts.push({
            year,
            month,
            cost
          });
        }
      }

      return {
        riRow,
        pricingData,
        monthlyCost: monthlyCosts
      };
    });
  }

    private static calculateMonthlyCost(pricingData: any, savingsOption: SavingsOption, count: number, isFirstMonth: boolean, activeDays: number): CostTimeseries['monthlyCost'][0]['cost'] {
        if (savingsOption.purchaseOption === 'On Demand') {
            if (activeDays > 0) {
                const monthlyCost = pricingData.onDemand.daily * activeDays * count;
                return {
                    onDemand: { upfrontCost: 0, monthlyCost },
                    fullUpfront_3y: null,
                    fullUpfront_1y: null,
                    partialUpUpfront_3y: null,
                    partialUpfront_1y: null,
                    noUpfront_1y: null
                };
            } else {
                return {
                    onDemand: null,
                    fullUpfront_3y: null,
                    fullUpfront_1y: null,
                    partialUpUpfront_3y: null,
                    partialUpfront_1y: null,
                    noUpfront_1y: null
                };
            }
        } else if (savingsOption.purchaseOption === 'All Upfront' && savingsOption.term === '3yr') {
            if (isFirstMonth) {
                const savingsKey = '3yr_All Upfront';
                const upfront = pricingData.savingsOptions[savingsKey]?.upfront || 0;
                const upfrontCost = upfront * count;
                return {
                    onDemand: null,
                    fullUpfront_3y: { upfrontCost, monthlyCost: 0 },
                    fullUpfront_1y: null,
                    partialUpUpfront_3y: null,
                    partialUpfront_1y: null,
                    noUpfront_1y: null
                };
            } else {
                return {
                    onDemand: null,
                    fullUpfront_3y: null,
                    fullUpfront_1y: null,
                    partialUpUpfront_3y: null,
                    partialUpfront_1y: null,
                    noUpfront_1y: null
                };
            }
        } else {
            // For other options, not implemented yet
            return {
                onDemand: null,
                fullUpfront_3y: null,
                fullUpfront_1y: null,
                partialUpUpfront_3y: null,
                partialUpfront_1y: null,
                noUpfront_1y: null
            };
        }
    }}
