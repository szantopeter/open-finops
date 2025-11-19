export interface AggregationRequest {
  groupingMode: 'ri-type' | 'cost-type';
  renewalOptions?: {
    upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront';
    durationMonths: 12 | 36;
  };
  // Optional calendar year (e.g. 2026) to which renewal projections and
  // aggregations should be computed (inclusive). If omitted, the service
  // will default to the next calendar year.
  projectionEndYear?: number;
}
