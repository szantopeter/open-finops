export interface RiMatchingCriteriaProps {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront' | string;
  durationMonths: number;
}

export class RiMatchingCriteria implements RiMatchingCriteriaProps {
  instanceClass: string;
  region: string;
  multiAz: boolean;
  engine: string;
  edition?: string | null;
  upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront' | string;
  durationMonths: number;

  constructor(props: RiMatchingCriteriaProps) {
    this.instanceClass = props.instanceClass;
    this.region = props.region;
    this.multiAz = props.multiAz;
    this.engine = props.engine;
    this.edition = props.edition ?? null;
    this.upfrontPayment = props.upfrontPayment;
    this.durationMonths = props.durationMonths;
  }

  /**
   * Returns a stable string key representing the 7-field composite.
   * Order and normalization is important for equality.
   */
  toKey(): string {
    const parts = [
      this.instanceClass?.trim() ?? '',
      this.region?.trim() ?? '',
      String(this.multiAz),
      this.engine?.trim() ?? '',
      (this.edition ?? '').toString().trim(),
      this.upfrontPayment?.toString().trim() ?? '',
      String(this.durationMonths)
    ];
    return parts.join('|').toLowerCase();
  }

  /**
   * Exact equality: all seven fields equal after normalization
   */
  equals(other: RiMatchingCriteria): boolean {
    if (!other) return false;
    return this.toKey() === other.toKey();
  }
}
