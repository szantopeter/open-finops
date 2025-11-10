import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { StorageService } from './storage.service';

type LoadFn = (storage: StorageService) => Promise<void> | void;
type SaveFn = (storage: StorageService) => Promise<void> | void;

@Injectable({ providedIn: 'root' })
export class PageStateService {
  private registry = new Map<string, { load?: LoadFn; save?: SaveFn }>();

  constructor(private readonly router: Router, private readonly storage: StorageService) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.loadAll();
    });
  }

  register(key: string, load?: LoadFn, save?: SaveFn): () => void {
    this.registry.set(key, { load, save });
    // call load immediately to hydrate when component registers
    try {
      if (load) load(this.storage);
    } catch {
      // swallow
    }
    return () => this.registry.delete(key);
  }

  async loadAll(): Promise<void> {
    for (const { load } of Array.from(this.registry.values())) {
      if (load) {
        try {
          await load(this.storage);
        } catch {
          // swallow
        }
      }
    }
  }

  async saveAll(): Promise<void> {
    for (const { save } of Array.from(this.registry.values())) {
      if (save) {
        try {
          await save(this.storage);
        } catch {
          // swallow
        }
      }
    }
  }

  async loadKey(key: string): Promise<void> {
    const entry = this.registry.get(key);
    if (entry?.load) await entry.load(this.storage);
  }

  async saveKey(key: string): Promise<void> {
    const entry = this.registry.get(key);
    if (entry?.save) await entry.save(this.storage);
  }
}
