# Plan: Pull-Based Chart Data Architecture with On-Demand Aggregation

Refactor the architecture from push-based (service calculates and pushes all variants) to pull-based (chart requests specific aggregation when needed). This enables unlimited chart configurations without pre-calculating every scenario upfront.

## Steps

### 1. Create `AggregationRequest` model and add on-demand calculation method to `RiCostAggregationService`

Define `AggregationRequest` interface with fields: `groupingMode: 'ri-type' | 'cost-type'`, `renewalOptions?: { upfrontPayment: 'No Upfront' | 'Partial Upfront' | 'All Upfront', durationMonths: 12 | 36 }`. Add `calculateAggregation(rows: RiRow[], pricingRecords: PricingRecord[], request: AggregationRequest)` method that routes to either `aggregateMonthlyCostsByRiType()` or new `aggregateMonthlyCostsByCostType()` based on `groupingMode`. This method becomes the single entry point for all aggregation requests.

### 2. Refactor `MonthlyCostChartService` to expose source data instead of pre-calculated aggregates

Remove `baselineChartData$` and `renewalChartData$` BehaviorSubjects. Add `sourceData$: Observable<{rows: RiRow[], pricingRecords: PricingRecord[], error: string | null, missingPricing: string[]}>` that emits when RI portfolio loads. Add `requestAggregation(request: AggregationRequest): Observable<ChartData>` method that takes aggregation request, calls `riCostAggregationService.calculateAggregation()`, wraps result in `calculateChartData()`, and returns as cold observable.

### 3. Update `MonthlyCostChartComponent` to pull data on-demand

Remove subscriptions to pre-calculated observables. In `ngOnInit()`, subscribe to `monthlyCostChartService.sourceData$` to detect when data is available. When data loads, create `AggregationRequest` objects for baseline (no renewal options) and renewal (with specific renewal options). Call `monthlyCostChartService.requestAggregation()` for each request and subscribe to render charts. Store subscriptions for cleanup in `ngOnDestroy()`.

### 4. Add `switchGroupingMode()` method to handle toggle changes

Add `groupingMode: 'ri-type' | 'cost-type' = 'ri-type'` property. Create `switchGroupingMode(mode)` handler that updates property, unsubscribes from existing chart data streams, creates new `AggregationRequest` objects with updated `groupingMode`, requests new aggregations via `requestAggregation()`, and re-renders charts with fresh data.

### 5. Implement `aggregateMonthlyCostsByCostType()` in `RiCostAggregationService`

Rename existing `aggregateMonthlyCosts()` method to `aggregateMonthlyCostsByRiType()` for consistency. Add new `aggregateMonthlyCostsByCostType()` method that reuses existing RI processing logic but groups by cost type ("Savings Upfront", "Savings Monthly", "On Demand Monthly"). Iterate through all RIs, extract upfront costs from `details.upfront` field (first month only) into "Savings Upfront", recurring costs from `details.recurringCost` (all months) into "Savings Monthly". For renewals, check `renewalOptions.upfrontPayment`: if "All Upfront", allocate to "Savings Upfront" in first renewal month; if "Partial Upfront" or "No Upfront", split appropriately. All on-demand costs go to "On Demand Monthly".

### 6. Add UI toggle for grouping mode in template

Add radio button group in `monthly-cost-chart.component.html` above charts with options "Group by RI Type" and "Group by Cost Type". Bind to `groupingMode` property with `[(ngModel)]` or click handlers. Style consistently with existing UI components using Tailwind CSS classes.

## Further Considerations

### 1. Caching strategy for aggregation results

Should the service cache aggregation results to avoid recalculating same request? 

**Recommendation:** Start without caching (simpler), add caching later if performance becomes an issue. Use `shareReplay(1)` on aggregation observables if same request is made multiple times.

### 2. Error handling for failed aggregations

How should components handle errors from `requestAggregation()`? 

**Recommendation:** Return errors as part of `ChartData` structure (existing pattern), components display error message in UI instead of chart. Maintain existing error tracking in `RiCostAggregationService.lastErrors`.

### 3. Multiple charts with different configurations

Should component support multiple chart instances with different aggregation requests? 

**Recommendation:** Yes, component can create multiple `AggregationRequest` objects and manage separate subscriptions. This enables future scenarios like side-by-side comparison charts with different grouping modes or renewal options.

## Architecture Benefits

- **Scalability**: Add unlimited chart configurations without service changes
- **Flexibility**: Each chart can request exactly the aggregation it needs
- **Performance**: Only calculate aggregations that are actually displayed
- **Maintainability**: Clear separation between data loading and data transformation
- **Testability**: Easy to test aggregation logic in isolation with specific requests
