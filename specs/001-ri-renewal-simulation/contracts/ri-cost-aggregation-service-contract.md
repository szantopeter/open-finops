# Service Contract: RiCostAggregationService

**Feature**: 001-ri-renewal-simulation  
**Date**: 2025-11-12  
**Status**: Complete

## Overview

This document defines the service contracts for the RiCostAggregationService extensions required for RI renewal cost simulation. The service provides cost aggregation with renewal projections.

## Method Contracts

### aggregateMonthlyCosts (Extended)

**Purpose**: Aggregate monthly RI costs including renewal projections.

**Signature**:
```typescript
aggregateMonthlyCosts(
  rows: RiRow[], 
  pricingRecords: PricingRecord[]
): Record<string, Record<string, MonthlyCostData>>
```

**Parameters**:
- `rows: RiRow[]` - Array of RI data rows from CSV import
- `pricingRecords: PricingRecord[]` - Array of pricing data records

**Returns**: 
- `Record<string, Record<string, MonthlyCostData>>` - Nested map of monthKey -> groupKey -> cost data

**Extended Behavior**:
- Detects expiring RIs and calculates renewal costs
- Adds `renewalCost` field to MonthlyCostData for months with renewals
- Tracks renewal-specific errors in `lastErrors.renewalErrors`

**Preconditions**:
- Pricing data must be loaded via `loadPricingData()` first
- Input arrays must not be null/undefined

**Postconditions**:
- All MonthlyCostData includes renewal projections where applicable
- Error tracking includes renewal calculation errors
- No side effects on input data

**Error Handling**:
- Individual RI calculation failures don't block other calculations
- Errors are tracked in service error arrays
- Invalid inputs throw exceptions

---

### calculateSavingsBreakdown (New)

**Purpose**: Calculate annual savings breakdown from aggregated cost data.

**Signature**:
```typescript
calculateSavingsBreakdown(
  monthlyData: Record<string, Record<string, MonthlyCostData>>
): SavingsBreakdown
```

**Parameters**:
- `monthlyData: Record<string, Record<string, MonthlyCostData>>` - Aggregated monthly cost data

**Returns**:
- `SavingsBreakdown` - Annual savings breakdown with year1/year2 split

**Behavior**:
- Determines current calendar year boundaries
- Sums savings for partial first year and full second year
- Creates descriptive labels for each year period

**Preconditions**:
- `monthlyData` contains valid MonthlyCostData objects
- Data spans at least current month through next calendar year

**Postconditions**:
- Returns valid SavingsBreakdown with correct calculations
- Year1 includes partial year from current month
- Year2 includes full calendar year

**Error Handling**:
- Invalid monthly data throws exceptions
- Missing savings data returns zero values

---

### detectExpiringRis (New)

**Purpose**: Identify RIs that expire within the projection period.

**Signature**:
```typescript
detectExpiringRis(
  rows: RiRow[],
  projectionStart: Date,
  projectionEnd: Date
): RiRow[]
```

**Parameters**:
- `rows: RiRow[]` - All RI data rows
- `projectionStart: Date` - Start of projection period
- `projectionEnd: Date` - End of projection period

**Returns**:
- `RiRow[]` - Array of RIs that expire within the projection period

**Behavior**:
- Filters RIs with endDate within projection range
- Includes RIs with no endDate (ongoing) as non-expiring

**Preconditions**:
- Valid Date objects for projection boundaries
- RiRow array is not null

**Postconditions**:
- Returns only RIs that will expire during projection
- Original array is not modified

---

### calculateRenewalProjection (New)

**Purpose**: Calculate renewal costs for a single expiring RI.

**Signature**:
```typescript
calculateRenewalProjection(
  originalRi: RiRow,
  pricingIndex: Map<string, PricingRecord>
): RenewalProjection | null
```

**Parameters**:
- `originalRi: RiRow` - The RI being renewed
- `pricingIndex: Map<string, PricingRecord>` - Loaded pricing data index

**Returns**:
- `RenewalProjection | null` - Renewal calculation result or null if calculation fails

**Behavior**:
- Creates renewal with same criteria as original RI
- Sets renewal start date to month after expiration
- Matches pricing using existing criteria
- Calculates monthly renewal cost

**Preconditions**:
- RI has valid endDate
- Pricing index is populated
- RI matches existing pricing criteria

**Postconditions**:
- Returns valid RenewalProjection or null
- Pricing match uses same logic as original RI calculation

**Error Handling**:
- Returns null for pricing mismatches
- Logs errors to renewalErrors array
