import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ri-renewal-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ri-renewal-comparison.component.html',
  styleUrl: './ri-renewal-comparison.component.scss'
})
export class RiRenewalComparisonComponent {
  @Input() summaryScenarios: Array<{
    scenario: string;
    upfrontPayment: string;
    durationMonths: number;
    firstFullYear: number;
    firstFullYearSavings: number;
    firstFullYearSavingsPercentage: number;
    firstFullYearRiCost: number;
    firstFullYearOnDemandCost: number;
    maxMonthlyRiSpending: number;
  }> = [];
}
