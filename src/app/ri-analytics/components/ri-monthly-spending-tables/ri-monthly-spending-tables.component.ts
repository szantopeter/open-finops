import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RiDataService } from '../../services/ri-data.service';
import { RiMonthlySpendingService } from '../../services/ri-monthly-spending.service';

@Component({
  selector: 'app-ri-monthly-spending-tables',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ri-monthly-spending-tables.component.html',
  styles: [
    `table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }`
  ]
})
export class RiMonthlySpendingTablesComponent {
  @Input() scenarios: any[] = [];
  @Input() aggregatesByScenario: Record<string, Record<string, any>> = {};
  @Input() firstFullYear: number | null = null;
  // Expose global Object to the template for Object.keys usage
  Object = Object;

  private sub = new Subscription();

  constructor(
    private readonly riDataService: RiDataService,
    private readonly monthlySpendingService: RiMonthlySpendingService
  ) {}

  ngOnInit(): void {
    const s = this.riDataService.riPortfolio$.subscribe(async (portfolio) => {
      if (!portfolio || !portfolio.rows || portfolio.rows.length === 0) {
        this.scenarios = [];
        this.aggregatesByScenario = {};
        this.firstFullYear = null;
        return;
      }

      const data = await this.monthlySpendingService.getMonthlyTablesForRiPortfolio(portfolio as any);
      this.scenarios = data.scenarios || [];
      this.aggregatesByScenario = data.aggregatesByScenario || {};
      this.firstFullYear = data.firstFullYear;
    });

    this.sub.add(s);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  monthKeysForScenario(scenarioKey: string): string[] {
    const map = this.aggregatesByScenario || {};
    const keys = Object.keys(map[scenarioKey] || {}).sort();
    if (!this.firstFullYear) return keys;
    const prefix = `${this.firstFullYear}-`;
    return keys.filter(k => k.startsWith(prefix));
  }

  monthLabel(monthKey: string): string {
    const [y, m] = monthKey.split('-');
    return `${y}-${m}`;
  }
}
