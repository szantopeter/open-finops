export interface SavingsYearData {
  year: number;
  months: number;
  totalSavings: number;
  label: string;
}

export interface SavingsBreakdown {
  year1: SavingsYearData;
  year2: SavingsYearData;
  total: number;
}
