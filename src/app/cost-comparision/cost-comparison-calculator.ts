import { CostTimeseriesCalculator } from '../cost-timeseries/cost-timeseries-calculator';
import CostTimeseries from '../cost-timeseries/costTimeseries.model';
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


    return null as any;
  }


}
