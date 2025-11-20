import { SavingsOption } from "../components/ri-portfolio-upload/models/pricing.model";
import { RiPortfolio } from "../components/ri-portfolio-upload/models/ri-portfolio.model";
import CostTimeseries, { RiCost } from "./costTimeseries.model";

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

            const monthlyCosts = [];

            for (let year = startYear; year <= endYear; year++) {
                const monthStart = year === startYear ? startMonth : 1;
                const monthEnd = 12;
                for (let month = monthStart; month <= monthEnd; month++) {
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const monthlyCost = pricingData.onDemand.daily * daysInMonth * riRow.count;
                    monthlyCosts.push({
                        year,
                        month,
                        cost: {
                        onDemand: { upfrontCost: 0, monthlyCost },
                        fullUpfront_3y: null as RiCost | null,
                        fullUpfront_1y: null as RiCost | null,
                        partialUpUpfront_3y: null as RiCost | null,
                        partialUpfront_1y: null as RiCost | null,
                        noUpfront_1y: null as RiCost | null
                    }
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

}