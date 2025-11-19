import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiPortfolioDataService } from './service/ri-portfolio-data.service';
import { RiCSVParserService } from './service/ri-portfolio-import.service';
import { RiImportUploadComponent } from './ri-portfolio-upload.component';
import { StorageService } from '../../storage-service/storage.service';

function makeFile(text: string, name = 'f.csv'): File {
  const blob = new Blob([text], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
}

describe('RiImportUploadComponent', () => {
  let fixture: ComponentFixture<RiImportUploadComponent>;
  let parserSpy: jasmine.SpyObj<RiCSVParserService>;
  let dataSpy: jasmine.SpyObj<RiPortfolioDataService>;
  let storageSpy: jasmine.SpyObj<StorageService>;
  // pageStateService removed; no local spy required

  beforeEach(async () => {
    parserSpy = jasmine.createSpyObj('RiImportService', ['parseFile']);
    dataSpy = jasmine.createSpyObj('RiDataService', ['setRiPortfolio', 'clear'], { riPortfolio$: null as any });
    storageSpy = jasmine.createSpyObj('StorageService', ['set', 'get', 'remove']);
    // pageState removed

    await TestBed.configureTestingModule({
      imports: [RiImportUploadComponent],
      providers: [
        { provide: RiCSVParserService, useValue: parserSpy },
        { provide: RiPortfolioDataService, useValue: dataSpy },
        { provide: StorageService, useValue: storageSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RiImportUploadComponent);
    fixture.detectChanges();
  });



  it('shows error and clears data when parser returns errors', async () => {
    const file = makeFile('a,b,c\n');
    parserSpy.parseFile.and.resolveTo({ errors: ['bad header'] });

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    // simulate file selection
    Object.defineProperty(input, 'files', { value: [file] });
    await fixture.componentInstance.onFile({ target: input } as any);

    expect(dataSpy.clear).toHaveBeenCalled();
    expect(fixture.componentInstance.lastError).toContain('bad header');
  });

  it('persists and notifies when parser returns import', async () => {
    const file = makeFile('a,b,c\n1,2,3\n');
    const imp = { metadata: { source: 'test', importedAt: new Date().toISOString(), columns: [], rowsCount: 1 }, rows: [] } as any;
    parserSpy.parseFile.and.resolveTo({ riPortfolio: imp });

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    await fixture.componentInstance.onFile({ target: input } as any);

    expect(dataSpy.setRiPortfolio).toHaveBeenCalledWith(imp);
    expect(storageSpy.set).toHaveBeenCalledWith('ri-import', imp);
  });
});
