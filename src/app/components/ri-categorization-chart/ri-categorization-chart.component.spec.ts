import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RiCategorizationChartComponent } from './ri-categorization-chart.component';

describe('RiCategorizationChartComponent', () => {
  let component: RiCategorizationChartComponent;
  let fixture: ComponentFixture<RiCategorizationChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiCategorizationChartComponent, NgxEchartsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(RiCategorizationChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});