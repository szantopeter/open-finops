import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, firstValueFrom } from 'rxjs';

export interface PricingMetadataRaw {
  fetchedAt: string;
  source: string;
  discountPercentApplied: number;
  [k: string]: any;
}

export interface PricingMetadata {
  fetchedAt: Date;
  source: string;
  discountPercentApplied: number;
  // original raw payload for reference
  raw: PricingMetadataRaw;
  // derived helpers
  ageDays: number;
  ageText: string;
}

@Injectable({ providedIn: 'root' })
export class PricingMetadataService {
  private readonly path = 'assets/pricing/metadata.json';

  constructor(private readonly http: HttpClient) {}

  /**
   * Returns the raw metadata object as read from the assets JSON file.
   */
  getRawMetadata(): Observable<PricingMetadataRaw> {
    return this.http.get<PricingMetadataRaw>(this.path);
  }

  /**
   * Returns a parsed model with derived fields (Date, ageDays, ageText).
   */
  getMetadata(): Observable<PricingMetadata> {
    return this.getRawMetadata().pipe(
      map((raw) => this.toModel(raw))
    );
  }

  /**
   * Convenience: get metadata once as a Promise.
   */
  async getMetadataOnce(): Promise<PricingMetadata> {
    const raw = await firstValueFrom(this.getRawMetadata());
    return this.toModel(raw);
  }

  private toModel(raw: PricingMetadataRaw): PricingMetadata {
    if (!raw) throw new Error('pricing metadata missing');
    if (!raw.fetchedAt) throw new Error('pricing metadata.fetchedAt missing');
    if (!raw.source) throw new Error('pricing metadata.source missing');
    if (raw.discountPercentApplied === undefined || raw.discountPercentApplied === null) throw new Error('pricing metadata.discountPercentApplied missing');

    const parsed = Date.parse(raw.fetchedAt);
    if (Number.isNaN(parsed)) throw new Error('pricing metadata.fetchedAt is not a valid date');

    const fetchedAt = new Date(parsed);
    const diffMs = Date.now() - parsed;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let ageText: string;
    if (days <= 0) ageText = 'today';
    else if (days === 1) ageText = '1 day ago';
    else ageText = `${days} days ago`;

    const model: PricingMetadata = {
      raw,
      fetchedAt,
      source: raw.source,
      discountPercentApplied: raw.discountPercentApplied,
      ageDays: days,
      ageText,
    };
    return model;
  }
}
