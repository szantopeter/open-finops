import { CostTimeseriesCalculator } from './cost-timeseries-calculator';
import { PricingData, SavingsOption } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('CostTimeseriesCalculator', () => {
  describe('calculateCostTimeSeries', () => {
    it('should calculate on demand costs from start date to end of firstFullYear', () => {
      const startDate1 = '2024-06-15T00:00:00.000Z'; // June 15, 2024
      const startDate2 = '2024-08-01T00:00:00.000Z'; // August 1, 2024
      const firstFullYear = 2026;
      const dailyOnDemandPrice1 = 10;
      const dailyOnDemandPrice2 = 20;

      const riRow1: RiRow = {
        id: 'test-id-1',
        raw: {},
        startDate: startDate1,
        count: 1,
        instanceClass: 'db.t3.micro',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'NoUpfront',
        durationMonths: 12
      };

      const riRow2: RiRow = {
        id: 'test-id-2',
        raw: {},
        startDate: startDate2,
        count: 2,
        instanceClass: 'db.t3.small',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'NoUpfront',
        durationMonths: 12
      };

      const pricingData1: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.micro',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: dailyOnDemandPrice1 / 24,
          daily: dailyOnDemandPrice1
        },
        savingsOptions: null
      };

      const pricingData2: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.small',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: dailyOnDemandPrice2 / 24,
          daily: dailyOnDemandPrice2
        },
        savingsOptions: null
      };

      const riPortfolio: RiPortfolio = {
        metadata: {
          source: 'test',
          importedAt: new Date().toISOString(),
          firstFullYear
        },
        rows: [
          { riRow: riRow1, pricingData: pricingData1 },
          { riRow: riRow2, pricingData: pricingData2 }
        ]
      };

      const savingsOption: SavingsOption = {
        term: '1yr',
        purchaseOption: 'On Demand'
      };

      // Months from June 2024 to December 2025
      const expectedMonths1 = [
        { year: 2024, month: 6 }, // June 2024
        { year: 2024, month: 7 }, // July
        { year: 2024, month: 8 }, // August
        { year: 2024, month: 9 }, // September
        { year: 2024, month: 10 }, // October
        { year: 2024, month: 11 }, // November
        { year: 2024, month: 12 }, // December
        { year: 2025, month: 1 }, // January 2025
        { year: 2025, month: 2 }, // February
        { year: 2025, month: 3 }, // March
        { year: 2025, month: 4 }, // April
        { year: 2025, month: 5 }, // May
        { year: 2025, month: 6 }, // June
        { year: 2025, month: 7 }, // July
        { year: 2025, month: 8 }, // August
        { year: 2025, month: 9 }, // September
        { year: 2025, month: 10 }, // October
        { year: 2025, month: 11 }, // November
        { year: 2025, month: 12 } // December
      ];

      // Months from July 2024 to December 2025
      const expectedMonths2 = [
        { year: 2024, month: 7 }, // July 2024
        { year: 2024, month: 8 }, // August
        { year: 2024, month: 9 }, // September
        { year: 2024, month: 10 }, // October
        { year: 2024, month: 11 }, // November
        { year: 2024, month: 12 }, // December
        { year: 2025, month: 1 }, // January 2025
        { year: 2025, month: 2 }, // February
        { year: 2025, month: 3 }, // March
        { year: 2025, month: 4 }, // April
        { year: 2025, month: 5 }, // May
        { year: 2025, month: 6 }, // June
        { year: 2025, month: 7 }, // July
        { year: 2025, month: 8 }, // August
        { year: 2025, month: 9 }, // September
        { year: 2025, month: 10 }, // October
        { year: 2025, month: 11 }, // November
        { year: 2025, month: 12 } // December
      ];

      // Act
      const result = CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, savingsOption);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveSize(2);

      // Check first RI
      expect(result[0].riRow).toBe(riRow1);
      expect(result[0].pricingData).toBe(pricingData1);

      // Check second RI
      expect(result[1].riRow).toBe(riRow2);
      expect(result[1].pricingData).toBe(pricingData2);

      // Both have the same monthly structure since same start date and firstFullYear
      result.forEach((costTimeseries, riIndex) => {
        const expectedMonths = riIndex === 0 ? expectedMonths1 : expectedMonths2;
        const count = riIndex === 0 ? 1 : 2;
        const expectedDailyPrice = riIndex === 0 ? dailyOnDemandPrice1 : dailyOnDemandPrice2;

        expect(costTimeseries.monthlyCost).toHaveSize(expectedMonths.length);

        expectedMonths.forEach((expectedMonth, index) => {
          const monthlyCost = costTimeseries.monthlyCost[index];
          expect(monthlyCost.year).toBe(expectedMonth.year);
          expect(monthlyCost.month).toBe(expectedMonth.month);

          const daysInMonth = new Date(expectedMonth.year, expectedMonth.month, 0).getDate();
          const expectedMonthlyCost = expectedDailyPrice * daysInMonth * count;

          const endMonth = riIndex === 0 ? 6 : 7;
          const isAfterEnd = expectedMonth.year > 2025 || (expectedMonth.year === 2025 && expectedMonth.month > endMonth);
          if (isAfterEnd) {
            expect(monthlyCost.cost.onDemand).toBeNull();
          } else {
            expect(monthlyCost.cost.onDemand).toBeDefined();
            expect(monthlyCost.cost.onDemand.upfrontCost).toBe(0);
            expect(monthlyCost.cost.onDemand.monthlyCost).toBe(expectedMonthlyCost);
          }

          // All other cost types should be null
          expect(monthlyCost.cost.fullUpfront_3y).toBeNull();
          expect(monthlyCost.cost.fullUpfront_1y).toBeNull();
          expect(monthlyCost.cost.partialUpUpfront_3y).toBeNull();
          expect(monthlyCost.cost.partialUpfront_1y).toBeNull();
          expect(monthlyCost.cost.noUpfront_1y).toBeNull();
        });
      });
    });

    it('should calculate 3 year full upfront costs', () => {
      const startDate3 = '2024-06-15T00:00:00.000Z'; // June 15, 2024
      const startDate4 = '2024-08-01T00:00:00.000Z'; // August 1, 2024
      const firstFullYear = 2026;
      const upfrontCost3 = 5000;
      const upfrontCost4 = 10000;

      const riRow3: RiRow = {
        id: 'test-id-3',
        raw: {},
        startDate: startDate3,
        count: 1,
        instanceClass: 'db.t3.micro',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'NoUpfront',
        durationMonths: 12
      };

      const riRow4: RiRow = {
        id: 'test-id-4',
        raw: {},
        startDate: startDate4,
        count: 2,
        instanceClass: 'db.t3.small',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'NoUpfront',
        durationMonths: 12
      };

      const pricingData3: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.micro',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: 0.1,
          daily: 2.4
        },
        savingsOptions: {
          '3yr_All Upfront': {
            term: '3yr',
            purchaseOption: 'All Upfront',
            upfront: upfrontCost3
          }
        } as any
      };

      const pricingData4: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.small',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: 0.2,
          daily: 4.8
        },
        savingsOptions: {
          '3yr_All Upfront': {
            term: '3yr',
            purchaseOption: 'All Upfront',
            upfront: upfrontCost4
          }
        } as any
      };

      const riPortfolio: RiPortfolio = {
        metadata: {
          source: 'test',
          importedAt: new Date().toISOString(),
          firstFullYear
        },
        rows: [
          { riRow: riRow3, pricingData: pricingData3 },
          { riRow: riRow4, pricingData: pricingData4 }
        ]
      };

      const savingsOption: SavingsOption = {
        term: '3yr',
        purchaseOption: 'All Upfront'
      };

      // Act
      const result = CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, savingsOption);

      // Assert
      expect(result).toHaveSize(2);

      // Check first RI
      expect(result[0].riRow).toBe(riRow3);
      expect(result[0].pricingData).toBe(pricingData3);

      // Months from June 2024 to December 2026
      const expectedMonths3 = [
        { year: 2024, month: 6 },
        { year: 2024, month: 7 },
        { year: 2024, month: 8 },
        { year: 2024, month: 9 },
        { year: 2024, month: 10 },
        { year: 2024, month: 11 },
        { year: 2024, month: 12 },
        { year: 2025, month: 1 },
        { year: 2025, month: 2 },
        { year: 2025, month: 3 },
        { year: 2025, month: 4 },
        { year: 2025, month: 5 },
        { year: 2025, month: 6 },
        { year: 2025, month: 7 },
        { year: 2025, month: 8 },
        { year: 2025, month: 9 },
        { year: 2025, month: 10 },
        { year: 2025, month: 11 },
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
        { year: 2026, month: 4 },
        { year: 2026, month: 5 },
        { year: 2026, month: 6 },
        { year: 2026, month: 7 },
        { year: 2026, month: 8 },
        { year: 2026, month: 9 },
        { year: 2026, month: 10 },
        { year: 2026, month: 11 },
        { year: 2026, month: 12 }
      ];

      expect(result[0].monthlyCost).toHaveSize(expectedMonths3.length);

      expectedMonths3.forEach((expectedMonth, index) => {
        const monthlyCost = result[0].monthlyCost[index];
        expect(monthlyCost.year).toBe(expectedMonth.year);
        expect(monthlyCost.month).toBe(expectedMonth.month);

        const isAfterEnd = expectedMonth.year > 2025 || (expectedMonth.year === 2025 && expectedMonth.month > 6);
        if (isAfterEnd) {
          expect(monthlyCost.cost.fullUpfront_3y).toBeNull();
        } else {
          expect(monthlyCost.cost.fullUpfront_3y).toBeDefined();
          if (index === 0) {
            expect(monthlyCost.cost.fullUpfront_3y.upfrontCost).toBe(upfrontCost3);
          } else {
            expect(monthlyCost.cost.fullUpfront_3y.upfrontCost).toBe(0);
          }
          expect(monthlyCost.cost.fullUpfront_3y.monthlyCost).toBe(0);
        }

        // All other cost types should be null
        expect(monthlyCost.cost.onDemand).toBeNull();
        expect(monthlyCost.cost.fullUpfront_1y).toBeNull();
        expect(monthlyCost.cost.partialUpUpfront_3y).toBeNull();
        expect(monthlyCost.cost.partialUpfront_1y).toBeNull();
        expect(monthlyCost.cost.noUpfront_1y).toBeNull();
      });

      // Check second RI
      expect(result[1].riRow).toBe(riRow4);
      expect(result[1].pricingData).toBe(pricingData4);

      // Months from July 2024 to December 2026
      const expectedMonths4 = [
        { year: 2024, month: 7 },
        { year: 2024, month: 8 },
        { year: 2024, month: 9 },
        { year: 2024, month: 10 },
        { year: 2024, month: 11 },
        { year: 2024, month: 12 },
        { year: 2025, month: 1 },
        { year: 2025, month: 2 },
        { year: 2025, month: 3 },
        { year: 2025, month: 4 },
        { year: 2025, month: 5 },
        { year: 2025, month: 6 },
        { year: 2025, month: 7 },
        { year: 2025, month: 8 },
        { year: 2025, month: 9 },
        { year: 2025, month: 10 },
        { year: 2025, month: 11 },
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
        { year: 2026, month: 4 },
        { year: 2026, month: 5 },
        { year: 2026, month: 6 },
        { year: 2026, month: 7 },
        { year: 2026, month: 8 },
        { year: 2026, month: 9 },
        { year: 2026, month: 10 },
        { year: 2026, month: 11 },
        { year: 2026, month: 12 }
      ];

      expect(result[1].monthlyCost).toHaveSize(expectedMonths4.length);

      expectedMonths4.forEach((expectedMonth, index) => {
        const monthlyCost = result[1].monthlyCost[index];
        expect(monthlyCost.year).toBe(expectedMonth.year);
        expect(monthlyCost.month).toBe(expectedMonth.month);

        const isAfterEnd = expectedMonth.year > 2025 || (expectedMonth.year === 2025 && expectedMonth.month > 8);
        if (isAfterEnd) {
          expect(monthlyCost.cost.fullUpfront_3y).toBeNull();
        } else {
          expect(monthlyCost.cost.fullUpfront_3y).toBeDefined();
          if (index === 0) {
            expect(monthlyCost.cost.fullUpfront_3y.upfrontCost).toBe(upfrontCost4 * riRow4.count);
          } else {
            expect(monthlyCost.cost.fullUpfront_3y.upfrontCost).toBe(0);
          }
          expect(monthlyCost.cost.fullUpfront_3y.monthlyCost).toBe(0);
        }

        // All other cost types should be null
        expect(monthlyCost.cost.onDemand).toBeNull();
        expect(monthlyCost.cost.fullUpfront_1y).toBeNull();
        expect(monthlyCost.cost.partialUpUpfront_3y).toBeNull();
        expect(monthlyCost.cost.partialUpfront_1y).toBeNull();
        expect(monthlyCost.cost.noUpfront_1y).toBeNull();
      });
    });
  });
});
