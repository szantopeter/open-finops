import { CostTimeseriesCalculator } from './cost-timeseries-calculator';
import type { PricingData } from '../components/ri-portfolio-upload/models/pricing.model';
import type { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('CostTimeseriesCalculator', () => {
  describe('calculateCostTimeSeries', () => {
    it('should calculate on demand costs from start date to end of firstFullYear', () => {
      const firstFullYear = 2026;
      const dailyOnDemandPrice0 = 10;
      const dailyOnDemandPrice1 = 20;

      const startDate0 = new Date();
      startDate0.setFullYear(2024);
      //month is 0 indexed
      startDate0.setMonth(5);
      startDate0.setDate(15);

      const endDate0 = new Date();
      endDate0.setFullYear(2025);
      //month is 0 indexed
      endDate0.setMonth(5);
      endDate0.setDate(16);

      const count0 = 1;

      const riRow0: RiRow = {
        id: 'test-id-1',
        raw: {},
        startDate: startDate0,
        endDate: endDate0,
        count: count0,
        instanceClass: 'db.t3.micro',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        type: 'actual'
      };

      const startDate1 = new Date();
      startDate1.setFullYear(2024);
      startDate1.setMonth(7);
      startDate1.setDate(1);

      const endDate1 = new Date();
      endDate1.setFullYear(2025);
      endDate1.setMonth(7);
      endDate1.setDate(1);

      const count1 = 2;

      const riRow1: RiRow = {
        id: 'test-id-2',
        raw: {},
        startDate: startDate1,
        endDate: endDate1,
        count: count1,
        instanceClass: 'db.t3.small',
        region: 'us-east-1',
        multiAz: false,
        engine: 'mysql',
        edition: 'standard',
        upfrontPayment: 'No Upfront',
        durationMonths: 12,
        type: 'actual'
      };

      const pricingData1: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.micro',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: dailyOnDemandPrice0 / 24,
          daily: dailyOnDemandPrice0
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
          hourly: dailyOnDemandPrice1 / 24,
          daily: dailyOnDemandPrice1
        },
        savingsOptions: null
      };

      const riPortfolio: RiPortfolio = {
        metadata: {
          source: 'test1',
          importedAt: new Date().toISOString(),
          firstFullYear,
            projectionStartDate: new Date(2025,0,1), projectionEndDate: new Date()
        },
        rows: [
          { riRow: riRow0, pricingData: pricingData1 },
          { riRow: riRow1, pricingData: pricingData2 }
        ]
      };

      const expectedCost0 = [
        { year: 2024, month: 6, cost: 16 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 7, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 8, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 9, cost: 30 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 10, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 11, cost: 30 * dailyOnDemandPrice0 * count0 },
        { year: 2024, month: 12, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 1, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 2, cost: 28 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 3, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 4, cost: 30 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 5, cost: 31 * dailyOnDemandPrice0 * count0 },
        { year: 2025, month: 6, cost: 15 * dailyOnDemandPrice0 * count0 }
      ];
      const expectedCost2 = [
        { year: 2024, month: 8, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2024, month: 9, cost: 30 * dailyOnDemandPrice1 * count1 },
        { year: 2024, month: 10, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2024, month: 11, cost: 30 * dailyOnDemandPrice1 * count1 },
        { year: 2024, month: 12, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 1, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 2, cost: 28 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 3, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 4, cost: 30 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 5, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 6, cost: 30 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 7, cost: 31 * dailyOnDemandPrice1 * count1 },
        { year: 2025, month: 8, cost: 0 * dailyOnDemandPrice1 * count1 }
      ];

      // Act
      const result = CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, true);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveSize(2);

      // Check first RI
      expect(result[0].riRow).toBe(riRow0);
      expect(result[0].pricingData).toBe(pricingData1);

      // Check second RI
      expect(result[1].riRow).toBe(riRow1);
      expect(result[1].pricingData).toBe(pricingData2);

      // Both have the same monthly structure since same start date and firstFullYear
      result.forEach((costTimeseries, riIndex) => {
        const expectedCosts = riIndex === 0 ? expectedCost0 : expectedCost2;

        expect(costTimeseries.monthlyCost).toHaveSize(expectedCost0.length);

        expectedCosts.forEach((expectedMonth, index) => {
          const actualMonth = costTimeseries.monthlyCost[index];
          expect(actualMonth.year).withContext('Year mismatch ri index: ' + riIndex + ' index: ' + index).toBe(expectedMonth.year);
          expect(actualMonth.month).withContext('Month mismatch ri index: ' + riIndex + ' index: ' + index).toBe(expectedMonth.month);

          expect(actualMonth.cost.onDemand).toBeDefined();
          expect((actualMonth.cost.onDemand as any).upfrontCost).withContext('Upfront cost mismatch ri index: ' + riIndex + ' index: ' + index).toBe(0);
          expect((actualMonth.cost.onDemand as any).monthlyCost).withContext('Monthly cost mismatch ri index: ' + riIndex + ' index: ' + index + ' Actual month: ' + actualMonth.year + '.' + actualMonth.month ) .toBe(expectedMonth.cost);


          // All other cost types should be null
          expect(actualMonth.cost.fullUpfront_3y).toBeNull();
          expect(actualMonth.cost.fullUpfront_1y).toBeNull();
          expect(actualMonth.cost.partialUpfront_3y).toBeNull();
          expect(actualMonth.cost.partialUpfront_1y).toBeNull();
          expect(actualMonth.cost.noUpfront_1y).toBeNull();
        });
      });
    });

    it('should calculate savings costs for all RI types', () => {
      const startDate = new Date(2024, 5, 1); // June 1, 2024
      const endDate = new Date(2024, 5, 30); // June 30, 2024
      const activeDays = 29;
      const count = 1;

      // Define the RI types and their expected cost fields
      const riTypes = [
        {
          upfrontPayment: 'No Upfront' as const,
          durationMonths: 12,
          expectedField: 'noUpfront_1y',
          savingsKey: '1yr_No Upfront',
          daily: 1,
          adjusted: 1
        },
        {
          upfrontPayment: 'Partial' as const,
          durationMonths: 12,
          expectedField: 'partialUpfront_1y',
          savingsKey: '1yr_Partial Upfront',
          daily: 1.1,
          adjusted: 1.1 * 1.2
        },
        {
          upfrontPayment: 'All Upfront' as const,
          durationMonths: 12,
          expectedField: 'fullUpfront_1y',
          savingsKey: '1yr_All Upfront',
          daily: 1.2,
          adjusted: 1.2 * 1.4
        },
        {
          upfrontPayment: 'Partial' as const,
          durationMonths: 36,
          expectedField: 'partialUpfront_3y',
          savingsKey: '3yr_Partial Upfront',
          daily: 1.3,
          adjusted: 1.3 * 1.2
        },
        {
          upfrontPayment: 'All Upfront' as const,
          durationMonths: 36,
          expectedField: 'fullUpfront_3y',
          savingsKey: '3yr_All Upfront',
          daily: 1.4,
          adjusted: 1.4 * 1.4
        }
      ];

      const rows = riTypes.map((type, index) => {
        const riRow: RiRow = {
          id: `test-id-${index}`,
          raw: {},
          startDate,
          endDate,
          count,
          instanceClass: 'db.t3.micro',
          region: 'us-east-1',
          multiAz: false,
          engine: 'mysql',
          edition: 'standard',
          upfrontPayment: type.upfrontPayment,
          durationMonths: type.durationMonths,
          type: 'actual'
        };

        const pricingData: PricingData = {
          region: 'us-east-1',
          instance: 'db.t3.micro',
          deployment: 'single-az',
          engine: 'mysql',
          license: 'li',
          onDemand: { hourly: 0.1, daily: 2.4 },
          savingsOptions: {
              [type.savingsKey]: {
                    term: type.durationMonths === 36 ? '3yr' : '1yr',
                    purchaseOption: type.upfrontPayment === 'Partial' ? 'Partial Upfront' : type.upfrontPayment,
                    upfront: type.upfrontPayment === 'No Upfront' ? 0 : 100,
                    hourly: 0.05,
                    effectiveHourly: 0.06,
                    daily: type.daily,
                    adjustedAmortisedDaily: type.adjusted
                  }
            } as any
        };

        return { riRow, pricingData };
      });

      const riPortfolio: RiPortfolio = {
        metadata: {
          source: 'test-savings',
          importedAt: new Date().toISOString(),
          firstFullYear: 2025,
            projectionStartDate: new Date(2025,0,1), projectionEndDate: new Date()
        },
        rows
      };

      // Act
      const result = CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, false);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveSize(5);

      result.forEach((costTimeseries, index) => {
        const type = riTypes[index];
        expect(costTimeseries.monthlyCost).toHaveSize(1); // Only one month

        const monthCost = costTimeseries.monthlyCost[0];
        expect(monthCost.year).toBe(2024);
        expect(monthCost.month).toBe(6);

        // Check that the expected field is populated
        const field = (monthCost.cost as any)[type.expectedField];
        expect(field).toBeDefined();
        expect(field.upfrontCost).toBe(type.upfrontPayment === 'No Upfront' ? 0 : 100);
        expect(field.monthlyCost).toBe(type.daily * activeDays * count);

        // adjustedAmortisedCost should be derived from SavingsOption.adjustedAmortisedDaily * activeDays
        expect(field.adjustedAmortisedCost).toBe((type as any).adjusted * activeDays * count);

        // All other cost types should be null
        const allFields = ['fullUpfront_3y', 'fullUpfront_1y', 'partialUpfront_3y', 'partialUpfront_1y', 'noUpfront_1y', 'onDemand'];
        for (const f of allFields) {
          if (f !== type.expectedField) {
            expect((monthCost.cost as any)[f]).toBeNull();
          }
        }
      });
    });

  });
});
