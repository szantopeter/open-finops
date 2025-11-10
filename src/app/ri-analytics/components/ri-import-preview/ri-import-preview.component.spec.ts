import { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RiImportPreviewComponent } from './ri-import-preview.component';
import { RiDataService } from '../../services/ri-data.service';

describe('RiImportPreviewComponent', () => {
  let fixture: ComponentFixture<RiImportPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiImportPreviewComponent],
      providers: [
        {
          provide: RiDataService,
          useValue: {
            currentImport$: of({
              metadata: { source: 'test', importedAt: '2024-11-21T12:00:00.000Z', columns: ['Reservation ID', 'Instance Type', 'Region', 'Start'], rowsCount: 2 },
              rows: [
                { raw: { 'Reservation ID': 'r1', 'Instance Type': 'db.t3.small', 'Region': 'eu-west-1', 'Start': '2024-11-01' }, startDate: '2024-11-01', count: 2, instanceClass: 'db.t3.small', region: 'eu-west-1' },
                { raw: { 'Reservation ID': 'r2', 'Instance Type': 'db.t3.small', 'Region': 'eu-west-1', 'Start': '2024-11-01' }, startDate: '2024-11-01', count: 1, instanceClass: 'db.t3.small', region: 'eu-west-1' }
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
});
