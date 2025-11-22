import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { CostComparisonCalculator, CostComparison } from '../../cost-timeseries/cost-comparison-calculator';
import CostTimeseries from '../../cost-timeseries/costTimeseries.model';
import { RiPortfolio } from '../ri-portfolio-upload/models/ri-portfolio.model';

@Component({
  selector: 'app-cost-comparison-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cost-comparison-table.component.html',
  styleUrl: './cost-comparison-table.component.scss'
})
export class CostComparisonTableComponent implements OnChanges {
  @Input() riPortfolio!: RiPortfolio;

  costComparisons: CostComparison[] = [];
  expandedRow: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['riPortfolio'] && this.riPortfolio) {
      this.costComparisons = CostComparisonCalculator.calculateCostComparison(this.riPortfolio);
    }
  }

  toggleMonthlyBreakdown(scenario: string): void {
    this.expandedRow = this.expandedRow === scenario ? null : scenario;
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

  getMonthlyCostForScenario(monthlyBreakdown: CostTimeseries[], scenario: string, year: number, month: number): number {
    let totalCost = 0;
    for (const timeseries of monthlyBreakdown) {
      const monthlyCost = timeseries.monthlyCost.find(mc => mc.year === year && mc.month === month);
      if (monthlyCost) {
        const costKey = this.getCostKeyForScenario(scenario);
        const cost = (monthlyCost.cost as any)[costKey];
        if (cost) {
          totalCost += cost.monthlyCost;
        }
      }
    }
    return totalCost;
  }

  getMonthlyCostByType(monthlyBreakdown: CostTimeseries[], year: number, month: number, costType: string): number {
    let totalCost = 0;
    for (const timeseries of monthlyBreakdown) {
      const monthlyCost = timeseries.monthlyCost.find(mc => mc.year === year && mc.month === month);
      if (monthlyCost) {
        const cost = (monthlyCost.cost as any)[costType];
        if (cost) {
          totalCost += cost.monthlyCost;
        }
      }
    }
    return totalCost;
  }

  private getCostKeyForScenario(scenario: string): keyof CostTimeseries['monthlyCost'][0]['cost'] {
    switch (scenario) {
    case 'On Demand':
      return 'onDemand';
    case '1yr No Upfront':
      return 'noUpfront_1y';
    case '3yr Full Upfront':
      return 'fullUpfront_3y';
    default:
      return 'onDemand';
    }
  }

  getYearsForScenario(monthlyBreakdown: CostTimeseries[]): number[] {
    const years = new Set<number>();
    for (const timeseries of monthlyBreakdown) {
      for (const monthlyCost of timeseries.monthlyCost) {
        years.add(monthlyCost.year);
      }
    }
    return Array.from(years).sort((a, b) => a - b);
  }

  getMonthsForYear(monthlyBreakdown: CostTimeseries[], year: number): number[] {
    const months = new Set<number>();
    for (const timeseries of monthlyBreakdown) {
      for (const monthlyCost of timeseries.monthlyCost) {
        if (monthlyCost.year === year) {
          months.add(monthlyCost.month);
        }
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }
}
