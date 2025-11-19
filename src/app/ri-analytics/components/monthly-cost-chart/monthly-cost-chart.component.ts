import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { Subscription } from 'rxjs';

import { AggregationRequest } from '../../models/aggregation-request.model';
import { MonthlyCostData } from '../../models/monthly-cost-data.model';
import { MonthlyCostChartService, ChartData } from '../../services/monthly-cost-chart.service';
import { RiCostAggregationService } from '../../services/ri-cost-aggregation.service';


@Component({
  selector: 'app-monthly-cost-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-cost-chart.component.html',
  styleUrls: ['./monthly-cost-chart.component.scss']
})
export class MonthlyCostChartComponent implements OnInit, OnDestroy {
  data: any | null = null;
  modifiedData: any | null = null;
  error: string | null = null;
  missingPricing: string[] = [];
  private sub: Subscription | null = null;
  private modifiedSub: Subscription | null = null;
  // Keep a reference to the chart instance so we can reuse or dispose it
  private chartInstance: any = null;
  private modifiedChartInstance: any = null;

  // Grouping mode selection
  groupingMode: 'ri-type' | 'cost-type' = 'ri-type';

  // Total savings data for the widget
  totalSavingsAmount = 0;
  totalSavingsPercentage = 0;
  totalRiCost = 0;
  totalOnDemandCost = 0;

  // Year-by-year savings breakdown
  yearSavingsBreakdown: Array<{ year: number; savingsAmount: number; savingsPercentage: number; riCost: number; onDemandCost: number; isPartial: boolean }> = [];

  // Modified chart savings data
  modifiedTotalSavingsAmount = 0;
  modifiedTotalSavingsPercentage = 0;
  modifiedTotalRiCost = 0;
  modifiedTotalOnDemandCost = 0;
  modifiedYearSavingsBreakdown: Array<{ year: number; savingsAmount: number; savingsPercentage: number; riCost: number; onDemandCost: number; isPartial: boolean }> = [];

  // Summary scenarios for first full year
  summaryScenarios: Array<{scenario: string, upfrontPayment: string, durationMonths: number, firstFullYear: number, firstFullYearSavings: number, firstFullYearSavingsPercentage: number, firstFullYearRiCost: number, firstFullYearOnDemandCost: number, maxMonthlyRiSpending: number}> = [];

  constructor(
    private readonly monthlyCostChartService: MonthlyCostChartService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    public readonly riCostAggregationService: RiCostAggregationService
  ) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  onGroupingModeChange(): void {
    this.loadChartData();
  }

  private loadChartData(): void {
    // Unsubscribe from previous subscriptions
    this.sub?.unsubscribe();
    this.modifiedSub?.unsubscribe();

    this.sub = this.monthlyCostChartService.requestAggregation({ groupingMode: this.groupingMode }).subscribe((chartData: ChartData) => {
      this.data = chartData.aggregates;
      this.error = chartData.error;
      this.missingPricing = chartData.missingPricing;
      this.totalSavingsAmount = chartData.totalSavingsAmount;
      this.totalSavingsPercentage = chartData.totalSavingsPercentage;
      this.totalRiCost = chartData.totalRiCost;
      this.totalOnDemandCost = chartData.totalOnDemandCost;
      this.yearSavingsBreakdown = chartData.yearSavingsBreakdown;
      this.summaryScenarios = chartData.summaryScenarios;

      // Trigger change detection
      this.changeDetectorRef.detectChanges();

      if (this.data) {
        setTimeout(() => this.renderNormalChart(this.data), 0);
      }
    });

    this.modifiedSub = this.monthlyCostChartService.requestAggregation({
      groupingMode: this.groupingMode,
      renewalOptions: { upfrontPayment: 'All Upfront', durationMonths: 36 }
    }).subscribe((chartData: ChartData) => {
      this.modifiedData = chartData.aggregates;

      // Capture modified chart savings data
      this.modifiedTotalSavingsAmount = chartData.totalSavingsAmount;
      this.modifiedTotalSavingsPercentage = chartData.totalSavingsPercentage;
      this.modifiedTotalRiCost = chartData.totalRiCost;
      this.modifiedTotalOnDemandCost = chartData.totalOnDemandCost;
      this.modifiedYearSavingsBreakdown = chartData.yearSavingsBreakdown;

      // Trigger change detection
      this.changeDetectorRef.detectChanges();

      if (this.modifiedData) {
        setTimeout(() => this.renderModifiedChart(this.modifiedData), 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.modifiedSub?.unsubscribe();
    try {
      if (this.chartInstance && typeof this.chartInstance.dispose === 'function') {
        this.chartInstance.dispose();
      }
      if (this.modifiedChartInstance && typeof this.modifiedChartInstance.dispose === 'function') {
        this.modifiedChartInstance.dispose();
      }
    } catch {
      // ignore
    }
  }

  private renderNormalChart(aggregates: Record<string, Record<string, MonthlyCostData>>): void {
    try {
      echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      if (!echarts) return;
      // Convert aggregates { 'YYYY-MM': { groupKey: { riCost, onDemandCost, savingsAmount, savingsPercentage } } } to ECharts series
      const months = Object.keys(aggregates).sort();

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
            // Center the tooltip in the window, regardless of mouse position
            const [tooltipWidth, tooltipHeight] = size.contentSize;
            const centerX = window.innerWidth / 2 - rect.x - tooltipWidth / 2;
            const centerY = window.innerHeight / 2 - rect.y - tooltipHeight / 2;
            return [centerX, centerY];
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
          bottom: '30%', // Further reduced for tighter spacing
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
        this.chartInstance.dispose();
      }

      const chart = echarts.init(container as any);
      this.chartInstance = chart;
      chart.setOption(option, true);

      // Force resize to ensure chart renders correctly
      setTimeout(() => {
        try {
          chart.resize();
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

  private renderModifiedChart(aggregates: Record<string, Record<string, MonthlyCostData>>): void {
    try {
      echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      if (!echarts) return;
      // Convert aggregates { 'YYYY-MM': { groupKey: { riCost, onDemandCost, savingsAmount, savingsPercentage } } } to ECharts series
      const months = Object.keys(aggregates).sort();

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
            // Center the tooltip in the window, regardless of mouse position
            const [tooltipWidth, tooltipHeight] = size.contentSize;
            const centerX = window.innerWidth / 2 - rect.x - tooltipWidth / 2;
            const centerY = window.innerHeight / 2 - rect.y - tooltipHeight / 2;
            return [centerX, centerY];
          },
          formatter: (params: any): string => {
            // For item trigger, params is a single series data point
            const month = params.name;
            const hoveredSeriesName = params.seriesName;
            const hoveredGroup = hoveredSeriesName.replace(/ \((RI|Renewal|OD)\)$/, '');

            // We need all series data for this month to build the full table
            // Get the chart instance and extract data from all series
            const chart = this.modifiedChartInstance;
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
          bottom: '30%', // Further reduced for tighter spacing
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
      const container = document.getElementById('monthly-cost-chart-renewal-root');
      if (!container) {
        console.error('[MonthlyCostChart] Chart container #monthly-cost-chart-renewal-root not found in DOM');
        return; // template should provide container
      }

      // Always dispose of the old chart and create a new one to ensure proper sizing
      if (this.modifiedChartInstance && typeof this.modifiedChartInstance.dispose === 'function') {
        this.modifiedChartInstance.dispose();
      }

      const chart = echarts.init(container as any);
      this.modifiedChartInstance = chart;
      chart.setOption(option, true);

      // Force resize to ensure chart renders correctly
      setTimeout(() => {
        try {
          chart.resize();
        } catch {
          console.error('[MonthlyCostChart] Modified resize error');
        }
      }, 100);
    } catch (err) {
      // swallow render errors but set error state

      console.error('[MonthlyCostChart] Error rendering modified chart:', err);
      this.error = String(err?.message ?? err);
    }
  }
}
