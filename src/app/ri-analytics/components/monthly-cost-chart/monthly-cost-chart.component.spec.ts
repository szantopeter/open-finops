/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { BehaviorSubject } from 'rxjs';

import { MonthlyCostChartComponent } from './monthly-cost-chart.component';

describe('MonthlyCostChartComponent (unit)', () => {
  const importSubject = new BehaviorSubject<any | null>(null);

  const mockDataService = {
    currentImport$: importSubject.asObservable()
  } as any;

  const mockMatcher = {
    loadPricingData: (): void => { /* no-op */ }
  } as any;

  const mockAggregator = {
    aggregateMonthlyCosts: (): any => ({}) as any
  } as any;

  const mockPricingLoader = {
    loadAllPricing: (): any => ({
      subscribe: (handlers: any): any => ({

        next: function(v: any): void {
          handlers?.next?.(v);
        },

        error: function(e: any): void {
          handlers?.error?.(e);
        },

        unsubscribe: function(): void {
        }
      })
    }) as any,
    // component calls loadPricingForPaths(paths) in runtime; provide a minimal implementation
    loadPricingForPaths: (): any => ({
      subscribe: (handlers: any): any => ({

        next: function(v: any): void {
          handlers?.next?.(v);
        },

        error: function(e: any): void {
          handlers?.error?.(e);
        },

        unsubscribe: function(): void {
        }
      })
    }) as any
  } as any;

  const mockCdr = {
    detectChanges: (): void => { /* no-op */ }
  } as any;

  it('initializes and subscribes to data service without errors', (): void => {
    const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    expect(comp).toBeTruthy();
  });

  it('sets data to null when import is empty', (): void => {
    const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    comp.ngOnInit();
    importSubject.next(null);
    expect(comp.data).toBeNull();
  });

  it('updates data when import provided', (): void => {
    mockAggregator.aggregateMonthlyCosts = () => ({ '2025-11': { group1: { totalCost: 123, details: [] } } }) as any;
    const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    (window as any).echarts = { init: () => ({ setOption: () => {} }) };
    comp.ngOnInit();
    const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
    importSubject.next(sampleImport);
    expect(comp.data).toBeDefined();
  });
});
