import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { RiImport } from '../models/ri-import.model';

@Injectable({ providedIn: 'root' })
export class RiDataService {
  private readonly _current = new BehaviorSubject<RiImport | null>(null);
  public currentImport$ = this._current.asObservable();

  setImport(value: RiImport): void {
    // eslint-disable-next-line no-console
    console.debug('[RiDataService] setImport called with', value);
    this._current.next(value);
  }

  clear(): void {
    // eslint-disable-next-line no-console
    console.debug('[RiDataService] clear called');
    this._current.next(null);
  }
}
