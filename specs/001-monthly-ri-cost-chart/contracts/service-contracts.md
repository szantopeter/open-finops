# Service Contracts: Monthly RI Cost Visualization

**Feature**: 001-monthly-ri-cost-chart  
**Phase**: 1 (Design)  
**Date**: 2025-11-10

## Overview

This document defines the service interfaces for the monthly RI cost chart feature. These contracts establish the API boundaries between services and ensure testability through explicit input/output types.

---

## 1. RiPricingMatcherService

**Responsibility**: Match RI records to pricing data using exact 7-field matching. Returns matched pricing record or explicit error for unmatched RIs.

### Interface

```typescript
interface RiPricingMatcherService {
  /**
   * Loads pricing data from static files in assets/pricing.
   * Should be called once at service initialization or lazily on first use.
   * 
   * @returns Result indicating success or failure with error details
   */
  loadPricingData(): PricingDataLoadResult;

  /**
   * Matches a single RI record to pricing data using exact 7-field criteria.
   * 
   * @param ri - The RI record to match (from Cloudability CSV)
   * @param criteria - The 7-field matching criteria extracted from the RI
   * @returns Matched pricing record or error with unmatched criteria details
   */
  matchRiToPricing(
    ri: RiRecord,
    criteria: RiMatchingCriteria
  ): PricingMatchResult;

  /**
   * Batch matches multiple RI records to pricing data.
   * More efficient than calling matchRiToPricing repeatedly.
   * 
   * @param ris - Array of RI records to match
   * @returns Array of match results (success or error for each RI)
   */
  batchMatchRisToPricing(ris: RiRecord[]): PricingMatchResult[];
}
```

### Types

```typescript
interface PricingDataLoadResult {
  success: boolean;
  pricingRecords?: PricingRecord[];  // Available if success = true
  error?: PricingDataError;          // Available if success = false
}

type PricingDataError = 
  | { code: 'MISSING_FILES'; missingFiles: string[] }
  | { code: 'MALFORMED_DATA'; invalidFiles: string[]; details: string }
  | { code: 'LOAD_FAILED'; message: string };

interface PricingMatchResult {
  success: boolean;
  ri: RiRecord;                      // Original RI record
  criteria: RiMatchingCriteria;      // Criteria used for matching
  pricingRecord?: PricingRecord;     // Available if success = true
  error?: PricingMatchError;         // Available if success = false
}

interface PricingMatchError {
  code: 'NO_MATCH';
  criteria: RiMatchingCriteria;      // The criteria that couldn't be matched
  message: string;                   // Human-readable error (e.g., "No pricing found for db.m5.large in us-east-1...")
}
```

### Error Handling

- If pricing data cannot be loaded (missing/malformed files), `loadPricingData()` returns `{ success: false, error: {...} }`
- If an RI cannot be matched to pricing (no exact 7-field match), `matchRiToPricing()` returns `{ success: false, error: { code: 'NO_MATCH', ... } }`
- No exceptions are thrown; all errors are returned as explicit result objects

### Testing Contract

- **Unit tests must verify**:
  - Successful match when all 7 fields match exactly
  - Failed match when any of the 7 fields differ
  - Error returned for missing pricing data
  - Batch matching processes all RIs and returns correct results for each
  - Edge case: RI with empty/null fields triggers validation error before matching

---

## 2. RiCostAggregationService

**Responsibility**: Calculate monthly costs for RI groups with proration for mid-month start/end dates. Produces array of `MonthlyCostAggregate` objects for chart rendering.

### Interface

```typescript
interface RiCostAggregationService {
  /**
   * Groups RIs by exact 7-field matching criteria and calculates monthly costs.
   * 
   * @param ris - Array of RI records with matched pricing data
   * @param startMonth - First month to calculate costs for (Date, first day of month)
   * @param endMonth - Last month to calculate costs for (Date, first day of month)
   * @returns Array of monthly cost aggregates grouped by RI group and month
   */
  aggregateMonthlyCosts(
    ris: RiRecord[],
    pricingMatches: PricingMatchResult[],
    startMonth: Date,
    endMonth: Date
  ): CostAggregationResult;

  /**
   * Calculates prorated cost for a single RI in a specific month.
   * Handles mid-month start/end dates.
   * 
   * @param ri - The RI record to calculate costs for
   * @param pricing - The matched pricing record
   * @param month - The month to calculate costs for (Date, first day of month)
   * @returns Monthly cost breakdown (upfront, recurring, total)
   */
  calculateMonthlyCostForRi(
    ri: RiRecord,
    pricing: PricingRecord,
    month: Date
  ): MonthlyCostBreakdown;
}
```

### Types

```typescript
interface CostAggregationResult {
  success: boolean;
  aggregates?: MonthlyCostAggregate[];  // Available if success = true
  riGroups?: RiGroup[];                 // RI groups created during aggregation
  error?: CostAggregationError;         // Available if success = false
}

type CostAggregationError =
  | { code: 'UNMATCHED_RIS'; unmatchedRis: RiRecord[] }
  | { code: 'INVALID_DATE_RANGE'; message: string }
  | { code: 'CALCULATION_FAILED'; riId: string; message: string };

interface MonthlyCostBreakdown {
  month: Date;
  upfrontCost: number;     // Prorated upfront payment for this month (0 if not first month)
  recurringCost: number;   // Prorated monthly recurring payment
  totalCost: number;       // upfrontCost + recurringCost
  activeDays: number;      // Number of days RI was active in this month
}
```

### Calculation Rules

**Upfront Payment Proration**:
- Upfront payment is allocated only to the **first month** the RI is active
- If RI starts mid-month, upfront payment is prorated based on days active in first month:
  ```
  dailyUpfrontRate = upfrontAmount / daysInYear (365 or 366 for leap year)
  proratedUpfront = dailyUpfrontRate * daysActiveInFirstMonth
  ```

**Monthly Recurring Payment Proration**:
- Monthly payment is allocated to **every month** the RI is active
- If RI starts or ends mid-month, payment is prorated:
  ```
  proratedRecurring = (monthlyAmount * daysActiveThisMonth) / totalDaysInThisMonth
  ```

**Active Days Calculation**:
- Count calendar days where the RI is active in the target month
- RI is active from `startDate` (inclusive) to `endDate` (inclusive)
- Example: RI starts Jan 15, ends Feb 10 → Jan has 17 active days (15-31), Feb has 10 active days (1-10)

### Error Handling

- If any RI in the input array is unmatched (no pricing data), return `{ success: false, error: { code: 'UNMATCHED_RIS', unmatchedRis: [...] } }`
- If `startMonth > endMonth`, return `{ success: false, error: { code: 'INVALID_DATE_RANGE', message: '...' } }`
- If cost calculation fails for any RI (e.g., invalid dates), return `{ success: false, error: { code: 'CALCULATION_FAILED', ... } }`

### Testing Contract

- **Unit tests must verify**:
  - Correct grouping of RIs with identical 7-field criteria
  - Correct calculation of upfront payment allocated to first month only
  - Correct proration for mid-month start dates (e.g., Jan 15 start → 17 days active in Jan)
  - Correct proration for mid-month end dates (e.g., Feb 10 end → 10 days active in Feb)
  - Correct monthly recurring payment for full months and prorated months
  - Multiple RIs in same group have costs summed correctly
  - Edge case: RI starts on last day of month (1 day active)
  - Edge case: RI ends on first day of month (1 day active)
  - Edge case: RI active for full month (no proration)
  - Error returned for unmatched RIs
  - Error returned for invalid date range (start > end)

---

## 3. PricingDataService (Optional)

**Responsibility**: Load and validate pricing data from static files in `assets/pricing`. Provides pricing records to `RiPricingMatcherService`.

### Interface

```typescript
interface PricingDataService {
  /**
   * Loads all pricing files from assets/pricing directory.
   * Validates file structure and required fields.
   * 
   * @returns Result indicating success or failure with pricing records
   */
  loadPricingData(): Promise<PricingDataLoadResult>;

  /**
   * Returns cached pricing data if already loaded, otherwise loads it.
   * 
   * @returns Pricing records or null if not loaded
   */
  getPricingData(): PricingRecord[] | null;

  /**
   * Validates that all required pricing files exist and are well-formed.
   * 
   * @returns Validation result with details of any failures
   */
  validatePricingFiles(): PricingValidationResult;
}
```

### Types

```typescript
interface PricingValidationResult {
  valid: boolean;
  missingFiles?: string[];      // Files expected but not found
  invalidFiles?: string[];      // Files found but malformed
  errors?: string[];            // Detailed error messages
}
```

### Testing Contract

- **Unit tests must verify**:
  - Successful loading of valid pricing files
  - Error returned for missing pricing files
  - Error returned for malformed pricing files (missing required fields)
  - Cached pricing data returned on subsequent calls
  - Validation correctly identifies all missing/invalid files

---

## Service Dependencies

```
PricingDataService (loads pricing files)
    ↓ (provides pricing records to)
RiPricingMatcherService (matches RIs to pricing)
    ↓ (provides match results to)
RiCostAggregationService (calculates monthly costs)
    ↓ (provides aggregates to)
MonthlyCostChartComponent (renders chart)
```

---

## Constitution Compliance

All service contracts enforce constitution requirements:
- **Principle 2 (No guessing)**: All methods return explicit error objects for failures (no silent defaults)
- **Principle 3 (Exact matching)**: `RiPricingMatcherService` uses strict equality on all 7 fields
- **Principle 4 (Calculation semantics)**: `RiCostAggregationService` implements specified proration formulas
- **Principle 5 (Separation of concerns)**: Services have single responsibilities, no UI logic
- **Principle 7 (Testing)**: All methods have explicit testing contracts with required test cases
