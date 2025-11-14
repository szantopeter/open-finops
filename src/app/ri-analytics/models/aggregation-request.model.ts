export interface AggregationRequest {
  groupingMode: 'ri-type' | 'cost-type';
  renewalOptions?: {
    upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront';
    durationMonths: 12 | 36;
  };
}
