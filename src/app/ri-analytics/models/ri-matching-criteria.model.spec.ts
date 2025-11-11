import { RiMatchingCriteria } from './ri-matching-criteria.model';

describe('RiMatchingCriteria', () => {
  it('toKey should be stable and normalized', () => {
    const a = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
    });

    const b = new RiMatchingCriteria({
      instanceClass: 'DB.R5.LARGE',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
    });

    expect(a.toKey()).toBe(b.toKey());
  });

  it('equals returns true only when all seven fields match exactly (case-insensitive)', () => {
    const base = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'postgres',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 12,
    });

    const equal = new RiMatchingCriteria({
      instanceClass: 'DB.R5.LARGE',
      region: 'us-east-1',
      multiAz: false,
      engine: 'postgres',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 12,
    });

    const different = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-west-2', // different region
      multiAz: false,
      engine: 'postgres',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 12,
    });

    expect(base.equals(equal)).toBeTrue();
    expect(base.equals(different)).toBeFalse();
  });

  it('equals returns false when other is null/undefined', () => {
    const a = new RiMatchingCriteria({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: false,
      engine: 'postgres',
      edition: null,
      upfrontPayment: 'All Upfront',
      durationMonths: 12,
    });

    // @ts-ignore
    expect(a.equals(null)).toBeFalse();
    // @ts-ignore
    expect(a.equals(undefined)).toBeFalse();
  });
});
