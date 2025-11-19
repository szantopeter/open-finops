import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RiRenewalComparisonService, RenewalScenario } from '../../services/ri-renewal-comparison.service';

@Component({
  selector: 'app-ri-renewal-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ri-renewal-comparison.component.html',
  styleUrl: './ri-renewal-comparison.component.scss'
})
export class RiRenewalComparisonComponent implements OnInit, OnDestroy {
  scenarios: RenewalScenario[] = [];

  private destroy$ = new Subject<void>();

  constructor(private riRenewalComparisonService: RiRenewalComparisonService) {}

  ngOnInit(): void {
    this.riRenewalComparisonService.getRenewalScenarios().pipe(takeUntil(this.destroy$)).subscribe(scenarios => this.scenarios = scenarios);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
