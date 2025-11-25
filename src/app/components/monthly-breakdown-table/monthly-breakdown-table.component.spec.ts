import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlyBreakdownTableComponent } from './monthly-breakdown-table.component';

describe('MonthlyBreakdownTableComponent', () => {
  let component: MonthlyBreakdownTableComponent;
  let fixture: ComponentFixture<MonthlyBreakdownTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyBreakdownTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyBreakdownTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
