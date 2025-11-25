import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { CostComparisonTableComponent } from './cost-comparison-table.component';
import type { RiPortfolio } from '../ri-portfolio-upload/models/ri-portfolio.model';


describe('CostComparisonTableComponent', () => {
  let component: CostComparisonTableComponent;
  let fixture: ComponentFixture<CostComparisonTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostComparisonTableComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CostComparisonTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display cost comparisons when riPortfolio is provided', () => {

    const startDate : Date = new Date();
    startDate.setFullYear(2024, 0o5, 0o1);

    const endDate : Date = new Date();
    startDate.setFullYear(2025, 0o5, 0o1);

    const mockRiPortfolio: RiPortfolio = {
      metadata: {
        source: 'test',
        importedAt: new Date().toISOString(),
        firstFullYear: 2025
      },
      rows: [
        {
          riRow: {
            id: '1',
            raw: {},
            startDate: startDate,
            endDate: endDate,
            count: 1,
            instanceClass: 'db.t3.micro',
            region: 'us-east-1',
            multiAz: false,
            engine: 'mysql',
            edition: 'community',
            upfrontPayment: 'No Upfront',
            durationMonths: 12,
            type: 'actual'
          },
          pricingData: {
            region: 'us-east-1',
            instance: 'db.t3.micro',
            deployment: 'single-az',
            engine: 'mysql',
            onDemand: {
              hourly: 0.1,
              daily: 2.4
            },
            savingsOptions: {
              '1yr_No Upfront': {
                term: '1yr',
                purchaseOption: 'No Upfront',
                upfront: 0,
                hourly: 0.08,
                daily: 1.92
              },
              '1yr_Partial Upfront': {
                term: '1yr',
                purchaseOption: 'Partial Upfront',
                upfront: 200,
                hourly: 0.06,
                daily: 1.44
              },
              '1yr_All Upfront': {
                term: '1yr',
                purchaseOption: 'All Upfront',
                upfront: 400,
                hourly: 0.04,
                daily: 0.96
              },
              '3yr_Partial Upfront': {
                term: '3yr',
                purchaseOption: 'Partial Upfront',
                upfront: 500,
                hourly: 0.03,
                daily: 0.72
              },
              '3yr_All Upfront': {
                term: '3yr',
                purchaseOption: 'All Upfront',
                upfront: 1000,
                hourly: 0.05,
                daily: 1.2
              }
            }
          }
        }
      ]
    };

    // Set the input
    component.riPortfolio = mockRiPortfolio;
    component.ngOnChanges({
      riPortfolio: {
        currentValue: mockRiPortfolio,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true
      }
    });

    fixture.detectChanges();

    // Check that cost comparisons are calculated
    expect(Object.keys(component.costComparisons).length).toBeGreaterThan(0);
    expect(component.costComparisons.onDemand.scenario).toBeDefined();
    expect(component.costComparisons.onDemand.totalCost).toBeDefined();
  });

  it('should format currency correctly', () => {
    expect(component.formatCurrency(1234.56)).toBe('$1,234.56');
    expect(component.formatCurrency(0)).toBe('$0.00');
  });

  it('should format percent correctly', () => {
    expect(component.formatPercent(25)).toBe('25%');
    expect(component.formatPercent(-10)).toBe('-10%');
    expect(component.formatPercent(undefined)).toBe('-');
  });
});
