export interface OnDemandPricing {
  hourly: number;
  daily: number;
  sku?: string;
}

export interface SavingsOption {
  term: SavingsTerm;
  purchaseOption: PurchaseOption;
  upfront?: number | null;
  hourly?: number | null;
  effectiveHourly?: number | null;
  daily?: number | null;
}

export type SavingsOptionsMap = Record<SavingsKey, SavingsOption | null> | null;

export type SavingsTerm = '1yr' | '3yr';
export type PurchaseOption = 'No Upfront' | 'Partial Upfront' | 'All Upfront' | 'On Demand';

export type SavingsKey =
  | '1yr_No Upfront'
  | '1yr_Partial Upfront'
  | '1yr_All Upfront'
  | '3yr_Partial Upfront'
  | '3yr_All Upfront';

export type Deployment = 'single-az' | 'multi-az';

export type LicenseToken = 'byol' | 'li';

export interface PricingData {
  region: string;
  instance: string;
  deployment: Deployment;
  engine: string; // normalized engine key, e.g. 'oracle-se2'
  license?: LicenseToken;
  onDemand: OnDemandPricing;
  savingsOptions: SavingsOptionsMap;
}

export default PricingData;
