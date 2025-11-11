# Data Model: Monthly RI Cost Visualization

**Feature**: 001-monthly-ri-cost-chart  
**Phase**: 1 (Design)  
**Date**: 2025-11-10

## Entity Overview

This feature introduces four core entities to support exact 7-field matching, cost aggregation, and chart rendering:

1. **RiMatchingCriteria** — Composite key for exact matching (7 fields)
2. **PricingRecord** — Pricing data from static files (`assets/pricing`)
3. **RiGroup** — Collection of RIs with identical matching criteria
4. **MonthlyCostAggregate** — Monthly cost obligation for a specific RI group

---

## Entity Definitions

### 1. RiMatchingCriteria

**Purpose**: Represents the composite key of seven fields required for exact RI-to-pricing matching. Used to group RIs and match to pricing records.

**Fields**:
- `instanceClass: string` — RDS instance class (e.g., "db.m5.large")
- `region: string` — AWS region (e.g., "us-east-1")
- `multiAZ: boolean` — Multi-AZ deployment flag
- `engine: string` — Database engine (e.g., "postgresql")
- `edition: string` — Engine edition (e.g., "standard")
- `upfrontPayment: string` — Upfront payment type (e.g., "all-upfront", "partial-upfront", "no-upfront")
- `duration: number` — RI duration in months (e.g., 12, 36)

**Validation Rules**:
- All fields are required (no null or undefined values)
- `instanceClass`, `region`, `engine`, `edition`, `upfrontPayment` must be non-empty strings
- `multiAZ` must be a boolean (true or false)
- `duration` must be a positive integer (> 0)

**Methods**:
- `equals(other: RiMatchingCriteria): boolean` — Returns true if all seven fields match exactly (strict equality for strings, booleans, numbers)
- `toKey(): string` — Returns a stable string representation for use as map keys (e.g., `"db.m5.large|us-east-1|true|postgresql|standard|all-upfront|36"`)

**Relationships**:
- Used by `PricingRecord` to identify which RI configurations a pricing entry applies to
- Used by `RiGroup` to define the grouping criteria
- Used by `RiPricingMatcherService` to perform exact matching

---

### 2. PricingRecord

**Purpose**: Represents pricing data for a specific RI configuration. Loaded from static files in `assets/pricing`. Used to calculate upfront and recurring costs.

**Fields**:
- `criteria: RiMatchingCriteria` — The 7-field composite key this pricing applies to
- `upfrontAmount: number` — Upfront payment amount in USD (0 for no-upfront RIs)
- `monthlyRecurringAmount: number` — Monthly recurring payment in USD
- `onDemandDailyRate: number` — Daily on-demand rate in USD (for cost comparison, optional for this feature)
- `sourceFile: string` — Name of the pricing file this record was loaded from (for audit/debug)

**Validation Rules**:
- `criteria` must be a valid `RiMatchingCriteria` object (all fields present and valid)
- `upfrontAmount` must be >= 0
- `monthlyRecurringAmount` must be >= 0
- At least one of `upfrontAmount` or `monthlyRecurringAmount` must be > 0 (pricing must have a cost)
- `sourceFile` must be a non-empty string

**Relationships**:
- One `PricingRecord` corresponds to one unique `RiMatchingCriteria`
- Many `RiGroup` entities may reference the same `PricingRecord` (if multiple RIs share the same criteria)

**State Transitions**: None (immutable once loaded)

---

### 3. RiGroup

**Purpose**: Represents a collection of RIs that share identical matching criteria. Used as the grouping dimension for stacked bar chart segments.

**Fields**:
- `criteria: RiMatchingCriteria` — The 7-field composite key that defines this group
- `riRecords: RiRecord[]` — Array of RI records that belong to this group (from Cloudability CSV)
- `pricingRecord: PricingRecord` — The matched pricing data for this group
- `label: string` — Human-readable label for chart legend (e.g., "db.m5.large | us-east-1 | Multi-AZ | PostgreSQL | Standard | All-Upfront | 36mo")

**Validation Rules**:
- `criteria` must be a valid `RiMatchingCriteria` object
- `riRecords` must be a non-empty array (at least one RI in the group)
- `pricingRecord` must be present (groups with unmatched pricing should fail before grouping)
- All `riRecords` must have matching criteria that equal `criteria` (verified by `RiMatchingCriteria.equals()`)

**Methods**:
- `calculateMonthlyCosts(startMonth: Date, endMonth: Date): MonthlyCostAggregate[]` — Returns array of monthly cost aggregates for this group across the date range
- `getTotalRiCount(): number` — Returns sum of `count` field from all `riRecords` in the group

**Relationships**:
- One `RiGroup` has one `RiMatchingCriteria` (defines grouping)
- One `RiGroup` has many `RiRecord` instances (from CSV import)
- One `RiGroup` references one `PricingRecord` (for cost calculation)
- One `RiGroup` produces many `MonthlyCostAggregate` instances (one per month in date range)

**State Transitions**: None (immutable once created)

---

### 4. MonthlyCostAggregate

**Purpose**: Represents the total cost obligation for a specific RI group in a specific month. Used as the data source for stacked bar chart segments.

**Fields**:
- `month: Date` — The month this aggregate applies to (always first day of month, e.g., `2025-01-01`)
- `riGroup: RiGroup` — Reference to the RI group this aggregate represents
- `upfrontCost: number` — Prorated upfront payment allocated to this month (USD)
- `recurringCost: number` — Prorated monthly recurring payment allocated to this month (USD)
- `totalCost: number` — Sum of `upfrontCost` and `recurringCost` (USD)
- `activeDays: number` — Number of days this RI group was active in this month (for audit/debug)

**Validation Rules**:
- `month` must be a valid Date object (first day of month)
- `riGroup` must be a valid `RiGroup` object
- `upfrontCost` must be >= 0
- `recurringCost` must be >= 0
- `totalCost` must equal `upfrontCost + recurringCost`
- `activeDays` must be > 0 and <= number of days in the month

**Methods**:
- `getChartLabel(): string` — Returns formatted month label for chart x-axis (e.g., "Jan 2025")
- `getTooltipText(): string` — Returns formatted text for chart tooltip (e.g., "db.m5.large group: $1,234.56 (15 days active)")

**Relationships**:
- Many `MonthlyCostAggregate` instances belong to one `RiGroup` (one per month)
- One `MonthlyCostAggregate` represents costs for one month

**State Transitions**: None (immutable once calculated)

---

## Entity Relationships Diagram (Text)

```
RiMatchingCriteria (7-field composite key)
    ↑ (used by)
    |
    +-- PricingRecord (pricing data from assets/pricing)
    |       ↑ (referenced by)
    |       |
    +-- RiGroup (collection of RIs with same criteria)
            ↓ (produces)
            |
        MonthlyCostAggregate (monthly cost for group)
```

**Cardinality**:
- 1 `RiMatchingCriteria` → 1 `PricingRecord` (exact match required)
- 1 `RiMatchingCriteria` → Many `RiGroup` instances (if multiple groups of RIs exist with same criteria, though typically 1:1)
- 1 `RiGroup` → Many `MonthlyCostAggregate` instances (one per month in date range)

---

## Storage Considerations

### Persistence Strategy

**Cached Data** (optional performance optimization):
- **Key**: `ri-monthly-chart:v1`
- **Value**: Array of `MonthlyCostAggregate` objects (JSON serialized)
- **Storage**: IndexedDB via `idb-keyval`
- **Invalidation**: When new RI import is uploaded OR pricing files are updated
- **Rationale**: Avoid recalculating aggregates on every chart render for large datasets (500 RIs × 24 months)

**Filter Preferences** (user state):
- **Key**: `ri-chart-filters:v1`
- **Value**: `{ startMonth: string, endMonth: string }` (ISO date strings)
- **Storage**: localStorage (small synchronous data)
- **Invalidation**: Never (user preference persists across sessions)
- **Rationale**: Remember user's selected time range for better UX

### Migration Strategy

If schema changes in the future (e.g., adding new fields to `MonthlyCostAggregate`):
1. Bump storage key version (e.g., `ri-monthly-chart:v2`)
2. Implement migration function in `StorageService` to read `v1` data and transform to `v2` format
3. Delete old `v1` key after successful migration
4. Update constitution document with migration changelog

---

## Validation Summary

All entities enforce strict validation rules to prevent invalid states:
- No null/undefined values in required fields
- Numeric fields (costs, days, durations) must be non-negative and sensible (e.g., days <= days in month)
- Composite keys (matching criteria) must have all 7 fields present
- Relationships must be valid (e.g., all RIs in a group match the group's criteria)

Error handling:
- Invalid entities trigger explicit errors (not silent failures)
- Validation failures are surfaced to UI with clear messages
- Constitution Principle 2 (no guessing) enforced at model level
