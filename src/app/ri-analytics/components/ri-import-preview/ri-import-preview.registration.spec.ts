import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';

import { RiImportPreviewComponent } from './ri-import-preview.component';
import { PageStateService } from '../../../core/services/page-state.service';
import { StorageService } from '../../../core/services/storage.service';
import { RiDataService } from '../../services/ri-data.service';


describe('RiImportPreview registration', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiImportPreviewComponent],
      providers: [
        PageStateService,
        StorageService,
        RiDataService,
        { provide: Router, useValue: { events: new Subject() } }
      ]
    }).compileComponents();
  });

  it('restores stored import into RiDataService when present', async () => {
    const storage = TestBed.inject(StorageService);
    const svc = TestBed.inject(PageStateService);
    const ds = TestBed.inject(RiDataService);

    const sample = { metadata: { source: 'x', importedAt: new Date().toISOString(), columns: [], rowsCount: 0 }, rows: [] } as any;
    await storage.set('ri-import', sample);

    TestBed.createComponent(RiImportPreviewComponent);
    // ensure load is executed (the register also triggers an immediate load, but call explicitly)
    await svc.loadKey('ri-import');

    const cur = (await firstValueFrom(ds.currentImport$ as any)) as any;
    expect(cur).toBeTruthy();
    expect(cur.metadata.source).toBe('x');
  });
});
