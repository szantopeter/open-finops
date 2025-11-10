import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiImportUploadComponent } from './ri-import-upload.component';
import { PageStateService } from '../../../core/services/page-state.service';
import { StorageService } from '../../../core/services/storage.service';
import { RiDataService } from '../../services/ri-data.service';
import { RiImportService } from '../../services/ri-import.service';

describe('RiImportUploadComponent', () => {
  let fixture: ComponentFixture<RiImportUploadComponent>;
  let parserSpy: jasmine.SpyObj<RiImportService>;
  let dataSpy: jasmine.SpyObj<RiDataService>;
  let storageSpy: jasmine.SpyObj<StorageService>;
  let pageStateSpy: jasmine.SpyObj<PageStateService>;

  beforeEach(async () => {
    parserSpy = jasmine.createSpyObj('RiImportService', ['parseFile']);
    dataSpy = jasmine.createSpyObj('RiDataService', ['setImport', 'clear'], { currentImport$: null as any });
    storageSpy = jasmine.createSpyObj('StorageService', ['set', 'get', 'remove']);
    pageStateSpy = jasmine.createSpyObj('PageStateService', ['saveKey']);

    await TestBed.configureTestingModule({
      imports: [RiImportUploadComponent],
      providers: [
        { provide: RiImportService, useValue: parserSpy },
        { provide: RiDataService, useValue: dataSpy },
        { provide: StorageService, useValue: storageSpy },
        { provide: PageStateService, useValue: pageStateSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RiImportUploadComponent);
    fixture.detectChanges();
  });

  function makeFile(text: string, name = 'f.csv'): File {
    const blob = new Blob([text], { type: 'text/csv' });
    return new File([blob], name, { type: 'text/csv' });
  }

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
    parserSpy.parseFile.and.resolveTo({ import: imp });

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    await fixture.componentInstance.onFile({ target: input } as any);

    expect(dataSpy.setImport).toHaveBeenCalledWith(imp);
    expect(storageSpy.set).toHaveBeenCalledWith('ri-import', imp);
    expect(pageStateSpy.saveKey).toHaveBeenCalledWith('ri-import');
  });
});
