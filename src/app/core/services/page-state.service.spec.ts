import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PageStateService } from './page-state.service';
import { StorageService } from './storage.service';

class MockRouter {
  events = new Subject<any>();
}

describe('PageStateService', () => {
  let svc: PageStateService;
  let router: MockRouter;

  beforeEach(() => {
    router = new MockRouter();
    TestBed.configureTestingModule({ providers: [PageStateService, StorageService, { provide: Router, useValue: router }] as any });
  svc = TestBed.inject(PageStateService);
  });

  it('calls load immediately on register and saveAll triggers save', async () => {
    let loaded = false;
    let saved = false;
    const load = async (s: StorageService) => { loaded = true; };
    const save = async (s: StorageService) => { saved = true; };
    svc.register('k', load, save);
    expect(loaded).toBeTrue();
    await svc.saveAll();
    expect(saved).toBeTrue();
  });
});
