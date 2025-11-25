import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input } from '@angular/core';

import CostTimeseries from '../../cost-timeseries/costTimeseries.model';

@Component({
  selector: 'app-monthly-breakdown-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-breakdown-table.component.html',
  styleUrl: './monthly-breakdown-table.component.scss'
})
export class MonthlyBreakdownTableComponent {
  @Input() expandedRow: string | null = null;
  @Input() timeseries: CostTimeseries[] = [];
  @Input() firstFullYear: number = 0;

  savingsScenarios: string[] = ['noUpfront_1y', 'partialUpfront_1y', 'fullUpfront_1y', 'partialUpfront_3y', 'fullUpfront_3y'];

  get displayedScenarios(): string[] {
    return this.expandedRow === 'onDemand' ? ['onDemand'] : this.savingsScenarios;
  }

  getScenarioName(scenario: string): string {
    const scenarioNames: { [key: string]: string } = {
      'onDemand': 'On Demand',
      'noUpfront_1y': '1yr No Upfront',
      'partialUpfront_1y': '1yr Partial Upfront',
      'fullUpfront_1y': '1yr All Upfront',
      'partialUpfront_3y': '3yr Partial Upfront',
      'fullUpfront_3y': '3yr All Upfront'
    };
    return scenarioNames[scenario] || scenario;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  isZeroValue(amount: number): boolean {
    return amount === 0;
  }

  getMonthlyCost(scenario: string, year: number, month: number): number {
    for (const ts of this.timeseries) {
      const mc = ts.monthlyCost.find(m => m.year === year && m.month === month);
      if (mc) {
        const cost = (mc.cost as any)[scenario];
        return cost ? cost.monthlyCost : 0;
      }
    }
    return 0;
  }

  getUpfrontCost(scenario: string, year: number, month: number): number {
    for (const ts of this.timeseries) {
      const mc = ts.monthlyCost.find(m => m.year === year && m.month === month);
      if (mc) {
        const cost = (mc.cost as any)[scenario];
        return cost ? cost.upfrontCost : 0;
      }
    }
    return 0;
  }

  getYearMonths(): {year: number, month: number}[] {
    const yearMonths = new Set<string>();
    for (const ts of this.timeseries) {
      for (const monthlyCost of ts.monthlyCost) {
        yearMonths.add(`${monthlyCost.year}-${monthlyCost.month}`);
      }
    }
    return Array.from(yearMonths).map(ym => {
      const [year, month] = ym.split('-').map(Number);
      return {year, month};
    }).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  }

  getTotalMonthlyCost(scenario: string): number {
    let total = 0;
    for (const ym of this.getYearMonths()) {
      total += this.getMonthlyCost(scenario, ym.year, ym.month);
    }
    return total;
  }

  getTotalUpfrontCost(scenario: string): number {
    let total = 0;
    for (const ym of this.getYearMonths()) {
      total += this.getUpfrontCost(scenario, ym.year, ym.month);
    }
    return total;
  }
}
