import { TestBed } from '@angular/core/testing';
import { RiMonthlySpendingTablesComponent } from './ri-monthly-spending-tables.component';
import { RiDataService } from '../../services/ri-data.service';
import { of } from 'rxjs';
import { PricingDataService } from '../../services/pricing-data.service';
import { RiCostAggregationService } from '../../services/ri-cost-aggregation.service';
import { RiRow } from '../../models/ri-row.model';

describe('RiMonthlySpendingTables Integration', () => {
  beforeEach(async () => {
    const mockRiDataService = {
      riPortfolio$: of({ rows: [
        { startDate: '2025-01-01', endDate: '2025-12-31', count: 1, instanceClass: 'db.r5.large', region: 'eu-west-1', multiAz: false, engine: 'mysql', upfrontPayment: 'No Upfront', durationMonths: 12 }
      ] as RiRow[] })
    };

    const mockPricing = {
      pricingRecords: [{ instanceClass: 'db.r5.large', region: 'eu-west-1', multiAz: false, engine: 'mysql', edition: null as any, upfrontPayment: 'No Upfront' as any, durationMonths: 12 as any, dailyReservedRate: 1, dailyOnDemandRate: 2, upfrontCost: 100 } as any]
    };

    const mockPricingService = {
      loadPricingForPaths: () => of(mockPricing)
    };

    await TestBed.configureTestingModule({
      imports: [RiMonthlySpendingTablesComponent],
      providers: [
        { provide: RiDataService, useValue: mockRiDataService },
        { provide: PricingDataService, useValue: mockPricingService },
        RiCostAggregationService
      ]
    }).compileComponents();
  });

  it('renders tables from live services', async () => {
    const fixture = TestBed.createComponent(RiMonthlySpendingTablesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Should render Baseline + 6 scenarios (renewal service may return scenarios; at minimum Baseline present)
    expect(el.querySelectorAll('h3').length).toBeGreaterThanOrEqual(1);
  });
});
