import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let svc: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [StorageService] });
    svc = TestBed.inject(StorageService);
  });

  it('can set/get/remove a value', async () => {
    await svc.set('test-key', { a: 1 });
    const v = await svc.get<any>('test-key');
    expect(v).toBeTruthy();
    expect(v.a).toBe(1);
    await svc.remove('test-key');
    const gone = await svc.get('test-key');
    expect(gone).toBeNull();
  });
});
