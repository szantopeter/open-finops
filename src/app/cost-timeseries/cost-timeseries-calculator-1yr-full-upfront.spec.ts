import { CostTimeseriesCalculator } from './cost-timeseries-calculator';
import { PricingData, SavingsOption } from '../components/ri-portfolio-upload/models/pricing.model';
import { RiPortfolio, RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('CostTimeseriesCalculator', () => {
  describe('calculateCostTimeSeries', () => {
    it('should calculate on 1yr full upfrot costs from start date to end of firstFullYear', () => {
      const firstFullYear = 2026;
      const dailyOnDemandPrice0 = 10;
      const dailyOnDemandPrice1 = 20;
      const riDiscount = 0;
      const upfrontCost0 = dailyOnDemandPrice0 * (1 - riDiscount) * 365;
      const upfrontCost1 = dailyOnDemandPrice1 * (1 - riDiscount) * 365;

      const startDate0 = new Date()
      startDate0.setFullYear(2024)
      //month is 0 indexed
      startDate0.setMonth(5)
      startDate0.setDate(15)

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
        upfrontPayment: 'NoUpfront',
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
        upfrontPayment: 'NoUpfront',
        durationMonths: 12,
        type: 'actual'
      };

      const pricingData0: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.micro',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: dailyOnDemandPrice0 / 24,
          daily: dailyOnDemandPrice0
        },
        savingsOptions: {
          '1yr_No Upfront': null,
          '1yr_Partial Upfront': null,
          '1yr_All Upfront' : {
            term: '1yr',
            purchaseOption: 'All Upfront',
            upfront: upfrontCost0,
            hourly: dailyOnDemandPrice0 * riDiscount / 24,
            daily: dailyOnDemandPrice0 * riDiscount
          },
          '3yr_Partial Upfront': null,
          '3yr_All Upfront': null
        }
      };

      const pricingData1: PricingData = {
        region: 'us-east-1',
        instance: 'db.t3.small',
        deployment: 'single-az',
        engine: 'mysql',
        license: 'li',
        onDemand: {
          hourly: dailyOnDemandPrice1 / 24,
          daily: dailyOnDemandPrice1
        },
        savingsOptions: {
          '1yr_No Upfront': null,
          '1yr_Partial Upfront': null,
          '1yr_All Upfront' : {
            term: '1yr',
            purchaseOption: 'All Upfront',
            upfront: upfrontCost1,
            hourly: dailyOnDemandPrice1 * riDiscount / 24,
            daily: dailyOnDemandPrice1 * riDiscount
          },
          '3yr_Partial Upfront': null,
          '3yr_All Upfront': null
        }
      };

      const riPortfolio: RiPortfolio = {
        metadata: {
          source: 'test1',
          importedAt: new Date().toISOString(),
          firstFullYear,
        },
        rows: [
          { riRow: riRow0, pricingData: pricingData0 },
          { riRow: riRow1, pricingData: pricingData1 }
        ]
      };

      const savingsOption: SavingsOption = {
        term: '1yr',
        purchaseOption: 'All Upfront'
      };

      const expectedCost0 = [
        { year: 2024, month: 6, upfrontCost: upfrontCost0, activeDays: 16},
        { year: 2024, month: 7, upfrontCost: 0, activeDays: 31},
        { year: 2024, month: 8, upfrontCost: 0, activeDays: 31},
        { year: 2024, month: 9, upfrontCost: 0, activeDays: 30},
        { year: 2024, month: 10, upfrontCost: 0, activeDays: 31},
        { year: 2024, month: 11, upfrontCost: 0, activeDays: 30},
        { year: 2024, month: 12, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 1, upfrontCost: 0, activeDays: 31 },
        { year: 2025, month: 2, upfrontCost: 0, activeDays: 28 },
        { year: 2025, month: 3, upfrontCost: 0, activeDays: 31 },
        { year: 2025, month: 4, upfrontCost: 0, activeDays: 30 },
        { year: 2025, month: 5, upfrontCost: 0, activeDays: 31 },
        { year: 2025, month: 6, upfrontCost: 0, activeDays: 15 },
      ];
      const expectedCost1 = [
        { year: 2024, month: 8, upfrontCost: upfrontCost1, activeDays: 31},
        { year: 2024, month: 9, upfrontCost: 0, activeDays: 30},
        { year: 2024, month: 10, upfrontCost: 0, activeDays: 31},
        { year: 2024, month: 11, upfrontCost: 0, activeDays: 30},
        { year: 2024, month: 12, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 1, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 2, upfrontCost: 0, activeDays: 28},
        { year: 2025, month: 3, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 4, upfrontCost: 0, activeDays: 30},
        { year: 2025, month: 5, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 6, upfrontCost: 0, activeDays: 30},
        { year: 2025, month: 7, upfrontCost: 0, activeDays: 31},
        { year: 2025, month: 8, upfrontCost: 0, activeDays: 0},
      ];

      // Act
      const result = CostTimeseriesCalculator.calculateCostTimeSeries(riPortfolio, savingsOption);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveSize(2);

      // Check first RI
      expect(result[0].riRow).toBe(riRow0);
      expect(result[0].pricingData).toBe(pricingData0);

      // Check second RI
      expect(result[1].riRow).toBe(riRow1);
      expect(result[1].pricingData).toBe(pricingData1);

      // Both have the same monthly structure since same start date and firstFullYear
      result.forEach((costTimeseries, riIndex) => {
        const expectedCosts = riIndex === 0 ? expectedCost0 : expectedCost1;
        const onDemandPrice = riIndex === 0 ? dailyOnDemandPrice0 : dailyOnDemandPrice1;
        const count = riIndex === 0 ? count0 : count1;

        expect(costTimeseries.monthlyCost).toHaveSize(expectedCost0.length);

        expectedCosts.forEach((expectedMonth, index) => {
          const actualMonth = costTimeseries.monthlyCost[index];
          expect(actualMonth.year).withContext("Year mismatch ri index: " + riIndex + " index: " + index).toBe(expectedMonth.year);
          expect(actualMonth.month).withContext("Month mismatch ri index: " + riIndex + " index: " + index).toBe(expectedMonth.month);

          expect(actualMonth.cost.fullUpfront_1y).toBeDefined();
          expect((actualMonth.cost.fullUpfront_1y as any).upfrontCost).withContext("Upfront cost mismatch ri index: " + riIndex + " index: " + index).toBe(expectedMonth.upfrontCost * count);
          expect((actualMonth.cost.fullUpfront_1y as any).monthlyCost).withContext("Monthly cost mismatch ri index: " + riIndex + " index: " + index + " Actual month: " + actualMonth.year + "." + actualMonth.month ) .toBe(expectedMonth.activeDays * onDemandPrice * riDiscount * count);

          // All other cost types should be null
          expect(actualMonth.cost.fullUpfront_3y).toBeNull();
          expect(actualMonth.cost.partialUpfront_1y).toBeNull();
          expect(actualMonth.cost.partialUpfront_3y).toBeNull();
          expect(actualMonth.cost.noUpfront_1y).toBeNull();
          expect(actualMonth.cost.onDemand).toBeNull();
        });
      });
    });


  }); 
});
