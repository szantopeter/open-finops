import { MonthlyCostChartComponent } from './monthly-cost-chart.component';
import { BehaviorSubject } from 'rxjs';

describe('MonthlyCostChartComponent (unit)', () => {
  const importSubject = new BehaviorSubject<any | null>(null);

  const mockDataService = {
    currentImport$: importSubject.asObservable(),
  } as any;

  const mockMatcher = {
    loadPricingData: (() => {}) as any,
  } as any;

  const mockAggregator = {
    aggregateMonthlyCosts: (() => ({})) as any,
  } as any;

  const mockPricingLoader = {
    loadAllPricing: () => ({
      subscribe: (handlers: any) => ({
        next: (v: any) => handlers?.next?.(v),
        error: (e: any) => handlers?.error?.(e),
        unsubscribe: () => {},
      }),
    }) as any,
    // component calls loadPricingForPaths(paths) in runtime; provide a minimal implementation
    loadPricingForPaths: (paths: string[]) => ({
      subscribe: (handlers: any) => ({
        next: (v: any) => handlers?.next?.(v),
        error: (e: any) => handlers?.error?.(e),
        unsubscribe: () => {},
      }),
    }) as any,
  } as any;

  const mockCdr = {
    detectChanges: (() => {}) as any,
  } as any;

  it('initializes and subscribes to data service without errors', () => {
  const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    expect(comp).toBeTruthy();
  });

  it('sets data to null when import is empty', () => {
  const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    comp.ngOnInit();
    importSubject.next(null);
    expect(comp.data).toBeNull();
  });

  it('updates data when import provided', () => {
    mockAggregator.aggregateMonthlyCosts = () => ({ '2025-11': { group1: { totalCost: 123, details: [] } } }) as any;
  const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
  (window as any).echarts = { init: () => ({ setOption: () => {} }) };
  comp.ngOnInit();
    const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
    importSubject.next(sampleImport);
    expect(comp.data).toBeDefined();
  });
});
