import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

import { PricingData } from '../models/pricing.model';
import { RiRow } from '../models/ri-portfolio.model';

@Injectable({ providedIn: 'root' })
export class PricingLoaderService {

  constructor(private readonly http: HttpClient) {}

  async loadPricingForRiRow(riRow : RiRow): Promise<PricingData> {
    return lastValueFrom(this.http.get<PricingData>(this.getPricingFilePath(riRow)));
  }

  private getPricingFilePath(riRow: RiRow) : string {
    const region = riRow.region;
    const instance = riRow.instanceClass;
    const deployment = riRow.multiAz ? 'multi-az' : 'single-az';

    let engineKey = riRow.engine;
    if (riRow.edition) engineKey = `${engineKey}-${riRow.edition}`;

    return `/assets/pricing/${region}/${instance}/${region}_${instance}_${deployment}-${engineKey}.json`;
  }

}
