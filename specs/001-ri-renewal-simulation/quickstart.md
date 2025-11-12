# Quick Start: RI Renewal Cost Simulation

**Feature**: 001-ri-renewal-simulation  
**Date**: 2025-11-12  
**Status**: Ready for Implementation

## Overview

This guide provides a quick start for implementing the RI renewal cost simulation feature. The feature adds a third bar to the monthly cost chart showing projected costs if all RIs were renewed upon expiration.

## Prerequisites

- Angular 20+ development environment
- Existing RI cost aggregation service
- ECharts integration for chart visualization
- TypeScript 5.8+ with strict mode

## Implementation Steps

### 1. Extend Data Models (5 minutes)

Add renewal cost field to `MonthlyCostData` model:

```typescript
// src/app/ri-analytics/models/monthly-cost-data.model.ts
export interface MonthlyCostData {
  monthKey: string;
  groupKey: string;
  riCost: number;
  onDemandCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  details: MonthlyCostDetail[];
  renewalCost?: number; // Add this field
}
```

### 2. Extend Service Error Tracking (10 minutes)

Add renewal errors to the service error structure:

```typescript
// src/app/ri-analytics/services/ri-cost-aggregation.service.ts
public lastErrors: {
  // ... existing error types
  renewalErrors: Array<{ key: string; row: any; reason: string }>; // Add this
} = {
  // ... existing initializations
  renewalErrors: [] // Add this
};
```

### 3. Implement Renewal Detection Logic (15 minutes)

Add method to detect expiring RIs:

```typescript
// In RiCostAggregationService
private detectExpiringRis(rows: RiRow[], projectionEnd: Date): RiRow[] {
  return rows.filter(row => {
    if (!row.endDate) return false; // Ongoing RIs don't expire
    const endDate = new Date(row.endDate + 'T00:00:00Z');
    return endDate <= projectionEnd;
  });
}
```

### 4. Extend Cost Aggregation (30 minutes)

Modify `aggregateMonthlyCosts` to include renewal calculations:

```typescript
// In aggregateMonthlyCosts method, after existing logic:
const expiringRis = this.detectExpiringRis(rows, projectionEnd);
for (const expiringRi of expiringRis) {
  // Calculate renewal costs starting from expiration month + 1
  // Add renewalCost to appropriate MonthlyCostData entries
  // Track errors in lastErrors.renewalErrors
}
```

### 5. Update Chart Component (20 minutes)

Extend chart to display third bar:

```typescript
// In MonthlyCostChartComponent
private getChartOptions(): EChartsOption {
  // Add third series for renewal costs
  // Use distinct color (e.g., '#00BCD4' - cyan)
  // Update tooltip formatter to show all three values
  // Filter renewal series to show only non-zero values
}
```

### 6. Add Savings Breakdown Calculation (15 minutes)

Implement annual savings breakdown:

```typescript
// Add to RiCostAggregationService
calculateSavingsBreakdown(monthlyData: Record<string, Record<string, MonthlyCostData>>): SavingsBreakdown {
  // Calculate year boundaries
  // Sum savings for partial first year and full second year
  // Return structured breakdown
}
```

## Testing Checklist

- [ ] Load RI data with expiring RIs - verify 3rd bar appears
- [ ] Check tooltip shows RI, On-Demand, and Renewal costs
- [ ] Verify renewal starts in month after expiration
- [ ] Test with no expiring RIs - no 3rd bar shown
- [ ] Validate savings breakdown calculations
- [ ] Test error handling for missing renewal pricing

## Key Integration Points

1. **Data Flow**: RI data → Aggregation Service → Extended MonthlyCostData → Chart Component
2. **Error Handling**: Renewal errors tracked alongside existing error types
3. **UI Updates**: Chart tooltip and legend updated to include renewal information
4. **Performance**: Calculations performed on-demand, no persistent storage changes

## Common Pitfalls

- **Calendar Boundaries**: Ensure renewal projections span full calendar years
- **Pricing Matching**: Renewal uses identical criteria to original RI
- **Error Tracking**: Don't block calculations for individual renewal failures
- **Chart Rendering**: Filter out zero renewal values to avoid empty bars

## Validation Commands

```bash
# Run unit tests for service extensions
npm run test -- --include="**/ri-cost-aggregation.service.spec.ts"

# Run component tests for chart updates  
npm run test -- --include="**/monthly-cost-chart.component.spec.ts"

# Build and verify no compilation errors
npm run build

# Run linting to ensure code quality
npm run lint
```

## Next Steps

1. Implement the data model extensions
2. Add renewal detection and calculation logic
3. Update chart visualization
4. Add comprehensive tests
5. Update UI labels and documentation
