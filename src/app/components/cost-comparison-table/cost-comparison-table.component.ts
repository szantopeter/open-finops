import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { CostComparisonCalculator, CostComparison, CostTimeseriesByScenario, CostComparisonByScenario } from '../../cost-comparision/cost-comparison-calculator';
import { CostTimeseriesCalculator } from '../../cost-timeseries/cost-timeseries-calculator';
import CostTimeseries from '../../cost-timeseries/costTimeseries.model';
import { RiRenewalProjection } from '../../ri-renewal-projection/ri-renewal-projection';
import { SavingsKey } from '../ri-portfolio-upload/models/pricing.model';
import { RiPortfolio } from '../ri-portfolio-upload/models/ri-portfolio.model';
import { MonthlyBreakdownTableComponent } from '../monthly-breakdown-table/monthly-breakdown-table.component';

@Component({
  selector: 'app-cost-comparison-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MonthlyBreakdownTableComponent],
  templateUrl: './cost-comparison-table.component.html',
  styleUrl: './cost-comparison-table.component.scss'
})
export class CostComparisonTableComponent implements OnChanges {
  @Input() riPortfolio!: RiPortfolio;

  costComparisons: CostComparisonByScenario = {} as CostComparisonByScenario;
  costTimeseriesByScenario: CostTimeseriesByScenario = {} as CostTimeseriesByScenario;
  expandedRow: string | null = null;
  scenarios: string[] = ['onDemand', 'noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];
  scenarioNames: string[] = ['On Demand', '1yr No Upfront', '1yr Partial Upfront', '1yr All Upfront', '3yr Partial Upfront', '3yr All Upfront'];

  get currentComparison(): CostComparison | undefined {
    return this.expandedRow ? this.costComparisons[this.expandedRow as keyof CostComparisonByScenario] : undefined;
  }

  get costComparisonsArray(): CostComparison[] {
    return Object.values(this.costComparisons);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['riPortfolio'] && this.riPortfolio) {
      const costTimeseriesByScenario: CostTimeseriesByScenario = {} as CostTimeseriesByScenario;

      // On-demand - no projection needed
      const projected = RiRenewalProjection.projectRiRenewal(this.riPortfolio, '1yr_No Upfront');
      const onDemandTimeseries = CostTimeseriesCalculator.calculateCostTimeSeries(projected, true);
      const mergedOnDemand = CostComparisonCalculator.mergeRiRows(onDemandTimeseries);
      costTimeseriesByScenario.onDemand = mergedOnDemand;

      // Savings types
      const savingsKeys: SavingsKey[] = ['1yr_No Upfront', '1yr_Partial Upfront', '1yr_All Upfront', '3yr_Partial Upfront', '3yr_All Upfront'];
      const scenarioKeys: (keyof CostTimeseriesByScenario)[] = ['noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];
      for (let i = 0; i < savingsKeys.length; i++) {
        const projected1 = RiRenewalProjection.projectRiRenewal(this.riPortfolio, savingsKeys[i]);
        const timeseries1 = CostTimeseriesCalculator.calculateCostTimeSeries(projected1, false);
        const mergedTimeseries1 = CostComparisonCalculator.mergeRiRows(timeseries1);
        costTimeseriesByScenario[scenarioKeys[i]] = mergedTimeseries1;
      }

      this.costComparisons = CostComparisonCalculator.calculateCostComparison(costTimeseriesByScenario, this.riPortfolio.metadata.firstFullYear);
      this.costTimeseriesByScenario = costTimeseriesByScenario;
    }
  }

  toggleMonthlyBreakdown(scenario: string): void {
    this.expandedRow = this.expandedRow === scenario ? null : scenario;
  }

  getScenarioName(scenario: string): string {
    const index = this.scenarios.indexOf(scenario);
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

  isZeroValue(amount: number): boolean {
    return amount === 0;
  }
}
