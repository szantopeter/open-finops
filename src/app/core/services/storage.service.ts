import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';

@Injectable({ providedIn: 'root' })
export class StorageService {
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await set(key, value as any);
    } catch (e) {
      // fallback to localStorage
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // swallow
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await get(key);
      return (v ?? null) as T | null;
    } catch (e) {
      try {
        const s = localStorage.getItem(key);
        return s ? (JSON.parse(s) as T) : null;
      } catch {
        return null;
      }
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await del(key);
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }
}
