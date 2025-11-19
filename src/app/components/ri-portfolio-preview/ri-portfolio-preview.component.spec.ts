import { ComponentFixture , TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { RiImportPreviewComponent } from './ri-portfolio-preview.component';
import { StorageService } from '../../storage-service/storage.service';
import { RiDataService } from '../ri-portfolio-upload/service/ri-portfolio-data.service';
import { RiCSVParserService } from '../ri-portfolio-upload/service/ri-portfolio-import.service';

describe('RiImportPreviewComponent', () => {
  let fixture: ComponentFixture<RiImportPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiImportPreviewComponent],
      providers: [
        StorageService,
        RiCSVParserService,
        { provide: Router, useValue: { events: of() } },
        {
          provide: RiDataService,
          useValue: {
            riPortfolio$: of({
              metadata: { source: 'test', importedAt: '2024-11-21T12:00:00.000Z', columns: ['Reservation ID', 'Instance Type', 'Region', 'Start'], rowsCount: 2 },
              rows: [
                { raw: { 'Reservation ID': 'r1', 'Instance Type': 'db.t3.small', 'Region': 'eu-west-1', 'Start': '2024-11-01' }, startDate: '2024-11-01', endDate: '2025-12-31', count: 2, instanceClass: 'db.t3.small', region: 'eu-west-1' },
                { raw: { 'Reservation ID': 'r2', 'Instance Type': 'db.t3.small', 'Region': 'eu-west-1', 'Start': '2024-11-01' }, startDate: '2024-11-01', endDate: '2026-03-15', count: 1, instanceClass: 'db.t3.small', region: 'eu-west-1' }
              ]
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RiImportPreviewComponent);
    fixture.detectChanges();
  });

  it('displays correct total and unique counts', () => {
    const el = fixture.nativeElement as HTMLElement;
    // text content should contain the human-readable sentence
    expect(el.textContent).toContain('Reserved Instance data overview: Data extract is date');
    expect(el.textContent).toContain('(2024-11-21)');
    // check totals and uniques numeric values exist (fixture has total=3, unique=2)
    expect(el.textContent).toContain('Total RIs');
    expect(el.textContent).toContain('coming from');
    // ensure strong tags are used for the numbers in the rendered HTML
    const html = el.innerHTML;
    expect(html).toMatch(/<strong>\s*3\s*<\/strong>/);
    expect(html).toMatch(/<strong>\s*2\s*<\/strong>/);
  });

  it('shows latest RI expiry when endDate present', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Latest RI expiry:');
    // latest endDate among rows is 2026-03-15
    expect(el.textContent).toContain('2026-03-15');
  });
});
