# Quickstart: On-Demand Cost Comparison in Monthly Chart

## Overview

This feature adds on-demand cost bars to the monthly RI cost chart, providing side-by-side comparison with savings analysis.

## Prerequisites

- Angular 20+ development environment
- ECharts 5+ library installed
- Access to Cloudability CSV export and pricing data files

## Implementation Steps

1. **Extend RiCostAggregationService**:
   - Add on-demand cost calculation logic
   - Include savings amount and percentage in result model
   - Update aggregation to handle both RI and on-demand costs

2. **Update MonthlyCostChartComponent**:
   - Modify chart configuration for grouped bars
   - Add tooltip formatter for savings display
   - Add total savings percentage display

3. **Update Data Models**:
   - Extend MonthlyCostData interface with onDemandCost, savingsAmount, savingsPercentage
   - Ensure PricingRecord includes dailyOnDemandRate

4. **Error Handling**:
   - Modify component to show error messages instead of partial data
   - Update aggregation service to throw errors on unmatched pricing

## Testing

- Unit tests for cost calculations (100% coverage)
- Component tests for chart rendering and tooltips
- Integration tests with sample data

## Key Files Modified

- `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
- `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts`
- `src/app/ri-analytics/models/monthly-cost-data.model.ts`