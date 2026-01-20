import { RiCategorizatorCalculator } from './ri-categorizator-calculator';
import type { RiPortfolio } from '../../components/ri-portfolio-upload/models/ri-portfolio.model';

describe('RiCategorizatorCalculator', () => {
  describe('categorizeRiPortfolio', () => {
    it('should return an empty map for an empty portfolio', () => {
      // Arrange
      const mockRiPortfolio: RiPortfolio = {
        metadata: {
          source: 'test',
          importedAt: new Date().toISOString(),
          projectionStartDate: new Date(2025, 0, 1),
          projectionEndDate: new Date(2025, 11, 31)
        },
        rows: []
      };

      // Act
      const result = RiCategorizatorCalculator.categorizeRiPortfolio(mockRiPortfolio);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should categorize RI rows by their pricing file categories', () => {
      // Arrange
      const mockRiPortfolio: RiPortfolio = {
        metadata: {
          source: 'test',
          importedAt: new Date().toISOString(),
          projectionStartDate: new Date(2025, 0, 1),
          projectionEndDate: new Date(2025, 11, 31)
        },
        rows: [
          {
            riRow: {
              id: 'test-id-1',
              raw: {},
              startDate: new Date(2025, 0, 1),
              endDate: new Date(2025, 11, 31),
              count: 1,
              instanceClass: 'db.t3.micro',
              region: 'us-east-1',
              multiAz: false,
              engine: 'mysql',
              edition: 'standard',
              upfrontPayment: 'No Upfront',
              durationMonths: 12,
              type: 'actual'
            },
            pricingData: {} as any
          },
          {
            riRow: {
              id: 'test-id-2',
              raw: {},
              startDate: new Date(2025, 0, 1),
              endDate: new Date(2025, 11, 31),
              count: 2,
              instanceClass: 'db.t3.micro',
              region: 'us-east-1',
              multiAz: false,
              engine: 'mysql',
              edition: 'standard',
              upfrontPayment: 'No Upfront',
              durationMonths: 12,
              type: 'actual'
            },
            pricingData: {} as any
          },
          {
            riRow: {
              id: 'test-id-3',
              raw: {},
              startDate: new Date(2025, 0, 1),
              endDate: new Date(2025, 11, 31),
              count: 1,
              instanceClass: 'db.r5.large',
              region: 'eu-west-1',
              multiAz: true,
              engine: 'postgresql',
              edition: 'standard',
              upfrontPayment: 'Partial',
              durationMonths: 36,
              type: 'actual'
            },
            pricingData: {} as any
          },
          {
            riRow: {
              id: 'test-id-4',
              raw: {},
              startDate: new Date(2025, 0, 1),
              endDate: new Date(2025, 11, 31),
              count: 1,
              instanceClass: 'db.r5.large',
              region: 'eu-west-1',
              multiAz: true,
              engine: 'oracle',
              edition: 'ee',
              upfrontPayment: 'All Upfront',
              durationMonths: 12,
              type: 'actual'
            },
            pricingData: {} as any
          }
        ]
      };

      // Act
      const result = RiCategorizatorCalculator.categorizeRiPortfolio(mockRiPortfolio);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3); // Three unique categories

      // Convert map to array of entries for easier testing
      const entries = Array.from(result.entries());
      
      // Category for us-east-1/db.t3.micro/single-az-mysql (standard edition)
      const mysqlKey = entries.find(([key]) => 
        key.region === 'us-east-1' && 
        key.instanceClass === 'db.t3.micro' && 
        key.deployment === 'single-az' && 
        key.engineKey === 'mysql'
      );
      expect(mysqlKey).toBeDefined();
      expect(mysqlKey![1]).toBe(3); // 1 + 2

      // Category for eu-west-1/db.r5.large/multi-az-postgresql (standard edition)
      const postgresqlKey = entries.find(([key]) => 
        key.region === 'eu-west-1' && 
        key.instanceClass === 'db.r5.large' && 
        key.deployment === 'multi-az' && 
        key.engineKey === 'postgresql'
      );
      expect(postgresqlKey).toBeDefined();
      expect(postgresqlKey![1]).toBe(1);

      // Category for eu-west-1/db.r5.large/multi-az-oracle-ee (edition included)
      const oracleKey = entries.find(([key]) => 
        key.region === 'eu-west-1' && 
        key.instanceClass === 'db.r5.large' && 
        key.deployment === 'multi-az' && 
        key.engineKey === 'oracle-ee'
      );
      expect(oracleKey).toBeDefined();
      expect(oracleKey![1]).toBe(1);
    });

    it('should handle RI rows with count greater than 1 correctly', () => {
      // Arrange
      const mockRiPortfolio: RiPortfolio = {
        metadata: {
          source: 'test',
          importedAt: new Date().toISOString(),
          projectionStartDate: new Date(2025, 0, 1),
          projectionEndDate: new Date(2025, 11, 31)
        },
        rows: [
          {
            riRow: {
              id: 'test-id-1',
              raw: {},
              startDate: new Date(2025, 0, 1),
              endDate: new Date(2025, 11, 31),
              count: 5,
              instanceClass: 'db.t3.small',
              region: 'us-west-2',
              multiAz: false,
              engine: 'mariadb',
              edition: 'standard',
              upfrontPayment: 'No Upfront',
              durationMonths: 12,
              type: 'actual'
            },
            pricingData: {} as any
          }
        ]
      };

      // Act
      const result = RiCategorizatorCalculator.categorizeRiPortfolio(mockRiPortfolio);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);
      
      const entries = Array.from(result.entries());
      const entry = entries[0];
      expect(entry[0].region).toBe('us-west-2');
      expect(entry[0].instanceClass).toBe('db.t3.small');
      expect(entry[0].deployment).toBe('single-az');
      expect(entry[0].engineKey).toBe('mariadb');
      expect(entry[1]).toBe(5);
    });
  });
});