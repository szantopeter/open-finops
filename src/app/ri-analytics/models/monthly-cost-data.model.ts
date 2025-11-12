export interface MonthlyCostData {
  monthKey: string;
  groupKey: string;
  riCost: number;
  onDemandCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  details: any[];
}