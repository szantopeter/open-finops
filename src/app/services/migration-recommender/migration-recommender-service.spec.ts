import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MigrationRecommender } from './migration-recommender-service';
import { PricingKey } from '../../components/ri-portfolio-upload/models/pricing.model';

describe('MigrationRecommender', () => {
  let service: MigrationRecommender;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MigrationRecommender, provideHttpClient()]
    });
    service = TestBed.inject(MigrationRecommender);
  });

  describe('recommendMigrations', () => {
    it('should return an empty array for empty category counts', async () => {
      // Arrange
      const categoryCounts = new Map<PricingKey, number>();

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert
      expect(result).toEqual([]);
    });

    it('should recommend migrations to higher generations within the same instance family', async () => {
      // Arrange - db.m5.large should find cheaper db.m6g.large (based on real pricing data)
      const originalKey = new PricingKey('us-east-1', 'db.m5.large', 'single-az', 'mysql');

      const categoryCounts = new Map<PricingKey, number>([
        [originalKey, 2]
      ]);

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert - we expect a recommendation since db.m6g.large is cheaper than db.m5.large
      expect(result.length).toBeGreaterThan(0);
      
      const recommendation = result[0];
      
      // Validate original pricing data
      expect(recommendation.originalPricingData.region).toBe('us-east-1');
      expect(recommendation.originalPricingData.instance).toBe('db.m5.large');
      expect(recommendation.originalPricingData.deployment).toBe('single-az');
      expect(recommendation.originalPricingData.engine).toBe('mysql');
      expect(recommendation.originalPricingData.onDemand.hourly).toBeGreaterThan(0);
      expect(recommendation.originalPricingData.onDemand.daily).toBeGreaterThan(0);
      
      // Validate recommended pricing data
      expect(recommendation.recommendedPricingData.region).toBe('us-east-1');
      expect(recommendation.recommendedPricingData.deployment).toBe('single-az');
      expect(recommendation.recommendedPricingData.engine).toBe('mysql');
      expect(recommendation.recommendedPricingData.onDemand.hourly).toBeGreaterThan(0);
      expect(recommendation.recommendedPricingData.onDemand.daily).toBeGreaterThan(0);
      
      // Validate the instance is a higher generation in the same family and same size
      const originalGenRegex = /db\.m(\d+)/;
      const recommendedGenRegex = /db\.m(\d+)/;
      const originalGen = Number.parseInt(originalGenRegex.exec(recommendation.originalPricingKey.instanceClass)?.[1] || '0', 10);
      const recommendedGen = Number.parseInt(recommendedGenRegex.exec(recommendation.recommendedPricingData.instance)?.[1] || '0', 10);
      expect(recommendedGen).toBeGreaterThan(originalGen);
      expect(recommendation.recommendedPricingData.instance).toContain('.large'); // Same size
      
      // Validate the recommendation structure
      expect(recommendation.originalPricingKey).toEqual(originalKey);
      expect(recommendation.count).toBe(2);
      
      // Validate that the recommended option is cheaper
      const originalPrice = recommendation.originalPricingData.savingsOptions?.['1yr_All Upfront']?.adjustedAmortisedDaily;
      const recommendedPrice = recommendation.recommendedPricingData.savingsOptions?.['1yr_All Upfront']?.adjustedAmortisedDaily;
      expect(originalPrice).toBeDefined();
      expect(recommendedPrice).toBeDefined();
      expect(recommendedPrice!).toBeLessThan(originalPrice!);
    }, 10000); // Increase timeout for HTTP calls

    it('should recommend the single cheapest higher generation option for each instance type', async () => {
      // Arrange - db.m5.large could potentially migrate to db.m6g, db.m6i, db.m7g, etc.
      // but should only recommend the cheapest one (db.m6g.large based on real data)
      const originalKey = new PricingKey('us-east-1', 'db.m5.large', 'single-az', 'mysql');

      const categoryCounts = new Map<PricingKey, number>([
        [originalKey, 1]
      ]);

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert - should return exactly one recommendation
      const recommendationsForOriginal = result.filter(r => r.originalPricingKey.instanceClass === 'db.m5.large');
      expect(recommendationsForOriginal.length).toBe(1);
      
      // Should be db.m6g.large as it's the cheapest (1.874223 vs 2.107324)
      expect(recommendationsForOriginal[0].recommendedPricingData.instance).toBe('db.m6g.large');
    }, 10000);

    it('should only recommend migrations that result in lower prices', async () => {
      // Arrange
      const originalKey = new PricingKey('us-east-1', 'db.m5.large', 'single-az', 'mysql');

      const categoryCounts = new Map<PricingKey, number>([
        [originalKey, 1]
      ]);

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert - if there are recommendations, they must be cheaper
      for (const recommendation of result) {
        const originalPrice = recommendation.originalPricingData.savingsOptions?.['1yr_All Upfront']?.adjustedAmortisedDaily;
        const recommendedPrice = recommendation.recommendedPricingData.savingsOptions?.['1yr_All Upfront']?.adjustedAmortisedDaily;
        
        expect(originalPrice).toBeDefined();
        expect(recommendedPrice).toBeDefined();
        expect(recommendedPrice!).toBeLessThan(originalPrice!);
      }
    }, 10000);

    it('should use 1-year all upfront savings plan for price comparisons', async () => {
      // Arrange
      const originalKey = new PricingKey('us-east-1', 'db.m5.large', 'single-az', 'mysql');

      const categoryCounts = new Map<PricingKey, number>([
        [originalKey, 1]
      ]);

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert - verify that both pricing data objects have 1yr_All Upfront option
      expect(result.length).toBeGreaterThan(0);
      for (const recommendation of result) {
        expect(recommendation.originalPricingData.savingsOptions?.['1yr_All Upfront']).toBeDefined();
        expect(recommendation.recommendedPricingData.savingsOptions?.['1yr_All Upfront']).toBeDefined();
      }
    }, 10000);

    it('should handle multiple RI counts correctly', async () => {
      // Arrange
      const originalKey = new PricingKey('us-east-1', 'db.m5.large', 'single-az', 'mysql');

      const categoryCounts = new Map<PricingKey, number>([
        [originalKey, 5] // Multiple RIs of the same type
      ]);

      // Act
      const result = await service.recommendMigrations(categoryCounts);

      // Assert - if there's a recommendation, it should include the count
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].count).toBe(5);
    }, 10000);
  });
});