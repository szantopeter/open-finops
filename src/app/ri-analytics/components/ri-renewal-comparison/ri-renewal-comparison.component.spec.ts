import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiRenewalComparisonComponent } from './ri-renewal-comparison.component';

describe('RiRenewalComparisonComponent', () => {
  let component: RiRenewalComparisonComponent;
  let fixture: ComponentFixture<RiRenewalComparisonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiRenewalComparisonComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(RiRenewalComparisonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
