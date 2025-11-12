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
    aggregateMonthlyCosts: (): any => ({}) as any,
    lastErrors: {
      unmatchedPricing: [],
      invalidPricing: [],
      missingRates: [],
      zeroActiveDays: [],
      zeroCount: [],
      renewalErrors: []
    }
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
      subscribe: (handlers: any): any => {
        // Call next asynchronously with mock pricing data
        setTimeout(() => {
          handlers.next?.({ records: [], missing: [] });
        }, 0);
        return {
          unsubscribe: function(): void {
          }
        };
      }
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
    mockAggregator.aggregateMonthlyCosts = () => ({ '2025-11': { group1: { monthKey: '2025-11', groupKey: 'group1', riCost: 123, onDemandCost: 200, savingsAmount: 77, savingsPercentage: 38.5, details: [] as any[] as any[] } } }) as any;
    const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
    (globalThis as any).echarts = { init: (): any => ({ setOption: (): void => {} }) };
    comp.ngOnInit();
    const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
    importSubject.next(sampleImport);
    expect(comp.data).toBeDefined();
  });

  describe('Renewal Data Processing', () => {
    it('processes data with renewal costs correctly', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (globalThis as any).echarts = { init: (): any => ({ setOption: (): void => {} }) };
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      // Wait for renderChart to complete
      setTimeout(() => {
        expect(comp.data).toEqual(mockAggregates);
        expect(comp.totalRiCost).toBe(150); // 100 RI + 50 renewal
        expect(comp.totalOnDemandCost).toBe(200);
        expect(comp.totalSavingsAmount).toBe(50);
        expect(comp.totalSavingsPercentage).toBe(25);
        done();
      }, 10);
    });

    it('handles data without renewal costs', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 0,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (globalThis as any).echarts = { init: () => ({ setOption: () => {} }) };
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        expect(comp.data).toEqual(mockAggregates);
        expect(comp.totalRiCost).toBe(100); // Only RI cost, no renewal
        expect(comp.totalOnDemandCost).toBe(200);
        expect(comp.totalSavingsAmount).toBe(100);
        expect(comp.totalSavingsPercentage).toBe(50);
        done();
      }, 10);
    });

    it('calculates total savings including renewal costs', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 80,
            renewalCost: 40,
            onDemandCost: 150,
            savingsAmount: 30,
            savingsPercentage: 20,
            details: [] as any[]
          }
        },
        '2025-12': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-12',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 0,
            renewalCost: 60,
            onDemandCost: 120,
            savingsAmount: 60,
            savingsPercentage: 50,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (globalThis as any).echarts = { init: () => ({ setOption: () => {} }) };
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        expect(comp.totalRiCost).toBe(180); // 80 + 40 + 0 + 60
        expect(comp.totalOnDemandCost).toBe(270); // 150 + 120
        expect(comp.totalSavingsAmount).toBe(90); // 270 - 180
        expect(comp.totalSavingsPercentage).toBeCloseTo(33.33, 1);
        done();
      }, 10);
    });
  });

  describe('Chart Rendering with Renewal Data', () => {
    let mockChartInstance: any;

    beforeEach(() => {
      mockChartInstance = {
        setOption: jasmine.createSpy('setOption'),
        dispose: jasmine.createSpy('dispose'),
        getOption: jasmine.createSpy('getOption').and.returnValue({
          series: []
        }),
        resize: jasmine.createSpy('resize')
      };

      (globalThis as any).echarts = {
        init: jasmine.createSpy('init').and.returnValue(mockChartInstance),
        use: jasmine.createSpy('use')
      };

      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      const element = document.getElementById('monthly-cost-chart-root');
      if (element) {
        element.remove();
      }
    });

    it('renders chart with three stacked bars (RI, Renewal, On-Demand)', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      // Wait for async chart rendering
      setTimeout(() => {
        expect(mockChartInstance.setOption).toHaveBeenCalled();
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];

        // Should have 3 series (RI, Renewal, On-Demand)
        expect(option.series.length).toBe(3);

        // Check RI series
        const riSeries = option.series[0];
        expect(riSeries.name).toBe('db.r5.large|us-east-1|mysql (RI)');
        expect(riSeries.stack).toBe('ri');
        expect(riSeries.data).toEqual([100]);

        // Check Renewal series
        const renewalSeries = option.series[1];
        expect(renewalSeries.name).toBe('db.r5.large|us-east-1|mysql (Renewal)');
        expect(renewalSeries.stack).toBe('renewal');
        expect(renewalSeries.data).toEqual([50]);

        // Check On-Demand series
        const odSeries = option.series[2];
        expect(odSeries.name).toBe('db.r5.large|us-east-1|mysql (OD)');
        expect(odSeries.stack).toBe('ondemand');
        expect(odSeries.data).toEqual([200]);

        done();
      }, 10);
    });

    it('skips renewal series when no renewal data exists', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 0,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        expect(mockChartInstance.setOption).toHaveBeenCalled();
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];

        // Should have 2 series (RI, On-Demand) - no renewal series
        expect(option.series.length).toBe(2);

        // Check series names
        expect(option.series[0].name).toBe('db.r5.large|us-east-1|mysql (RI)');
        expect(option.series[1].name).toBe('db.r5.large|us-east-1|mysql (OD)');
      }, 10);
    });

    it('uses consistent colors for groups across all bar types', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];

        // All series for the same group should have the same color
        const riColor = option.series[0].itemStyle.color;
        const renewalColor = option.series[1].itemStyle.color;
        const odColor = option.series[2].itemStyle.color;

        expect(riColor).toBe(renewalColor);
        expect(renewalColor).toBe(odColor);
      }, 10);
    });

    it('displays RI+ label for renewal bars', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];

        // Renewal series should have RI+ label
        const renewalSeries = option.series[1];
        expect(renewalSeries.label.formatter).toBe('RI+');
        expect(renewalSeries.label.offset).toEqual([0, 35]);
      }, 10);
    });
  });

  describe('Tooltip Formatting with Renewal Costs', () => {
    let mockChartInstance: any;

    beforeEach(() => {
      mockChartInstance = {
        setOption: jasmine.createSpy('setOption'),
        dispose: jasmine.createSpy('dispose'),
        getOption: jasmine.createSpy('getOption'),
        resize: jasmine.createSpy('resize')
      };

      (globalThis as any).echarts = {
        init: jasmine.createSpy('init').and.returnValue(mockChartInstance),
        use: jasmine.createSpy('use')
      };

      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      const element = document.getElementById('monthly-cost-chart-root');
      if (element) {
        element.remove();
      }
    });

    it('includes renewal costs in tooltip table', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (comp as any).chartInstance = mockChartInstance; // Set the chart instance for the formatter

      // Mock getOption to return series data
      mockChartInstance.getOption.and.returnValue({
        series: [
          { name: 'db.r5.large|us-east-1|mysql (RI)', data: [100] },
          { name: 'db.r5.large|us-east-1|mysql (Renewal)', data: [50] },
          { name: 'db.r5.large|us-east-1|mysql (OD)', data: [200] }
        ]
      });

      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];
        const tooltipFormatter = option.tooltip.formatter;

        // Mock tooltip parameters
        const mockParams = {
          name: '2025-11',
          seriesName: 'db.r5.large|us-east-1|mysql (RI)',
          value: 100
        };

        const tooltipHtml = tooltipFormatter(mockParams);

        // Should contain renewal cost column and data
        expect(tooltipHtml).toContain('Renewal');
        expect(tooltipHtml).toContain('$50.00'); // Renewal cost
        expect(tooltipHtml).toContain('$100.00'); // RI cost
        expect(tooltipHtml).toContain('$200.00'); // On-demand cost
      }, 10);
    });

    it('calculates correct total savings in tooltip including renewal costs', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 80,
            renewalCost: 40,
            onDemandCost: 150,
            savingsAmount: 30,
            savingsPercentage: 20,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (comp as any).chartInstance = mockChartInstance; // Set the chart instance for the formatter

      mockChartInstance.getOption.and.returnValue({
        series: [
          { name: 'db.r5.large|us-east-1|mysql (RI)', data: [80] },
          { name: 'db.r5.large|us-east-1|mysql (Renewal)', data: [40] },
          { name: 'db.r5.large|us-east-1|mysql (OD)', data: [150] }
        ]
      });

      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];
        const tooltipFormatter = option.tooltip.formatter;

        const mockParams = {
          name: '2025-11',
          seriesName: 'db.r5.large|us-east-1|mysql (RI)',
          value: 80
        };

        const tooltipHtml = tooltipFormatter(mockParams);

        // Total row should show combined RI + Renewal cost and correct savings percentage
        expect(tooltipHtml).toContain('$120.00'); // Total RI + Renewal cost (80 + 40)
        expect(tooltipHtml).toContain('$150.00'); // On-demand cost
        expect(tooltipHtml).toContain('20.0%'); // (150 - 120) / 150 * 100 = 20%
      }, 10);
    });

    it('handles tooltip when renewal data is zero', (): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 0,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (comp as any).chartInstance = mockChartInstance; // Set the chart instance for the formatter

      mockChartInstance.getOption.and.returnValue({
        series: [
          { name: 'db.r5.large|us-east-1|mysql (RI)', data: [100] },
          { name: 'db.r5.large|us-east-1|mysql (OD)', data: [200] }
        ]
      });

      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        const option = mockChartInstance.setOption.calls.argsFor(0)[0];
        const tooltipFormatter = option.tooltip.formatter;

        const mockParams = {
          name: '2025-11',
          seriesName: 'db.r5.large|us-east-1|mysql (RI)',
          value: 100
        };

        const tooltipHtml = tooltipFormatter(mockParams);

        // Should show $0.00 for renewal cost
        expect(tooltipHtml).toContain('$0.00'); // Renewal cost
        expect(tooltipHtml).toContain('$100.00'); // RI cost
        expect(tooltipHtml).toContain('$200.00'); // On-demand cost
        expect(tooltipHtml).toContain('50.0%'); // Savings percentage
      }, 10);
    });
  });

  describe('Component Handling of Missing Renewal Data', () => {
    let mockChartInstance: any;

    beforeEach(() => {
      mockChartInstance = {
        setOption: jasmine.createSpy('setOption'),
        dispose: jasmine.createSpy('dispose'),
        getOption: jasmine.createSpy('getOption').and.returnValue({
          series: []
        }),
        resize: jasmine.createSpy('resize')
      };

      (globalThis as any).echarts = {
        init: jasmine.createSpy('init').and.returnValue(mockChartInstance),
        use: jasmine.createSpy('use')
      };

      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      const element = document.getElementById('monthly-cost-chart-root');
      if (element) {
        element.remove();
      }
    });

    it('handles aggregates without renewalCost property gracefully', (done: DoneFn): void => {
      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);

      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            details: [] as any[]
            // No renewalCost property
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      // Wait for renderChart to complete
      setTimeout(() => {
        expect(mockChartInstance.setOption).toHaveBeenCalled();
        expect(comp.totalRiCost).toBe(100); // Only RI cost, renewal defaults to 0
        expect(comp.totalOnDemandCost).toBe(200);
        expect(comp.totalSavingsAmount).toBe(100);
        done();
      }, 10);
    });

    it('treats undefined renewalCost as zero in calculations', (done: DoneFn): void => {
      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);

      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: undefined as number | undefined,
            onDemandCost: 200,
            savingsAmount: 100,
            savingsPercentage: 50,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      // Wait for renderChart to complete
      setTimeout(() => {
        expect(mockChartInstance.setOption).toHaveBeenCalled();
        expect(comp.totalRiCost).toBe(100); // renewalCost undefined treated as 0
        expect(comp.totalSavingsAmount).toBe(100);
        done();
      }, 10);
    });

    it('handles mixed data with some months having renewal costs and others not', (done: DoneFn): void => {
      // Mock DOM element
      const mockElement = document.createElement('div');
      mockElement.id = 'monthly-cost-chart-root';
      document.body.appendChild(mockElement);

      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        },
        '2025-12': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-12',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 0,
            renewalCost: 0,
            onDemandCost: 150,
            savingsAmount: 150,
            savingsPercentage: 100,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      // Wait for renderChart to complete
      setTimeout(() => {
        expect(mockChartInstance.setOption).toHaveBeenCalled();
        expect(comp.totalRiCost).toBe(150); // 100 + 50 from first month
        expect(comp.totalOnDemandCost).toBe(350); // 200 + 150
        expect(comp.totalSavingsAmount).toBe(200); // 350 - 150
        done();
      }, 10);
    });
  });

  describe('Year-by-Year Savings Breakdown', () => {
    it('calculates year-by-year savings breakdown correctly', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        },
        '2025-12': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-12',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 80,
            renewalCost: 40,
            onDemandCost: 150,
            savingsAmount: 30,
            savingsPercentage: 20,
            details: [] as any[]
          }
        },
        '2026-01': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2026-01',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 120,
            renewalCost: 60,
            onDemandCost: 250,
            savingsAmount: 70,
            savingsPercentage: 28,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (globalThis as any).echarts = { init: () => ({ setOption: () => {} }) };
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        expect(comp.yearSavingsBreakdown).toBeDefined();
        expect(comp.yearSavingsBreakdown.length).toBe(2); // 2025 and 2026

        // Check 2025 (partial year - 2 months)
        const year2025 = comp.yearSavingsBreakdown.find(y => y.year === 2025);
        expect(year2025).toBeDefined();
        expect(year2025?.isPartial).toBe(true);
        expect(year2025?.savingsAmount).toBe(80); // 50 + 30
        expect(year2025?.onDemandCost).toBe(350); // 200 + 150
        expect(year2025?.riCost).toBe(270); // 150 + 120

        // Check 2026 (partial year - 1 month)
        const year2026 = comp.yearSavingsBreakdown.find(y => y.year === 2026);
        expect(year2026).toBeDefined();
        expect(year2026?.isPartial).toBe(true);
        expect(year2026?.savingsAmount).toBe(70);
        expect(year2026?.onDemandCost).toBe(250);
        expect(year2026?.riCost).toBe(180);

        done();
      }, 10);
    });

    it('handles single year data correctly', (done: DoneFn): void => {
      const mockAggregates = {
        '2025-11': {
          'db.r5.large|us-east-1|mysql': {
            monthKey: '2025-11',
            groupKey: 'db.r5.large|us-east-1|mysql',
            riCost: 100,
            renewalCost: 50,
            onDemandCost: 200,
            savingsAmount: 50,
            savingsPercentage: 25,
            details: [] as any[]
          }
        }
      };

      mockAggregator.aggregateMonthlyCosts = () => mockAggregates;
      const comp = new MonthlyCostChartComponent(mockDataService, mockMatcher, mockAggregator, mockCdr, mockPricingLoader);
      (globalThis as any).echarts = { init: () => ({ setOption: () => {} }) };
      comp.ngOnInit();

      const sampleImport: any = { rows: [{ startDate: '2025-11-01', instanceClass: 'db.r5.large', region: 'us-east-1', multiAZ: false, engine: 'mysql', edition: null, upfront: 'No Upfront', durationMonths: 36, count: 1 }] };
      importSubject.next(sampleImport);

      setTimeout(() => {
        expect(comp.yearSavingsBreakdown).toBeDefined();
        expect(comp.yearSavingsBreakdown.length).toBe(1); // Only 2025

        const year2025 = comp.yearSavingsBreakdown[0];
        expect(year2025.year).toBe(2025);
        expect(year2025.isPartial).toBe(true); // Only 1 month out of 12
        expect(year2025.savingsAmount).toBe(50);
        expect(year2025.onDemandCost).toBe(200);
        expect(year2025.riCost).toBe(150);

        done();
      }, 10);
    });
  });
});
