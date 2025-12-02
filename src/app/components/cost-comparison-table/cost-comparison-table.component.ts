import { CommonModule } from '@angular/common';
import type { OnChanges, SimpleChanges } from '@angular/core';
import { Component, Input, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { CostComparison, CostTimeseriesByScenario, CostComparisonByScenario } from '../../cost-comparision/cost-comparison-calculator';
import { CostComparisonCalculator } from '../../cost-comparision/cost-comparison-calculator';
import { CostTimeseriesCalculator } from '../../cost-timeseries/cost-timeseries-calculator';
import { RiRenewalProjection } from '../../ri-renewal-projection/ri-renewal-projection';
import { MonthlyBreakdownTableComponent } from '../monthly-breakdown-table/monthly-breakdown-table.component';
import { ToggleDetailComponent } from '../toggle/toggle-detail.component';
import type { SavingsKey } from '../ri-portfolio-upload/models/pricing.model';
import type { RiPortfolio } from '../ri-portfolio-upload/models/ri-portfolio.model';
import { QuestionTooltipComponent } from '../question-tooltip/question-tooltip.component';

@Component({
  selector: 'app-cost-comparison-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MonthlyBreakdownTableComponent, QuestionTooltipComponent, ToggleDetailComponent],
  templateUrl: './cost-comparison-table.component.html',
  styleUrl: './cost-comparison-table.component.scss'
})
export class CostComparisonTableComponent implements OnChanges {
  @Input() riPortfolio!: RiPortfolio;

  // Help HTML moved to component template; tooltip receives the HTML via a hidden div.

  costComparisons: CostComparisonByScenario = {} as CostComparisonByScenario;
  costTimeseriesByScenario: CostTimeseriesByScenario = {} as CostTimeseriesByScenario;
  // New: separate reference comparisons (onDemand + current) and savings comparisons
  referenceComparisons: CostComparison[] = [];
  savingsComparisons: CostComparison[] = [];
  expandedRow: string | null = null;
  // When false the table shows Overview (minimal columns). When true it shows Full details.
  showFullDetails = false;
  @ViewChild('monthlyBreakdown', { read: ElementRef }) monthlyBreakdownEl?: ElementRef<HTMLElement>;
  scenarios: string[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];
  scenarioNames: string[] = ['On Demand', '1yr No Upfront', '1yr Partial Upfront', '1yr All Upfront', '3yr Partial Upfront', '3yr All Upfront'];

  get currentComparison(): CostComparison | undefined {
    if (!this.expandedRow) return undefined;
    const fromRef = this.referenceComparisons.find(c => c.scenario === this.expandedRow);
    if (fromRef) return fromRef;
    const fromSavings = this.savingsComparisons.find(c => c.scenario === this.expandedRow);
    if (fromSavings) return fromSavings;
    return this.costComparisons[this.expandedRow as keyof CostComparisonByScenario];
  }

  get costComparisonsArray(): CostComparison[] {
    return Object.values(this.costComparisons);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['riPortfolio'] && this.riPortfolio) {
      const costTimeseriesByScenario: CostTimeseriesByScenario = {} as CostTimeseriesByScenario;

      // On-demand 
      const projected = RiRenewalProjection.projectRiRenewal(this.riPortfolio, '1yr_No Upfront');
      const projectedOnly: RiPortfolio = {
            ...this.riPortfolio,
            rows: projected.rows.filter(row => row.riRow.type === 'projected')
          };      
      const onDemandTimeseries = CostTimeseriesCalculator.calculateCostTimeSeries(projectedOnly, true);
      const mergedOnDemand = CostComparisonCalculator.mergeRiRows(onDemandTimeseries);
      costTimeseriesByScenario.onDemand = mergedOnDemand;

      // Current projection
      const projectedCurrent = RiRenewalProjection.projectRiRenewal(this.riPortfolio);
      const projectedOnlyCurrent: RiPortfolio = {
        ...this.riPortfolio,
        rows: projectedCurrent.rows.filter(row => row.riRow.type === 'projected')
      };
      const currentTimeseries = CostTimeseriesCalculator.calculateCostTimeSeries(projectedOnlyCurrent, false);
      const mergedCurrent = CostComparisonCalculator.mergeRiRows(currentTimeseries);
      costTimeseriesByScenario.current = mergedCurrent;

      // Savings types
      const savingsKeys: SavingsKey[] = ['1yr_No Upfront', '1yr_Partial Upfront', '1yr_All Upfront', '3yr_Partial Upfront', '3yr_All Upfront'];
      const scenarioKeys: (keyof CostTimeseriesByScenario)[] = ['noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];
      for (let i = 0; i < savingsKeys.length; i++) {
        const projected1 = RiRenewalProjection.projectRiRenewal(this.riPortfolio, savingsKeys[i]);
        const projectedOnly1: RiPortfolio = {
              ...this.riPortfolio,
              rows: projected1.rows.filter(row => row.riRow.type === 'projected')
            };
        const timeseries1 = CostTimeseriesCalculator.calculateCostTimeSeries(projectedOnly1, false);
        const mergedTimeseries1 = CostComparisonCalculator.mergeRiRows(timeseries1);
        costTimeseriesByScenario[scenarioKeys[i]] = mergedTimeseries1;
      }

      // Build comparisons using onDemand as baseline
      this.costComparisons = CostComparisonCalculator.calculateAnnualisedCostComparison(costTimeseriesByScenario);
      this.costTimeseriesByScenario = costTimeseriesByScenario;

      // The calculator returns all required annualised totals and savings.
      // Use its output directly for display.
      const onDemandComparison = this.costComparisons.onDemand;
      const currentComparison = this.costComparisons.current || ({} as any);

      // Ensure onDemand has zero savings vs itself
      if (onDemandComparison) {
        onDemandComparison.savingsValueOnDemand = 0;
        onDemandComparison.savingsPercentOnDemand = 0;
        if (currentComparison && typeof currentComparison.totalCost === 'number') {
          onDemandComparison.savingsValueCurrent = (currentComparison.totalCost || 0) - onDemandComparison.totalCost;
          onDemandComparison.savingsPercentCurrent = onDemandComparison.totalCost > 0 ? (onDemandComparison.savingsValueCurrent! / onDemandComparison.totalCost) * 100 : undefined;
        }
      }

      if (currentComparison) {
        currentComparison.savingsValueCurrent = 0;
        currentComparison.savingsPercentCurrent = 0;
      }

      this.referenceComparisons = [onDemandComparison, currentComparison].filter(Boolean) as CostComparison[];

      this.savingsComparisons = scenarioKeys.map((k) => {
        return this.costComparisons[k];
      }).filter(Boolean) as CostComparison[];
    }
  }

  toggleMonthlyBreakdown(scenario: string): void {
    this.expandedRow = this.expandedRow === scenario ? null : scenario;
    if (this.expandedRow === scenario) {
      // wait for the monthly breakdown to render, then scroll into view
      setTimeout(() => {
        try {
          this.monthlyBreakdownEl?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          console.debug('scrollIntoView failed', e);
        }
      }, 50);
    }
  }

  getScenarioName(scenario: string): string {
    const index = this.scenarios.indexOf(scenario);
    if (scenario === 'current') return 'Current';
    return index >= 0 ? this.scenarioNames[index] : scenario;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatPercent(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return `${amount.toFixed(0)}%`;
  }

  formatHighestMonthlySpend(comparison: CostComparison): string {
    const currency = this.formatCurrency(comparison.highestMonthlySpend);
    if (comparison.highestMonthlySpendMonth) {
      const { year, month } = comparison.highestMonthlySpendMonth;
      return `${currency} (${year}-${month.toString().padStart(2, '0')})`;
    }
    return currency;
  }

  isZeroValue(amount: number): boolean {
    return amount === 0;
  }

  get filteredReferenceComparisons(): CostComparison[] {
    if (this.showFullDetails) return this.referenceComparisons;
    return this.referenceComparisons.filter(c => c.scenario !== 'onDemand');
  }
}
