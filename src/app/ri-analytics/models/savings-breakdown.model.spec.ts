import { SavingsBreakdown, SavingsYearData } from './savings-breakdown.model';

describe('SavingsBreakdown Models', () => {
  describe('SavingsYearData Interface', () => {
    it('should create a valid SavingsYearData object', () => {
      const yearData: SavingsYearData = {
        year: 2024,
        months: 6,
        totalSavings: 1500.50,
        label: 'Partial Year (6 months)'
      };

      expect(yearData.year).toBe(2024);
      expect(yearData.months).toBe(6);
      expect(yearData.totalSavings).toBe(1500.50);
      expect(yearData.label).toBe('Partial Year (6 months)');
    });

    it('should handle zero savings', () => {
      const yearData: SavingsYearData = {
        year: 2025,
        months: 12,
        totalSavings: 0,
        label: 'Full Year'
      };

      expect(yearData.totalSavings).toBe(0);
      expect(yearData.months).toBe(12);
    });

    it('should handle negative savings (losses)', () => {
      const yearData: SavingsYearData = {
        year: 2024,
        months: 3,
        totalSavings: -500.25,
        label: 'Q1 Loss'
      };

      expect(yearData.totalSavings).toBe(-500.25);
    });
  });

  describe('SavingsBreakdown Interface', () => {
    it('should create a valid SavingsBreakdown object', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 6,
          totalSavings: 1500.50,
          label: 'Partial Year (6 months)'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 3600.75,
          label: 'Full Year'
        },
        total: 5101.25
      };

      expect(breakdown.year1.year).toBe(2024);
      expect(breakdown.year1.months).toBe(6);
      expect(breakdown.year1.totalSavings).toBe(1500.50);
      expect(breakdown.year2.year).toBe(2025);
      expect(breakdown.year2.months).toBe(12);
      expect(breakdown.year2.totalSavings).toBe(3600.75);
      expect(breakdown.total).toBe(5101.25);
    });

    it('should handle zero total savings', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 12,
          totalSavings: 0,
          label: 'Full Year'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 0,
          label: 'Full Year'
        },
        total: 0
      };

      expect(breakdown.total).toBe(0);
      expect(breakdown.year1.totalSavings).toBe(0);
      expect(breakdown.year2.totalSavings).toBe(0);
    });

    it('should handle negative total savings', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 6,
          totalSavings: -800.00,
          label: 'Partial Year Loss'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 1200.00,
          label: 'Full Year'
        },
        total: 400.00
      };

      expect(breakdown.total).toBe(400.00);
      expect(breakdown.year1.totalSavings).toBe(-800.00);
      expect(breakdown.year2.totalSavings).toBe(1200.00);
    });

    it('should validate total equals sum of year savings', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 6,
          totalSavings: 1000.00,
          label: 'Partial Year'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 2000.00,
          label: 'Full Year'
        },
        total: 3000.00
      };

      const calculatedTotal = breakdown.year1.totalSavings + breakdown.year2.totalSavings;
      expect(breakdown.total).toBe(calculatedTotal);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle single month partial year', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 1,
          totalSavings: 100.00,
          label: 'Single Month'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 1200.00,
          label: 'Full Year'
        },
        total: 1300.00
      };

      expect(breakdown.year1.months).toBe(1);
      expect(breakdown.total).toBe(1300.00);
    });

    it('should handle leap year context', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024, // Leap year
          months: 12,
          totalSavings: 2400.00,
          label: 'Leap Year'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 2400.00,
          label: 'Regular Year'
        },
        total: 4800.00
      };

      expect(breakdown.year1.year).toBe(2024);
      expect(breakdown.year2.year).toBe(2025);
    });

    it('should handle very large savings amounts', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 12,
          totalSavings: 1000000.00,
          label: 'Large Savings'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 2000000.00,
          label: 'Even Larger Savings'
        },
        total: 3000000.00
      };

      expect(breakdown.total).toBe(3000000.00);
    });

    it('should handle decimal precision', () => {
      const breakdown: SavingsBreakdown = {
        year1: {
          year: 2024,
          months: 6,
          totalSavings: 1234.56,
          label: 'Precise Amount'
        },
        year2: {
          year: 2025,
          months: 12,
          totalSavings: 2469.13,
          label: 'Another Precise Amount'
        },
        total: 3703.69
      };

      expect(breakdown.year1.totalSavings).toBe(1234.56);
      expect(breakdown.year2.totalSavings).toBe(2469.13);
      expect(breakdown.total).toBe(3703.69);
    });
  });
});
