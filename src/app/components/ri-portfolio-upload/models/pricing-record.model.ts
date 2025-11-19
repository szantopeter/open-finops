export interface PricingRecordProps {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront' | string;
  durationMonths: number;
  dailyOnDemandRate?: number; // optional, when available
  dailyReservedRate?: number; // daily cost under reservation
  upfrontCost?: number; // upfront charge if any
}

export class PricingRecord implements PricingRecordProps {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront' | string;
  durationMonths: number;
  dailyOnDemandRate?: number;
  dailyReservedRate?: number;
  upfrontCost?: number;

  constructor(props: PricingRecordProps) {
    this.instanceClass = props.instanceClass;
    this.region = props.region;
    this.multiAz = props.multiAz;
    this.engine = props.engine;
    this.edition = props.edition ?? null;
    this.upfrontPayment = props.upfrontPayment;
    this.durationMonths = props.durationMonths;
    this.dailyOnDemandRate = props.dailyOnDemandRate;
    this.dailyReservedRate = props.dailyReservedRate;
    this.upfrontCost = props.upfrontCost;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.instanceClass) errors.push('instanceClass is required');
    if (!this.region) errors.push('region is required');
    if (this.multiAz === undefined || this.multiAz === null) errors.push('multiAz is required');
    if (!this.engine) errors.push('engine is required');
    if (!this.upfrontPayment) errors.push('upfrontPayment is required');
    if (!this.durationMonths || this.durationMonths <= 0) errors.push('durationMonths must be > 0');
    if (this.dailyReservedRate === undefined && this.upfrontCost === undefined) {
      errors.push('pricing must include either dailyReservedRate or upfrontCost');
    }
    return { valid: errors.length === 0, errors };
  }
}
