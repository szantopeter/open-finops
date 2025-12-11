import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

import type { PricingData } from '../models/pricing.model';
import type { RiRow } from '../models/ri-portfolio.model';
import { RiCategorizatorCalculator } from 'src/app/calculators/ri-categorizator/ri-categorizator-calculator';

@Injectable({ providedIn: 'root' })
export class PricingLoaderService {

  constructor(private readonly http: HttpClient) {}

  async loadPricingForRiRow(riRow : RiRow): Promise<PricingData> {
    return lastValueFrom(this.http.get<PricingData>(this.getPricingFilePath(riRow)));
  }

  private getPricingFilePath(riRow: RiRow) : string {
    const riKey = RiCategorizatorCalculator.getRiKey(riRow);
    return `/assets/pricing/${riKey}.json`;
  }



}
