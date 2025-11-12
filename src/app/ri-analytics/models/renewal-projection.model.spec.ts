import { RenewalProjection, RiRow } from './renewal-projection.model';

describe('RenewalProjection Models', () => {
  describe('RiRow Interface', () => {
    it('should create a valid RiRow object with all fields', () => {
      const riRow: RiRow = {
        instanceClass: 'db.t3.medium',
        region: 'us-east-1',
        multiAz: true,
        engine: 'mysql',
        edition: 'enterprise',
        upfrontPayment: 'partial',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 2
      };

      expect(riRow.instanceClass).toBe('db.t3.medium');
      expect(riRow.region).toBe('us-east-1');
      expect(riRow.multiAz).toBe(true);
      expect(riRow.engine).toBe('mysql');
      expect(riRow.edition).toBe('enterprise');
      expect(riRow.upfrontPayment).toBe('partial');
      expect(riRow.durationMonths).toBe(12);
      expect(riRow.startDate).toBe('2024-01-01');
      expect(riRow.endDate).toBe('2024-12-31');
      expect(riRow.count).toBe(2);
    });

    it('should create RiRow with optional fields as undefined', () => {
      const riRow: RiRow = {
        instanceClass: 'db.t3.small',
        region: 'eu-west-1',
        multiAz: false,
        engine: 'postgres',
        upfrontPayment: 'no',
        durationMonths: 36,
        startDate: '2024-06-01'
        // endDate, edition, count are optional
      };

      expect(riRow.endDate).toBeUndefined();
      expect(riRow.edition).toBeUndefined();
      expect(riRow.count).toBeUndefined();
    });

    it('should handle null edition', () => {
      const riRow: RiRow = {
        instanceClass: 'db.t3.large',
        region: 'ap-southeast-1',
        multiAz: true,
        engine: 'oracle',
        edition: null,
        upfrontPayment: 'all',
        durationMonths: 24,
        startDate: '2024-03-15',
        endDate: '2026-03-15',
        count: 1
      };

      expect(riRow.edition).toBeNull();
    });

    it('should handle different upfront payment types', () => {
      const testCases = ['no', 'partial', 'all'];

      testCases.forEach(payment => {
        const riRow: RiRow = {
          instanceClass: 'db.t3.micro',
          region: 'us-west-2',
          multiAz: false,
          engine: 'mariadb',
          upfrontPayment: payment,
          durationMonths: 12,
          startDate: '2024-01-01'
        };

        expect(riRow.upfrontPayment).toBe(payment);
      });
    });
  });

  describe('RenewalProjection Interface', () => {
    it('should create a valid RenewalProjection object', () => {
      const originalRi: RiRow = {
        instanceClass: 'db.t3.medium',
        region: 'us-east-1',
        multiAz: true,
        engine: 'mysql',
        edition: 'enterprise',
        upfrontPayment: 'partial',
        durationMonths: 12,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        count: 2
      };

      const renewalStart = new Date('2024-12-31');
      const renewalEnd = new Date('2025-12-31');
      const pricing = { monthlyRate: 150.50, currency: 'USD' };
      const monthlyCost = 301.00; // 150.50 * 2

      const projection: RenewalProjection = {
        originalRi,
        renewalStart,
        renewalEnd,
        pricing,
        monthlyCost
      };

      expect(projection.originalRi).toBe(originalRi);
      expect(projection.renewalStart).toEqual(renewalStart);
      expect(projection.renewalEnd).toEqual(renewalEnd);
      expect(projection.pricing).toBe(pricing);
      expect(projection.monthlyCost).toBe(301.00);
    });

    it('should handle RenewalProjection without renewalEnd', () => {
      const originalRi: RiRow = {
        instanceClass: 'db.t3.small',
        region: 'eu-west-1',
        multiAz: false,
        engine: 'postgres',
        upfrontPayment: 'no',
        durationMonths: 36,
        startDate: '2024-06-01'
      };

      const projection: RenewalProjection = {
        originalRi: originalRi,
        renewalStart: new Date('2024-06-01'),
        pricing: { monthlyRate: 75.25 },
        monthlyCost: 75.25
      };

      expect(projection.renewalEnd).toBeUndefined();
      expect(projection.monthlyCost).toBe(75.25);
    });

    it('should handle zero monthly cost', () => {
      const projection: RenewalProjection = {
        originalRi: {
          instanceClass: 'db.t3.micro',
          region: 'us-west-2',
          multiAz: false,
          engine: 'mariadb',
          upfrontPayment: 'no',
          durationMonths: 12,
          startDate: '2024-01-01'
        },
        renewalStart: new Date('2024-01-01'),
        pricing: { monthlyRate: 0 },
        monthlyCost: 0
      };

      expect(projection.monthlyCost).toBe(0);
    });

    it('should handle large count values', () => {
      const projection: RenewalProjection = {
        originalRi: {
          instanceClass: 'db.r5.large',
          region: 'us-east-1',
          multiAz: true,
          engine: 'aurora-mysql',
          upfrontPayment: 'all',
          durationMonths: 36,
          startDate: '2024-01-01',
          count: 100
        },
        renewalStart: new Date('2024-01-01'),
        pricing: { monthlyRate: 500.00 },
        monthlyCost: 50000.00 // 500 * 100
      };

      expect(projection.monthlyCost).toBe(50000.00);
      expect(projection.originalRi.count).toBe(100);
    });
  });

  describe('Validation and Edge Cases', () => {
    it('should handle various date formats in RiRow', () => {
      const dateFormats = [
        '2024-01-01',
        '2024-12-31T23:59:59Z',
        '2024-06-15T12:00:00.000Z'
      ];

      dateFormats.forEach(date => {
        const riRow: RiRow = {
          instanceClass: 'db.t3.medium',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'partial',
          durationMonths: 12,
          startDate: date
        };

        expect(riRow.startDate).toBe(date);
      });
    });

    it('should handle different engine types', () => {
      const engines = ['mysql', 'postgres', 'oracle', 'sqlserver', 'aurora-mysql', 'aurora-postgres', 'mariadb'];

      engines.forEach(engine => {
        const riRow: RiRow = {
          instanceClass: 'db.t3.medium',
          region: 'us-east-1',
          multiAz: false,
          engine,
          upfrontPayment: 'no',
          durationMonths: 12,
          startDate: '2024-01-01'
        };

        expect(riRow.engine).toBe(engine);
      });
    });

    it('should handle different instance classes', () => {
      const instanceClasses = ['db.t3.micro', 'db.t3.small', 'db.t3.medium', 'db.t3.large', 'db.r5.large', 'db.r6g.xlarge'];

      instanceClasses.forEach(instanceClass => {
        const riRow: RiRow = {
          instanceClass,
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'partial',
          durationMonths: 12,
          startDate: '2024-01-01'
        };

        expect(riRow.instanceClass).toBe(instanceClass);
      });
    });

    it('should handle decimal monthly costs', () => {
      const costs = [123.45, 678.90, 0.01, 999999.99];

      costs.forEach(cost => {
        const projection: RenewalProjection = {
          originalRi: {
            instanceClass: 'db.t3.medium',
            region: 'us-east-1',
            multiAz: false,
            engine: 'mysql',
            upfrontPayment: 'no',
            durationMonths: 12,
            startDate: '2024-01-01'
          },
          renewalStart: new Date('2024-01-01'),
          pricing: { monthlyRate: cost },
          monthlyCost: cost
        };

        expect(projection.monthlyCost).toBe(cost);
      });
    });

    it('should handle AWS regions correctly', () => {
      const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1', 'ca-central-1', 'sa-east-1'];

      regions.forEach(region => {
        const riRow: RiRow = {
          instanceClass: 'db.t3.medium',
          region,
          multiAz: false,
          engine: 'mysql',
          upfrontPayment: 'no',
          durationMonths: 12,
          startDate: '2024-01-01'
        };

        expect(riRow.region).toBe(region);
      });
    });
  });
});
