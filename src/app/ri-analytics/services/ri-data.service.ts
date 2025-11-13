import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { RiPorftolio } from '../models/ri-import.model';

@Injectable({ providedIn: 'root' })
export class RiDataService {
  private readonly _current = new BehaviorSubject<RiPorftolio | null>(null);
  public riPortfolio$ = this._current.asObservable();

  setRiPortfolio(value: RiPorftolio): void {

    console.debug('[RiDataService] setImport called with', value);
    this._current.next(value);
  }

  clear(): void {

    console.debug('[RiDataService] clear called');
    this._current.next(null);
  }
}
