import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { Subscription } from 'rxjs';

import { MonthlyCostData } from '../../models/monthly-cost-data.model';
import { PricingDataService } from '../../services/pricing-data.service';
import { RiCostAggregationService } from '../../services/ri-cost-aggregation.service';
import { RiDataService } from '../../services/ri-data.service';
import { RiPricingMatcherService } from '../../services/ri-pricing-matcher.service';


@Component({
  selector: 'app-monthly-cost-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monthly-cost-chart.component.html',
  styleUrls: ['./monthly-cost-chart.component.scss']
})
export class MonthlyCostChartComponent implements OnInit, OnDestroy {
  data: any | null = null;
  error: string | null = null;
  missingPricing: string[] = [];
  private sub: Subscription | null = null;
  // Keep a reference to the chart instance so we can reuse or dispose it
  private chartInstance: any = null;

  // Total savings data for the widget
  totalSavingsAmount = 0;
  totalSavingsPercentage = 0;
  totalRiCost = 0;
  totalOnDemandCost = 0;

  // Year-by-year savings breakdown
  yearSavingsBreakdown: Array<{ year: number; savingsAmount: number; savingsPercentage: number; riCost: number; onDemandCost: number; isPartial: boolean }> = [];

  constructor(
    private readonly riDataService: RiDataService,
    private readonly riPricingMatcherService: RiPricingMatcherService,
    public readonly riCostAggregationService: RiCostAggregationService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly pricingDataService: PricingDataService
  ) {}

  ngOnInit(): void {
    console.log('[MonthlyCostChart] init - subscribing to currentImport$');
    this.sub = this.riDataService.riPortfolio$.subscribe((riPortfolio) => {
      console.log('[MonthlyCostChart] import emitted - rows:', riPortfolio?.rows?.length ?? 0);
      if (!riPortfolio?.rows || riPortfolio.rows.length === 0) {
        console.log('[MonthlyCostChart] no import rows - clearing chart');
        this.data = null;
        return;
      }

      console.log('[MonthlyCostChart] Processing import rows:', riPortfolio.rows.length);

      try {

        const rows = riPortfolio.rows;

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
        this.pricingDataService.loadPricingForPaths(paths).subscribe({
          next: ({ pricingRecords, missingFiles }) => {
            console.log('[MonthlyCostChart] Pricing loaded - records:', pricingRecords.length, 'missing:', missingFiles.length);
            this.missingPricing = missingFiles || [];
            this.riPricingMatcherService.loadPricingData(pricingRecords as any);
            const aggregates = this.riCostAggregationService.aggregateMonthlyCosts(rows as any, pricingRecords as any);
            // Check for all types of errors and surface them to the UI
            const allErrors = [
              ...this.riCostAggregationService.lastErrors.unmatchedPricing,
              ...this.riCostAggregationService.lastErrors.invalidPricing,
              ...this.riCostAggregationService.lastErrors.missingRates,
              ...this.riCostAggregationService.lastErrors.zeroActiveDays,
              ...this.riCostAggregationService.lastErrors.zeroCount
            ];

            if (allErrors.length > 0) {
              const errorSummary = {
                unmatchedPricing: this.riCostAggregationService.lastErrors.unmatchedPricing.length,
                invalidPricing: this.riCostAggregationService.lastErrors.invalidPricing.length,
                missingRates: this.riCostAggregationService.lastErrors.missingRates.length,
                zeroActiveDays: this.riCostAggregationService.lastErrors.zeroActiveDays.length,
                zeroCount: this.riCostAggregationService.lastErrors.zeroCount.length
              };

              const errorMessages = [];
              if (errorSummary.unmatchedPricing > 0) {
                const sample = this.riCostAggregationService.lastErrors.unmatchedPricing[0];
                errorMessages.push(`${errorSummary.unmatchedPricing} unmatched pricing record(s) (e.g., ${sample.key})`);
              }
              if (errorSummary.invalidPricing > 0) {
                const sample = this.riCostAggregationService.lastErrors.invalidPricing[0];
                errorMessages.push(`${errorSummary.invalidPricing} invalid pricing record(s) (e.g., ${sample.key})`);
              }
              if (errorSummary.missingRates > 0) {
                const sample = this.riCostAggregationService.lastErrors.missingRates[0];
                errorMessages.push(`${errorSummary.missingRates} missing rate(s) (e.g., ${sample.reason})`);
              }
              if (errorSummary.zeroActiveDays > 0) {
                const sample = this.riCostAggregationService.lastErrors.zeroActiveDays[0];
                errorMessages.push(`${errorSummary.zeroActiveDays} zero active day(s) (e.g., ${sample.reason})`);
              }
              if (errorSummary.zeroCount > 0) {
                errorMessages.push(`${errorSummary.zeroCount} zero count(s)`);
              }

              this.error = `Calculation errors found: ${errorMessages.join('; ')}`;
              console.log('[MonthlyCostChart] Setting comprehensive UI error:', this.error);
              // Immediately request change detection so the template reflects the error right away
              try {
                this.changeDetectorRef.detectChanges();
              } catch { /* ignore */ }
            } else {
              this.error = null;
            }
            // concise aggregate summary
            const monthCount = Object.keys(aggregates).length;
            let groupCount = 0;
            for (const m of Object.keys(aggregates)) groupCount = Math.max(groupCount, Object.keys(aggregates[m] || {}).length);
            console.log('[MonthlyCostChart] Aggregates summary - months:', monthCount, 'max groups/month:', groupCount);
            this.data = aggregates;
            // Trigger change detection and defer render to next tick so DOM updates are present
            this.changeDetectorRef.detectChanges();
            setTimeout(() => this.renderChart(aggregates), 0);
          },
          error: (_err: any): void => {
            console.error('[MonthlyCostChart] Error loading pricing:', _err);
            this.error = String(_err?.message ?? _err);
            this.data = null;
            this.missingPricing = paths;
          }
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
    } catch {
      // ignore
    }
  }

  private renderChart(aggregates: Record<string, Record<string, MonthlyCostData>>): void {
    console.log('[MonthlyCostChart] renderChart start');
    try {
      echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      if (!echarts) return;
      // Convert aggregates { 'YYYY-MM': { groupKey: { riCost, onDemandCost, savingsAmount, savingsPercentage } } } to ECharts series
      const months = Object.keys(aggregates).sort();
      console.log('[MonthlyCostChart] Months found:', months.length);

      // Determine group keys and sort by total cost descending
      const groupMap = new Map<string, number>();
      for (const m of months) {
        for (const g of Object.keys(aggregates[m])) {
          const cost = aggregates[m][g]?.riCost || 0;
          groupMap.set(g, (groupMap.get(g) || 0) + cost);
        }
      }
      const groups = Array.from(groupMap.entries())
        .sort((a, b) => b[1] - a[1]) // descending by total cost
        .map(([group]) => group);

      // Calculate total savings for the entire period
      const totalRiCost = months.reduce((total, month) => {
        const groupsData = aggregates[month] || {};
        return total + Object.values(groupsData).reduce((sum: number, g: MonthlyCostData) => sum + (g.riCost || 0) + (g.renewalCost || 0), 0);
      }, 0);

      const totalOnDemandCost = months.reduce((total, month) => {
        const groupsData = aggregates[month] || {};
        return total + Object.values(groupsData).reduce((sum: number, g: MonthlyCostData) => sum + (g.onDemandCost || 0), 0);
      }, 0);

      const totalSavingsAmount = totalOnDemandCost - totalRiCost;
      const totalSavingsPercentage = totalOnDemandCost > 0 ? (totalSavingsAmount / totalOnDemandCost) * 100 : 0;

      // Calculate year-by-year savings breakdown
      const yearData: Record<number, { riCost: number; onDemandCost: number; months: string[] }> = {};
      for (const month of months) {
        const year = Number.parseInt(month.split('-')[0]);
        if (!yearData[year]) {
          yearData[year] = { riCost: 0, onDemandCost: 0, months: [] };
        }
        yearData[year].months.push(month);

        const groupsData = aggregates[month] || {};
        yearData[year].riCost += Object.values(groupsData).reduce((sum: number, g: MonthlyCostData) => sum + (g.riCost || 0) + (g.renewalCost || 0), 0);
        yearData[year].onDemandCost += Object.values(groupsData).reduce((sum: number, g: MonthlyCostData) => sum + (g.onDemandCost || 0), 0);
      }

      // Sort years and determine if each year is partial (doesn't have 12 months)
      const sortedYears = Object.keys(yearData).map(Number).sort((a, b) => a - b);
      this.yearSavingsBreakdown = sortedYears.map(year => {
        const data = yearData[year];
        const savingsAmount = data.onDemandCost - data.riCost;
        const savingsPercentage = data.onDemandCost > 0 ? (savingsAmount / data.onDemandCost) * 100 : 0;
        const isPartial = data.months.length < 12;

        return {
          year,
          savingsAmount,
          savingsPercentage,
          riCost: data.riCost,
          onDemandCost: data.onDemandCost,
          isPartial
        };
      });

      // Update component properties for the widget
      this.totalSavingsAmount = totalSavingsAmount;
      this.totalSavingsPercentage = totalSavingsPercentage;
      this.totalRiCost = totalRiCost;
      this.totalOnDemandCost = totalOnDemandCost;

      // Create color mapping for groups
      const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
      const groupColors: Record<string, string> = {};
      for (const [index, g] of groups.entries()) {
        groupColors[g] = colors[index % colors.length];
      }

      const series = [
        // RI bars - all groups stack together
        ...groups.map((g, index) => {
          const riData = months.map((m) => (aggregates[m][g]?.riCost ?? 0));
          return {
            name: `${g} (RI)`,
            type: 'bar',
            stack: 'ri', // All RI bars stack together
            itemStyle: { color: groupColors[g] },
            emphasis: {
              focus: 'series',
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              },
              label: {
                show: true,
                position: 'top',
                formatter: (params: any): string => `$${params.value.toFixed(2)}`,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#000'
              }
            },
            label: index === 0 ? {
              show: true,
              position: 'bottom',
              offset: [0, 20], // Offset down to position below month labels
              formatter: 'RI',
              fontSize: 11,
              fontWeight: 'bold',
              color: '#000'
            } : undefined,
            data: riData
          };
        }),
        // Renewal bars - all groups stack together
        ...groups.map((g, index) => {
          const renewalData = months.map((m) => (aggregates[m][g]?.renewalCost ?? 0));
          const hasRenewalData = renewalData.some(value => value > 0);
          if (!hasRenewalData) return null; // Skip if no renewal data for this group

          return {
            name: `${g} (Renewal)`,
            type: 'bar',
            stack: 'renewal', // All renewal bars stack together
            itemStyle: { color: groupColors[g] }, // Use same color as the group
            emphasis: {
              focus: 'series',
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              },
              label: {
                show: true,
                position: 'top',
                formatter: (params: any): string => `$${params.value.toFixed(2)}`,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#000'
              }
            },
            label: index === 0 ? {
              show: true,
              position: 'bottom',
              offset: [0, 35], // Offset further down for renewal label
              formatter: 'RI+',
              fontSize: 11,
              fontWeight: 'bold',
              color: '#000'
            } : undefined,
            data: renewalData
          };
        }).filter(s => s !== null),
        // On-Demand bars - all groups stack together
        ...groups.map((g, index) => {
          const data = months.map((m) => (aggregates[m][g]?.onDemandCost ?? 0));
          return {
            name: `${g} (OD)`,
            type: 'bar',
            stack: 'ondemand', // All on-demand bars stack together
            itemStyle: { color: groupColors[g] },
            emphasis: {
              focus: 'series',
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              },
              label: {
                show: true,
                position: 'top',
                formatter: (params: any): string => `$${params.value.toFixed(2)}`,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#000'
              }
            },
            label: index === 0 ? {
              show: true,
              position: 'bottom',
              offset: [0, 50], // Offset even further down for OD label
              formatter: 'OD',
              fontSize: 11,
              fontWeight: 'bold',
              color: '#000'
            } : undefined,
            data
          };
        })
      ];

      const option = {
        tooltip: {
          trigger: 'item',
          axisPointer: { type: 'shadow' },
          confine: false,
          extraCssText: 'max-height: calc(100vh - 20px) !important; overflow-y: auto !important; overflow-x: hidden !important; box-sizing: border-box !important;',
          position: function (point: number[], params: any, dom: HTMLElement, rect: any, size: { contentSize: number[], viewSize: number[] }): number[] | string {
            // point is [x, y] mouse position RELATIVE TO CHART CONTAINER
            // size.contentSize is [width, height] of tooltip
            // rect is the chart container's bounding rectangle

            const [mouseX, mouseY] = point;
            const [tooltipWidth, tooltipHeight] = size.contentSize;
            const viewWidth = window.innerWidth;
            const viewHeight = window.innerHeight;

            // Get chart container position in viewport
            const chartRect = rect;
            const chartOffsetX = chartRect.x || 0;
            const chartOffsetY = chartRect.y || 0;

            // Convert mouse position to viewport coordinates
            const absMouseX = mouseX + chartOffsetX;
            const absMouseY = mouseY + chartOffsetY;

            let absY: number;

            // Calculate possible positions IN VIEWPORT COORDINATES
            const absAboveY = absMouseY - tooltipHeight - 10; // Above mouse
            const absBelowY = absMouseY + 10; // Below mouse

            // Check if positions fit in viewport
            const aboveFits = absAboveY >= 0;
            const belowFits = absBelowY + tooltipHeight <= viewHeight;

            if (aboveFits) {
              // Prefer above if it fits
              absY = absAboveY;
            } else if (belowFits) {
              // Use below only if above doesn't fit but below does
              absY = absBelowY;
            } else {
              // Neither above nor below fits - pin to top with small margin for better UX
              absY = 10;
            }

            // Handle horizontal positioning IN VIEWPORT COORDINATES
            let absX = absMouseX + 10; // Default: slightly to the right of mouse
            if (absX + tooltipWidth > viewWidth - 10) {
              absX = absMouseX - tooltipWidth - 10; // Move to left of mouse
              if (absX < 10) {
                absX = 10; // Ensure minimum margin
              }
            }

            // Apply bounds checking to x
            absX = Math.max(10, Math.min(absX, viewWidth - tooltipWidth - 10));

            // Convert back to chart-relative coordinates
            const chartRelativeX = absX - chartOffsetX;
            const chartRelativeY = absY - chartOffsetY;

            return [chartRelativeX, chartRelativeY];
          },
          formatter: (params: any): string => {
            // For item trigger, params is a single series data point
            const month = params.name;
            const hoveredSeriesName = params.seriesName;
            const hoveredGroup = hoveredSeriesName.replace(/ \((RI|Renewal|OD)\)$/, '');

            // We need all series data for this month to build the full table
            // Get the chart instance and extract data from all series
            const chart = this.chartInstance;
            if (!chart) return '';

            const option = chart.getOption();
            const allSeries = option.series as any[];
            const monthIndex = months.indexOf(month);
            if (monthIndex === -1) return '';

            // Build group data from all series for this month
            const groupData: Record<string, { ri: number, renewal: number, onDemand: number }> = {};
            for (const series of allSeries) {
              const seriesName = series.name;
              const groupName = seriesName.replace(/ \((RI|Renewal|OD)\)$/, '');
              const isRi = seriesName.endsWith('(RI)');
              const isRenewal = seriesName.endsWith('(Renewal)');
              const isOnDemand = seriesName.endsWith('(OD)');
              const value = (series.data as number[])[monthIndex] ?? 0;

              if (isRi) {
                groupData[groupName] = groupData[groupName] || { ri: 0, renewal: 0, onDemand: 0 };
                groupData[groupName].ri = value;
              } else if (isRenewal) {
                groupData[groupName] = groupData[groupName] || { ri: 0, renewal: 0, onDemand: 0 };
                groupData[groupName].renewal = value;
              } else if (isOnDemand) {
                groupData[groupName] = groupData[groupName] || { ri: 0, renewal: 0, onDemand: 0 };
                groupData[groupName].onDemand = value;
              }
            }

            // Build table only for groups that have non-zero costs in this month
            let table = `<strong>${month}</strong><br/>` +
              '<table style="border-collapse: collapse; width: 100%;">' +
              '<tr>' +
              '<th style="border: 1px solid #ddd; padding: 4px;">Group</th>' +
              '<th style="border: 1px solid #ddd; padding: 4px;">RI Cost</th>' +
              '<th style="border: 1px solid #ddd; padding: 4px;">Renewal</th>' +
              '<th style="border: 1px solid #ddd; padding: 4px;">On-Demand</th>' +
              '<th style="border: 1px solid #ddd; padding: 4px;">Savings %</th>' +
              '</tr>';
            let totalRiCost = 0;
            let totalRenewalCost = 0;
            let totalOnDemandCost = 0;

            // Filter groups to only include those with non-zero costs for this month
            const activeGroups = groups.filter(g => {
              const data = groupData[g] || { ri: 0, renewal: 0, onDemand: 0 };
              return data.ri > 0 || data.renewal > 0 || data.onDemand > 0;
            });

            for (const g of activeGroups) {
              const data = groupData[g] || { ri: 0, renewal: 0, onDemand: 0 };
              const totalCost = data.ri + data.renewal;
              const savingsPct = data.onDemand > 0 ? ((data.onDemand - totalCost) / data.onDemand * 100) : 0;
              const colorBox = `<div style="display: inline-block; width: 12px; height: 12px; background-color: ${groupColors[g]}; margin-right: 4px; border: 1px solid #666;"></div>`;
              const isHovered = g === hoveredGroup;
              const rowStyle = isHovered ? 'background-color: #f0f8ff; font-weight: bold;' : '';
              table += `<tr style="${rowStyle}">` +
                `<td style="border: 1px solid #ddd; padding: 4px;">${colorBox}${g}</td>` +
                `<td style="border: 1px solid #ddd; padding: 4px;">$${data.ri.toFixed(2)}</td>` +
                `<td style="border: 1px solid #ddd; padding: 4px;">$${data.renewal.toFixed(2)}</td>` +
                `<td style="border: 1px solid #ddd; padding: 4px;">$${data.onDemand.toFixed(2)}</td>` +
                `<td style="border: 1px solid #ddd; padding: 4px;">${savingsPct.toFixed(1)}%</td>` +
                '</tr>';
              totalRiCost += data.ri;
              totalRenewalCost += data.renewal;
              totalOnDemandCost += data.onDemand;
            }
            // Add summary row
            const totalCombinedCost = totalRiCost + totalRenewalCost;
            const totalSavingsPct = totalOnDemandCost > 0 ? ((totalOnDemandCost - totalCombinedCost) / totalOnDemandCost * 100) : 0;
            table += '<tr style="border-top: 2px solid #000; font-weight: bold;">' +
              '<td style="border: 1px solid #ddd; padding: 4px;">TOTAL</td>' +
              `<td style="border: 1px solid #ddd; padding: 4px;">$${totalRiCost.toFixed(2)}</td>` +
              `<td style="border: 1px solid #ddd; padding: 4px;">$${totalRenewalCost.toFixed(2)}</td>` +
              `<td style="border: 1px solid #ddd; padding: 4px;">$${totalOnDemandCost.toFixed(2)}</td>` +
              `<td style="border: 1px solid #ddd; padding: 4px;">${totalSavingsPct.toFixed(2)}%</td>` +
              '</tr>';
            table += '</table>';
            return table;
          }
        },
        grid: {
          top: 20,
          left: '3%',
          right: '4%',
          bottom: '70%', // Increased further to make room for RI/Renewal/OD labels
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: months,
          axisLabel: {
            interval: 0,
            fontSize: 12,
            offset: -20 // Move month labels up to make room for RI/OD labels below
          }
        },
        yAxis: { type: 'value' },
        series
      };

      // find or create container
      const container = document.getElementById('monthly-cost-chart-root');
      if (!container) {
        console.error('[MonthlyCostChart] Chart container #monthly-cost-chart-root not found in DOM');
        return; // template should provide container
      }

      // Always dispose of the old chart and create a new one to ensure proper sizing
      if (this.chartInstance && typeof this.chartInstance.dispose === 'function') {
        console.log('[MonthlyCostChart] Disposing old chart instance');
        this.chartInstance.dispose();
      }

      console.log('[MonthlyCostChart] Creating new echarts instance');
      const chart = echarts.init(container as any);
      this.chartInstance = chart;
      chart.setOption(option, true);
      console.log('[MonthlyCostChart] Chart option set');

      // Force resize to ensure chart renders correctly
      setTimeout(() => {
        try {
          chart.resize();
          console.log('[MonthlyCostChart] Chart resized');
        } catch {
          console.error('[MonthlyCostChart] Resize error');
        }
      }, 100);
    } catch (err) {
      // swallow render errors but set error state

      console.error('[MonthlyCostChart] Error rendering chart:', err);
      this.error = String(err?.message ?? err);
    }
  }
}
