import { MonthlyBreakdownTableComponent } from './monthly-breakdown-table.component';

describe('MonthlyBreakdownTableComponent calculations', () => {
  let comp: MonthlyBreakdownTableComponent;

  beforeEach(() => {
    comp = new MonthlyBreakdownTableComponent();
  });

  it('calculates total monthly spend for a month correctly', () => {
    comp.timeseries = [
      {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year: 2025, month: 1, cost: { partialUpfront_1y: { monthlyCost: 100, upfrontCost: 25, adjustedAmortisedCost: 120, totalMonthlyCost: 125 } as any } },
          { year: 2025, month: 2, cost: { partialUpfront_1y: { monthlyCost: 200, upfrontCost: 0, adjustedAmortisedCost: 200, totalMonthlyCost: 200 } as any } }
        ]
      } as any
    ];

    const val1 = comp.getTotalMonthlySpend('partialUpfront_1y', 2025, 1);
    const val2 = comp.getTotalMonthlySpend('partialUpfront_1y', 2025, 2);

    expect(val1).toBe(125);
    expect(val2).toBe(200);
  });

  it('calculates total monthly spend total across period', () => {
    comp.timeseries = [
      {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year: 2025, month: 1, cost: { partialUpfront_1y: { monthlyCost: 10, upfrontCost: 5, adjustedAmortisedCost: 12, totalMonthlyCost: 15 } as any } },
          { year: 2025, month: 2, cost: { partialUpfront_1y: { monthlyCost: 20, upfrontCost: 0, adjustedAmortisedCost: 20, totalMonthlyCost: 20 } as any } }
        ]
      } as any
    ];

    const total = comp.getTotalMonthlySpendTotal('partialUpfront_1y');
    expect(total).toBe(35);
  });

  it('handles missing scenario gracefully', () => {
    comp.timeseries = [
      {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year: 2025, month: 1, cost: { onDemand: { monthlyCost: 50, upfrontCost: 0, adjustedAmortisedCost: 50, totalMonthlyCost: 50 } as any } }
        ]
      } as any
    ];

    const val = comp.getTotalMonthlySpend('partialUpfront_1y', 2025, 1);
    expect(val).toBe(0);
  });

  it('uses precomputed totalMonthlyCost when present', () => {
    comp.timeseries = [
      {
        riRow: {} as any,
        pricingData: {} as any,
        monthlyCost: [
          { year: 2025, month: 1, cost: { partialUpfront_1y: { monthlyCost: 10, upfrontCost: 5, totalMonthlyCost: 42, adjustedAmortisedCost: 12 } as any } }
        ]
      } as any
    ];

    const val = comp.getTotalMonthlySpend('partialUpfront_1y', 2025, 1);
    expect(val).toBe(42);
  });
});

