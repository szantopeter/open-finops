# Data Model: RI Renewal Cost Simulation

**Feature**: 001-ri-renewal-simulation  
**Date**: 2025-11-12  
**Status**: Complete

## Overview

This document defines the data model extensions and entities required for the RI renewal cost simulation feature. The feature extends existing cost aggregation and chart visualization to include renewal projections.

## Existing Entities (Extended)

### MonthlyCostData (Extended)

**Purpose**: Represents monthly cost data for chart visualization, extended to include renewal costs.

**Current Fields**:
- `monthKey: string` - Month identifier (YYYY-MM format)
- `groupKey: string` - Human-readable grouping key
- `riCost: number` - Reserved Instance cost for the month
- `onDemandCost: number` - On-demand cost for the month
- `savingsAmount: number` - Savings amount (onDemand - riCost)
- `savingsPercentage: number` - Savings percentage
- `details: MonthlyCostDetail[]` - Detailed breakdown

**New Fields**:
- `renewalCost?: number` - Renewal cost projection for the month (undefined if no renewals)

**Validation Rules**:
- `renewalCost` must be >= 0 when present
- `renewalCost` should only be present for months with RI expirations
- All numeric fields must be finite numbers

**State Transitions**: No state transitions - this is a data transfer object.

---

### RiCostAggregationService Error Tracking (Extended)

**Purpose**: Tracks calculation errors, extended to include renewal-specific errors.

**Current Structure**:
```typescript
lastErrors: {
  unmatchedPricing: Array<{ key: string; row: any; reason: string }>;
  invalidPricing: Array<{ key: string; row: any; reason: string }>;
  missingRates: Array<{ key: string; row: any; pricing: any; reason: string }>;
  zeroActiveDays: Array<{ key: string; row: any; monthKey: string; activeDays: number; reason: string }>;
  zeroCount: Array<{ key: string; row: any; reason: string }>;
}
```

**New Fields**:
- `renewalErrors: Array<{ key: string; row: any; reason: string }>` - Errors specific to renewal calculations

**Validation Rules**:
- All error entries must include `key`, `row`, and `reason` fields
- `row` must contain sanitized RI data (no sensitive fields)
- Error arrays should be capped to prevent memory issues

---

## New Entities

### SavingsBreakdown

**Purpose**: Represents the annual savings breakdown for display in the UI.

**Fields**:
- `year1: SavingsYearData` - First year (partial) savings data
- `year2: SavingsYearData` - Second year (full) savings data  
- `total: number` - Total savings across both years

**Validation Rules**:
- `year1.months` must be between 1-12
- `year2.months` must equal 12
- All numeric fields must be finite numbers
- `total` must equal `year1.totalSavings + year2.totalSavings`

---

### SavingsYearData

**Purpose**: Represents savings data for a single calendar year.

**Fields**:
- `year: number` - Calendar year (e.g., 2025)
- `months: number` - Number of months included (1-12)
- `totalSavings: number` - Total savings for this year
- `label: string` - Human-readable label (e.g., "2025 (Jul-Dec)")

**Validation Rules**:
- `year` must be a valid 4-digit year (>= 2020)
- `months` must be between 1-12
- `totalSavings` must be a finite number
- `label` must be non-empty and descriptive

---

### RenewalProjection

**Purpose**: Internal data structure for renewal calculation logic.

**Fields**:
- `originalRi: RiRow` - Reference to the original RI being renewed
- `renewalStart: Date` - When the renewal begins (month after expiration)
- `renewalEnd?: Date` - When the renewal ends (calculated from duration)
- `pricing: PricingRecord` - Matched pricing for the renewal
- `monthlyCost: number` - Calculated monthly renewal cost

**Validation Rules**:
- `renewalStart` must be after `originalRi.endDate`
- `pricing` must match the original RI criteria
- `monthlyCost` must be >= 0

---

## Entity Relationships

```
RiRow (existing)
├── Has many → MonthlyCostData (via aggregation)
├── Has many → RenewalProjection (calculated)
└── Referenced in → Error entries

PricingRecord (existing)
├── Matched to → RiRow (for original costs)
└── Matched to → RenewalProjection (for renewal costs)

MonthlyCostData (extended)
├── Contains → SavingsBreakdown (calculated)
└── Displayed in → MonthlyCostChartComponent

SavingsBreakdown
├── Contains → SavingsYearData (year1, year2)
└── Displayed in → UI components (TBD)
```

## Data Flow

1. **Input**: RiRow[] + PricingRecord[] (existing)
2. **Processing**: 
   - AggregateMonthlyCosts() creates MonthlyCostData[] (extended)
   - Detect expiring RIs and create RenewalProjection[]
   - Calculate renewal costs and add to MonthlyCostData
3. **Output**: 
   - MonthlyCostData[] with renewalCost field
   - SavingsBreakdown calculated from aggregated data
   - Error tracking includes renewal-specific errors

## Migration Considerations

**Versioning**: No storage changes required - all calculations are derived on-demand.

**Backward Compatibility**: 
- Existing MonthlyCostData consumers will see `renewalCost: undefined` for months without renewals
- Error tracking extensions are additive - existing error types remain unchanged

**Data Validation**:
- All new fields are optional or have sensible defaults
- Existing validation logic remains intact
- New validation rules are additive and don't break existing flows

## Testing Considerations

**Unit Tests**:
- Validate SavingsBreakdown calculation logic
- Test RenewalProjection creation and validation
- Verify MonthlyCostData extensions don't break existing consumers

**Integration Tests**:
- End-to-end renewal calculation with sample data
- Chart rendering with renewal data
- Error handling for renewal edge cases

**Performance Tests**:
- Memory usage with large datasets including renewals
- Calculation time for complex renewal scenarios
