import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { RiPortfolio } from '../models/ri-portfolio.model';

@Injectable({ providedIn: 'root' })
export class RiPortfolioDataService {
  private readonly _current = new BehaviorSubject<RiPortfolio | null>(null);
  public riPortfolio$ = this._current.asObservable();

  setRiPortfolio(value: RiPortfolio): void {

    console.debug('[RiDataService] setImport called with', value);
    this._current.next(value);
  }

  clear(): void {

    console.debug('[RiDataService] clear called');
    this._current.next(null);
  }
}
