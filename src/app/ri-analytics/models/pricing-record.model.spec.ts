import { PricingRecord } from './pricing-record.model';

describe('PricingRecord', () => {
  it('validate returns valid for a complete record', () => {
    const r = new PricingRecord({
      instanceClass: 'db.r5.large',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'No Upfront',
      durationMonths: 36,
      dailyReservedRate: 1.23
    });

    const result = r.validate();
    expect(result.valid).toBeTrue();
    expect(result.errors.length).toBe(0);
  });

  it('validate returns errors when required fields missing or invalid', () => {
    const r = new PricingRecord({
      // missing instanceClass
      instanceClass: '',
      region: '',
      multiAz: null as unknown as boolean,
      engine: '',
      edition: null,
      upfrontPayment: '',
      durationMonths: 0
    });

    const result = r.validate();
    expect(result.valid).toBeFalse();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
