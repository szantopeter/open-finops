import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RiDataService } from '../../services/ri-data.service';
import { RiPricingMatcherService } from '../../services/ri-pricing-matcher.service';
import { RiCostAggregationService } from '../../services/ri-cost-aggregation.service';
import { PricingDataService } from '../../services/pricing-data.service';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

@Component({
  selector: 'app-monthly-cost-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monthly-cost-chart.component.html',
  styleUrls: ['./monthly-cost-chart.component.scss'],
})
export class MonthlyCostChartComponent implements OnInit, OnDestroy {
  data: any | null = null;
  error: string | null = null;
  missingPricing: string[] = [];
  private sub: Subscription | null = null;
  // Keep a reference to the chart instance so we can reuse or dispose it
  private chartInstance: any = null;

  constructor(
    private readonly dataService: RiDataService,
    private readonly matcher: RiPricingMatcherService,
    public readonly aggregator: RiCostAggregationService,
    private readonly cdr: ChangeDetectorRef,
    private readonly pricingLoader: PricingDataService
  ) {}

  ngOnInit(): void {
  console.log('[MonthlyCostChart] init - subscribing to currentImport$');
    this.sub = this.dataService.currentImport$.subscribe((imp) => {
      console.log('[MonthlyCostChart] import emitted - rows:', imp?.rows?.length ?? 0);
      if (!imp || !imp.rows || imp.rows.length === 0) {
        console.log('[MonthlyCostChart] no import rows - clearing chart');
        this.data = null;
        return;
      }

      console.log('[MonthlyCostChart] Processing import rows:', imp.rows.length);

      try {
        // Import service already normalized all fields - just pass through with upfront normalization
        const normalizeUpfront = (u: any) => {
          const raw = (u ?? '').toString().trim().toLowerCase();
          if (!raw) return 'No Upfront';
          if (raw.includes('no') && raw.includes('up')) return 'No Upfront';
          if (raw.includes('partial') || raw.includes('partial up')) return 'Partial Upfront';
          if (raw.includes('all') || raw.includes('all up') || raw.includes('allupfront') || raw.includes('all-upfront')) return 'All Upfront';
          // common alternate spellings
          if (raw.includes('no-upfront') || raw.includes('noupfront')) return 'No Upfront';
          if (raw.includes('partial-upfront')) return 'Partial Upfront';
          if (raw.includes('all-upfront')) return 'All Upfront';
          // fallback: title-case the raw value replacing hyphens/underscores with spaces
          return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        };

        const rows = imp.rows.map((r: any) => ({
          instanceClass: r.instanceClass,
          region: r.region,
          multiAz: r.multiAz ?? r.multiAZ ?? false,
          engine: r.engine,  // already normalized by import service
          edition: r.edition,  // already normalized by import service
          upfrontPayment: normalizeUpfront(r.upfront ?? r.upfrontPayment),
          durationMonths: r.durationMonths ?? r.duration ?? 36,
          startDate: r.startDate,
          endDate: r.endDate,
          count: r.count || 1,
        }));

        // Determine the pricing file paths needed for the import rows. The files are organized
        // under /assets/pricing/{region}/{instance}/{region}_{instance}_{deployment}-{engine}.json
        // For pricing paths, combine engine+edition (import service keeps them separate for matching)
        const candidatePaths = new Set<string>();
        for (const r of rows) {
          const region = r.region;
          const instance = r.instanceClass;
          const deployment = r.multiAz ? 'multi-az' : 'single-az';
          
          // Build engineKey for file path by combining engine + edition if present
          // e.g., engine='oracle', edition='se2-byol' → engineKey='oracle-se2-byol'
          let engineKey = r.engine || 'mysql';
          if (r.edition) {
            engineKey = `${engineKey}-${r.edition}`;
          }
          
          // Build the path matching generator's convention
          const p = `${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}.json`;
          candidatePaths.add(p);
        }

        const paths = Array.from(candidatePaths);
        console.log('[MonthlyCostChart] Requesting pricing files:', paths.length, 'files', paths.length ? 'sample:' + paths.slice(0, 5).join(',') : '');

        // Load the specific pricing files we constructed; PricingDataService will fetch them.
  this.pricingLoader.loadPricingForPaths(paths).subscribe({
          next: ({ records, missing }) => {
            console.log('[MonthlyCostChart] Pricing loaded - records:', records.length, 'missing:', missing.length);
            this.missingPricing = missing || [];
            this.matcher.loadPricingData(records as any);
                const aggregates = this.aggregator.aggregateMonthlyCosts(rows as any, records as any);
                // If aggregator reports unmatched rows, surface a friendly error to the UI
                if (this.aggregator.lastUnmatchedCount && this.aggregator.lastUnmatchedCount > 0) {
                  const sample = this.aggregator.lastUnmatchedSamples && this.aggregator.lastUnmatchedSamples.length > 0
                    ? this.aggregator.lastUnmatchedSamples[0]
                    : null;
                  const sampleText = sample ? `${sample.key}` : 'see console for examples';
                  this.error = `Could not match ${this.aggregator.lastUnmatchedCount} import row(s) to pricing records. First unmatched key: ${sampleText}`;
                  console.log('[MonthlyCostChart] Setting UI error:', this.error);
                  // Immediately request change detection so the template reflects the error right away
                  try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
                } else {
                  this.error = null;
                }
                // concise aggregate summary
            const monthCount = Object.keys(aggregates).length;
            let groupCount = 0;
            for (const m of Object.keys(aggregates)) groupCount = Math.max(groupCount, Object.keys(aggregates[m] || {}).length);
            console.log('[MonthlyCostChart] Aggregates summary - months:', monthCount, 'max groups/month:', groupCount);
            this.data = aggregates;
            // keep any error message set earlier by the aggregator diagnostics; only clear if there were no unmatched rows
            if (!this.aggregator.lastUnmatchedCount || this.aggregator.lastUnmatchedCount === 0) {
              this.error = null;
            }
            // Trigger change detection and defer render to next tick so DOM updates are present
            this.cdr.detectChanges();
            setTimeout(() => this.renderChart(aggregates), 0);
          },
          error: (err) => {
            console.error('[MonthlyCostChart] Error loading pricing:', err);
            this.error = String(err?.message ?? err);
            this.data = null;
            this.missingPricing = paths;
          },
  });
      } catch (err: any) {
        console.error('[MonthlyCostChart] Exception during processing:', err);
        this.error = err?.message ?? String(err);
        this.data = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    try {
      if (this.chartInstance && typeof this.chartInstance.dispose === 'function') {
        console.log('[MonthlyCostChart] Disposing echarts instance');
        this.chartInstance.dispose();
      }
    } catch (e) {
      // ignore
    }
  }

  private renderChart(aggregates: any) {
    console.log('[MonthlyCostChart] renderChart start');
    try {
      echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      if (!echarts) return;
      // Convert aggregates { 'YYYY-MM': { groupKey: { totalCost } } } to ECharts series
  const months = Object.keys(aggregates).sort();
  console.log('[MonthlyCostChart] Months found:', months.length);
      // determine group keys
      const groupSet = new Set<string>();
      for (const m of months) {
        for (const g of Object.keys(aggregates[m])) groupSet.add(g);
      }
  const groups = Array.from(groupSet);
  console.log('[MonthlyCostChart] Groups found:', groups.length);
  const series = groups.map((g) => ({ name: g, type: 'bar', stack: 'total', data: months.map((m) => (aggregates[m][g]?.totalCost ?? 0)) }));

      // Calculate dynamic top spacing based on number of legend items
      // Legend items with long names need more space - estimate 4-5 items per row
      const itemsPerRow = 4; // More conservative for long legend names
      const legendRows = Math.ceil(groups.length / itemsPerRow);
      const legendHeight = legendRows * 40; // 40px per row to accommodate wrapping
      const topSpacing = legendHeight + 50; // Extra padding below legend

      console.log('[MonthlyCostChart] Legend calculation - items:', groups.length, 'rows:', legendRows, 'topSpacing:', topSpacing);

      const option = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { 
          data: groups,
          top: 5,
          left: 'center',
          orient: 'horizontal',
          itemGap: 10,
          itemWidth: 25,
          itemHeight: 14,
          textStyle: { fontSize: 11 },
          padding: [5, 5, 10, 5]
        },
        grid: {
          top: topSpacing,
          left: '3%',
          right: '4%',
          bottom: '10%',
          containLabel: true
        },
        xAxis: { type: 'category', data: months },
        yAxis: { type: 'value' },
        series,
      };

      // find or create container
      const container = document.getElementById('monthly-cost-chart-root');
      if (!container) {
        console.error('[MonthlyCostChart] Chart container #monthly-cost-chart-root not found in DOM');
        return; // template should provide container
      }

      // Try to reuse an existing instance attached to the DOM
      let chart: any = null;
      try {
        chart = (echarts as any).getInstanceByDom
          ? (echarts as any).getInstanceByDom(container)
          : null;
      } catch (e) {
        chart = null;
      }

      if (!chart) {
        // No existing instance, create a new one
        console.log('[MonthlyCostChart] Creating new echarts instance');
        chart = echarts.init(container as any);
      } else {
        console.log('[MonthlyCostChart] Reusing existing echarts instance');
      }

      // Save reference for later disposal
      this.chartInstance = chart;
      chart.setOption(option, true);
      console.log('[MonthlyCostChart] Chart option set');
      
      // Force resize to ensure chart renders correctly
      setTimeout(() => {
        try {
          chart.resize();
          console.log('[MonthlyCostChart] Chart resized');
        } catch (e) {
          console.error('[MonthlyCostChart] Resize error:', e);
        }
      }, 100);
    } catch (err) {
      // swallow render errors but set error state
      // eslint-disable-next-line no-console
      console.error('[MonthlyCostChart] Error rendering chart:', err);
      this.error = String(err?.message ?? err);
    }
  }
}
