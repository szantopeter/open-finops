export interface RiRow {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: string;
  durationMonths: number;
  startDate: string;
  endDate?: string;
  count?: number;
}

export interface RenewalProjection {
  originalRi: RiRow;
  renewalStart: Date;
  renewalEnd?: Date;
  pricing: any; // PricingRecord
  monthlyCost?: number;
}
