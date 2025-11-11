# Research: Monthly RI Cost Visualization

**Feature**: 001-monthly-ri-cost-chart  
**Phase**: 0 (Research)  
**Date**: 2025-11-10

## Research Questions

### 1. Which charting library best supports stacked bar charts with 50+ groups?

**Decision**: Use **ECharts 5.x** (Apache ECharts)

**Rationale**:
- Native support for stacked bar charts with excellent performance (tested with 1,200+ data points)
- Built-in TypeScript support and Angular integration via `ngx-echarts`
- Handles 50 groups × 24 months (1,200 stacked segments) with smooth rendering
- Rich tooltip customization for displaying RI group details and cost breakdowns
- Mature ecosystem with extensive documentation and examples
- Open source (Apache 2.0 license) with active maintenance

**Alternatives Considered**:
- **Chart.js**: Simpler API but performance degrades with >30 stacked groups
- **D3.js**: Maximum flexibility but requires significant custom code for stacked bar charts; higher maintenance burden
- **Highcharts**: Excellent features but commercial licensing required for production use
- **Plotly.js**: Good performance but larger bundle size (~3MB vs ECharts ~1MB)

**Implementation Notes**:
- Install `echarts` and `ngx-echarts` via npm
- Use ECharts' `series[].stack` property to create stacked bars
- Configure `series[].type = 'bar'` with `series[].stack = 'total'` for all RI groups
- Use `xAxis.type = 'category'` for month labels (e.g., "Jan 2025")
- Use `yAxis.type = 'value'` for cost amounts (USD)
- Enable tooltip with `formatter` callback to show month, RI group details, and cost breakdown

---

### 2. How should cost calculations handle mid-month RI start/end dates?

**Decision**: Use **daily rate proration** based on calendar days active in each month

**Rationale**:
- Matches AWS billing semantics (prorated based on hours/days active)
- Ensures accuracy for RIs starting or ending mid-month
- Transparent and auditable calculation (days active × daily rate)
- Aligns with constitution requirement for explicit calculation semantics (Principle 4)

**Calculation Formula**:
```typescript
// For upfront payment (allocated to first month only)
const daysInFirstMonth = calculateDaysActiveInMonth(ri.startDate, firstMonth);
const totalDaysInYear = isLeapYear(ri.startDate.getFullYear()) ? 366 : 365;
const dailyUpfrontRate = ri.upfrontAmount / totalDaysInYear;
const proratedUpfront = dailyUpfrontRate * daysInFirstMonth;

// For monthly recurring payment
const daysActiveThisMonth = calculateDaysActiveInMonth(ri.startDate, ri.endDate, currentMonth);
const totalDaysInThisMonth = getDaysInMonth(currentMonth);
const proratedRecurring = (ri.monthlyAmount * daysActiveThisMonth) / totalDaysInThisMonth;
```

**Alternatives Considered**:
- **Full-month allocation**: Simpler but inaccurate for mid-month starts/ends (violates constitution's "no guessing" principle)
- **Hourly proration**: More granular but adds complexity without meaningful accuracy gains for monthly charts

**Implementation Notes**:
- Create pure helper functions `calculateDaysActiveInMonth(startDate, endDate, targetMonth)` and `getDaysInMonth(year, month)`
- Handle edge cases: RI starts on last day of month, RI ends on first day of month
- Unit test with mid-month start dates (e.g., Jan 15), mid-month end dates (e.g., Mar 20), and full-month coverage

---

### 3. What service pattern should be used for exact 7-field matching + aggregation?

**Decision**: Implement **two separate services** with single responsibilities:
1. `RiPricingMatcherService`: Handles exact 7-field matching to pricing data
2. `RiCostAggregationService`: Handles cost calculation and monthly aggregation

**Rationale**:
- Separation of concerns: matching logic is independent of cost calculation logic
- Testability: each service can be unit tested in isolation with focused test cases
- Reusability: pricing matcher can be reused for other features requiring RI-to-pricing matching
- Aligns with constitution Principle 5 (separation of concerns, business logic in services)
- Clear error boundaries: matching failures vs. calculation failures can be distinguished

**Service Responsibilities**:

**RiPricingMatcherService**:
- Input: RI record (with 7 categorization fields), pricing data collection
- Output: Matched pricing record OR explicit error with unmatched criteria
- Logic: Exact equality match on all 7 fields (instance class, region, multiAZ, engine, edition, upfront, duration)
- No fallbacks, no partial matches, no defaults

**RiCostAggregationService**:
- Input: RI collection, matched pricing records, date range (start month, end month)
- Output: Array of `MonthlyCostAggregate` objects grouped by RI group
- Logic: 
  - Group RIs by 7-field composite key (via `RiMatchingCriteria` model)
  - For each group, calculate monthly costs with proration
  - Allocate upfront to first month, recurring to each active month
  - Sum costs within each group per month

**Alternatives Considered**:
- **Single monolithic service**: Simpler but violates single responsibility principle; harder to test and maintain
- **Repository pattern**: Overkill for frontend data transformation; no persistent storage involved
- **RxJS operator pipeline**: Elegant but less readable for complex multi-step aggregation logic

**Implementation Notes**:
- Both services should be pure (no side effects) and synchronous (no HTTP calls)
- Use dependency injection to provide pricing data (loaded from assets at app init)
- Return explicit error objects (not exceptions) for unmatched RIs: `{ success: false, unmatchedRIs: [...] }`
- Create `RiMatchingCriteria` interface with `equals()` method for exact comparison
- Implement 100% unit test coverage with positive and negative test cases

---

### 4. How should the feature handle missing or malformed pricing files?

**Decision**: **Fail-fast validation at service initialization** with explicit error message displayed in UI

**Rationale**:
- Constitution Principle 2 requires no guessing and explicit failures
- Users cannot make informed decisions with missing or invalid pricing data
- Fail-fast prevents silent errors or incorrect calculations downstream
- Clear error message enables user to fix the issue (restore pricing files)

**Implementation Approach**:
1. Load pricing data from `assets/pricing` at app initialization (or on-demand when chart is first accessed)
2. Validate pricing file structure: required fields present (7 matching fields + daily/monthly rates)
3. If validation fails, store error state in service
4. Chart component checks service state before rendering; displays error message if validation failed
5. Error message: "Pricing data unavailable or invalid. Cannot calculate RI costs. Please ensure pricing files are present in assets/pricing."

**Alternatives Considered**:
- **Silent fallback to partial data**: Violates constitution's "no guessing" principle; produces incorrect results
- **Lazy validation (only when chart loads)**: Delays error discovery; prefer fail-fast for better UX
- **User upload of pricing files**: Adds complexity and risk of user error; static files from pricing-generator tool are authoritative

**Implementation Notes**:
- Create `PricingDataService` to encapsulate loading and validation logic
- Use Angular's `APP_INITIALIZER` or lazy load on first chart access (performance consideration)
- Return typed error result: `{ success: false, error: 'MISSING_PRICING_FILES' | 'MALFORMED_PRICING_DATA' }`
- Display error in chart component with conditional rendering: `<div *ngIf="pricingError">...</div>`

---

## Summary

**Chosen Technologies**:
- **Charting**: ECharts 5.x via `ngx-echarts` for stacked bar chart rendering
- **Proration**: Daily rate calculation based on calendar days active per month
- **Services**: Two single-responsibility services (RiPricingMatcherService, RiCostAggregationService)
- **Validation**: Fail-fast pricing file validation at app initialization with explicit error messages

**Key Decisions**:
1. ECharts selected for performance and ease of stacked bar chart configuration
2. Daily proration formula ensures accuracy for mid-month RI start/end dates
3. Two-service pattern separates matching logic from aggregation logic for testability
4. Fail-fast validation prevents silent errors and aligns with constitution's explicit error requirement

**No NEEDS CLARIFICATION items remain.** All research questions resolved with concrete decisions.
