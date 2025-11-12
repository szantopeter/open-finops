# Research: RI Renewal Cost Simulation

**Feature**: 001-ri-renewal-simulation  
**Date**: 2025-11-12  
**Status**: Complete

## Overview

This document consolidates research findings for implementing RI renewal cost projections in the monthly cost chart. The feature extends existing cost aggregation logic to simulate renewal scenarios.

## Research Tasks

### Task 1: Calendar Year Boundary Handling

**Question**: How should the system determine projection ranges when spanning calendar year boundaries?

**Decision**: Calculate projections from current month through December 31 of the following year.

**Rationale**: 
- Provides at least one full calendar year of data regardless of current date
- Aligns with annual budgeting cycles
- Simplifies year-over-year comparisons

**Implementation approach**:
```typescript
// Pseudo-code
const today = new Date();
const currentYear = today.getFullYear();
const projectionStart = new Date(today.getFullYear(), today.getMonth(), 1);
const projectionEnd = new Date(currentYear + 1, 11, 31); // Dec 31 next year
```

**Alternatives considered**:
- Fixed 24-month projection: Rejected - doesn't align with calendar years
- Rolling 12 months: Rejected - doesn't provide full year breakdown

---

### Task 2: RI Renewal Logic

**Question**: How should the system determine when and how RIs are renewed?

**Decision**: 
- Renewal begins in the month following RI expiration (endDate month + 1)
- Renewed RIs use identical pricing criteria (same instanceClass, region, multiAz, engine, edition, upfrontPayment, durationMonths)
- Renewed RIs maintain the same count as the original

**Rationale**:
- Most conservative assumption - immediate renewal prevents coverage gaps
- Same conditions ensure pricing match reliability
- Matches real-world renewal behavior

**Implementation approach**:
- Detect expiration by checking if RI.endDate exists and falls within projection range
- Create virtual "renewed RI" entry with startDate = endDate + 1 month
- Use same pricing match criteria to find renewal costs

**Alternatives considered**:
- Renewal at exact expiration date: Rejected - complex month boundary handling
- Allow different renewal conditions: Rejected - out of scope, requires user input

---

### Task 3: Savings Breakdown by Year

**Question**: How should savings be calculated and displayed for partial vs full years?

**Decision**: 
- Year 1 (partial): Sum savings from current month through December 31 of current year
- Year 2 (full): Sum savings for all 12 months of following calendar year
- Display both values with clear labels

**Rationale**:
- Clear separation enables annualized comparison
- Matches financial reporting conventions
- Users can extrapolate partial year to full year equivalent

**Implementation approach**:
```typescript
interface SavingsBreakdown {
  year1: {
    year: number;           // e.g., 2025
    months: number;         // e.g., 6 (if starting in July)
    totalSavings: number;
    label: string;          // e.g., "2025 (Jul-Dec)"
  };
  year2: {
    year: number;           // e.g., 2026
    months: 12;
    totalSavings: number;
    label: string;          // e.g., "2026 (Full Year)"
  };
  total: number;
}
```

**Alternatives considered**:
- Monthly breakdown: Rejected - too granular for summary view
- Annualized projection: Rejected - loses partial year context

---

### Task 4: Chart Visualization Strategy

**Question**: How should the 3rd bar be displayed and differentiated in ECharts?

**Decision**:
- Add renewal data as third series in stacked bar chart
- Use distinct color (e.g., light blue/cyan) to differentiate from RI (blue) and On-Demand (orange)
- Show renewal bar only for months with renewals
- Update tooltip to show all three values

**Rationale**:
- Consistent with existing two-bar pattern
- Visual differentiation prevents confusion
- Selective display keeps chart clean

**Implementation approach**:
- Extend MonthlyCostData model with `renewalCost?: number`
- Add third series to ECharts configuration
- Filter renewal series to show only non-zero values
- Update tooltip formatter to include renewal costs

**Alternatives considered**:
- Separate chart: Rejected - harder to compare
- Line overlay: Rejected - bar chart more consistent
- Replace RI bar with renewal: Rejected - loses current state visibility

---

### Task 5: Error Handling for Renewal Calculations

**Question**: How should the system handle errors specific to renewal calculations?

**Decision**: Extend existing error tracking with renewal-specific categories:
- Missing pricing for renewal terms
- Invalid expiration dates preventing renewal calculation
- Renewal extending beyond projection range

**Rationale**:
- Consistent with existing error tracking (unmatchedPricing, invalidPricing, etc.)
- Maintains constitution principle of explicit error reporting
- Allows users to identify and fix data issues

**Implementation approach**:
- Add `renewalErrors` array to existing error tracking structure
- Flag but don't block when individual RIs can't be renewed
- Display error summary in UI alongside existing error displays

**Alternatives considered**:
- Silent failure: Rejected - violates constitution
- Block all calculations: Rejected - too restrictive
- Generic error messages: Rejected - not actionable

---

## Best Practices Applied

### Angular/TypeScript
- Maintain strict type safety with explicit interfaces for renewal data
- Use OnPush change detection for performance
- Leverage RxJS for reactive data flow
- Keep business logic in services, UI logic in components

### ECharts Integration
- Extend existing chart configuration rather than replacing
- Use series data filtering for conditional display
- Maintain consistent color scheme and styling
- Optimize data structure for chart consumption

### Testing Strategy
- TDD approach: Write tests before implementation
- Unit test renewal calculation logic in isolation
- Test calendar boundary edge cases
- Test error scenarios (missing pricing, invalid dates)
- Component tests for chart rendering

### Performance Considerations
- Calculate renewals on-demand during aggregation (no pre-processing)
- Reuse existing pricing index for renewal matching
- Minimize chart re-renders with OnPush detection
- Use existing in-memory calculation approach

---

## Implementation Dependencies

### Existing Code to Extend
1. `RiCostAggregationService.aggregateMonthlyCosts()` - add renewal calculation logic
2. `MonthlyCostData` model - add renewalCost field
3. `MonthlyCostChartComponent` - add 3rd chart series and tooltip updates
4. Error tracking structure - add renewal error categories

### New Utilities Needed
1. Calendar year boundary calculation helper
2. RI expiration detection logic
3. Savings breakdown calculation function

### No External Dependencies
- All functionality uses existing libraries (Angular, RxJS, ECharts)
- No new npm packages required

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance degradation with large datasets | Reuse existing pricing index, calculate renewals incrementally during aggregation |
| Calendar edge cases (leap years, month boundaries) | Use native Date UTC methods, comprehensive unit tests |
| Pricing data gaps for renewals | Explicit error tracking, continue calculations with available data |
| Chart rendering complexity | Extend existing ECharts config incrementally, test with real data |
| User confusion about renewal assumptions | Clear UI labels, tooltip explanations, documentation |

---

## Open Questions

None - all technical uncertainties resolved through research.

---

## Next Steps

Proceed to Phase 1: Design & Contracts
- Define data model extensions
- Document calculation contracts
- Create quickstart guide
