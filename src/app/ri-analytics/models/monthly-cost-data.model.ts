export interface MonthlyCostData {
  monthKey: string;
  groupKey: string;
  riCost: number;
  onDemandCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  details: any[];
  renewalCost?: number; // Projected cost if all RIs were renewed upon expiration
}
