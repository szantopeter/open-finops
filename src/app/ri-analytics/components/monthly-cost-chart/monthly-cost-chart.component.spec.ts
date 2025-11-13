import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { MonthlyCostChartComponent } from './monthly-cost-chart.component';
import { MonthlyCostChartService } from '../../services/monthly-cost-chart.service';
import { RiCostAggregationService } from '../../services/ri-cost-aggregation.service';

describe('MonthlyCostChartComponent', () => {
  let component: MonthlyCostChartComponent;
  let fixture: ComponentFixture<MonthlyCostChartComponent>;

  beforeEach(async () => {
    const monthlyCostChartServiceSpy = jasmine.createSpyObj('MonthlyCostChartService', [], {
      chartData$: new BehaviorSubject({
        aggregates: null,
        error: null,
        missingPricing: [],
        totalSavingsAmount: 0,
        totalSavingsPercentage: 0,
        totalRiCost: 0,
        totalOnDemandCost: 0,
        yearSavingsBreakdown: []
      })
    });
    const riCostAggregationServiceSpy = jasmine.createSpyObj('RiCostAggregationService', [], {
      lastErrors: {
        unmatchedPricing: [],
        invalidPricing: [],
        missingRates: [],
        zeroActiveDays: [],
        zeroCount: [],
        renewalErrors: []
      }
    });

    await TestBed.configureTestingModule({
      imports: [MonthlyCostChartComponent],
      providers: [
        { provide: MonthlyCostChartService, useValue: monthlyCostChartServiceSpy },
        { provide: RiCostAggregationService, useValue: riCostAggregationServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MonthlyCostChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
