Conversation summary and plan for adding FirstFullYear helper and monthly spending tables

Summary
- Implemented firstFullYear logic in `RiRenewalComparisonService` to compute the first full calendar year when renewed RIs cover a whole year.
- Added `projectionEndYear` to `AggregationRequest` and threaded into `RiCostAggregationService` so aggregations can be produced up to a target year.
- `RiImportPreviewComponent` now shows the most distant RI expiry date.
- Fixed tests for renewal comparison and import preview; focused tests pass.
- Full test suite had 2 failures due to `PricingDataService` being invoked without mocks (tests tried to load assets). Recommendation: mock `PricingDataService` for unit tests or add small fixture pricing files under `src/assets/pricing`.

Planned Work
1. Add shared `FirstFullYearService` with utilities:
   - `computeFirstFullYear(riRows: RiRow[]): number`
   - `monthsForYear(year: number): string[]` (returns month id strings like `2025-01`)
2. Add `RiMonthlySpendingTablesComponent` (standalone Angular component):
   - Inputs: `renewalScenarios`, `baselineAggregation`, `firstFullYear` (or it can read from services)
   - For each scenario, render a table with one row per month in the firstFullYear, columns: `month`, `onDemand`, `reservedMonthlyCost`, `total`, `savings`.
   - Use aggregation API with `projectionEndYear` to ensure months are available.
3. Insert the component below `<app-ri-renewal-comparison>` in `src/app/components/landing/landing.component.html`.
4. Add unit tests:
   - `FirstFullYearService` tests for boundary cases.
   - `RiMonthlySpendingTablesComponent` shallow test rendering the tables with mock aggregation data.
5. Fix full test suite failures by mocking `PricingDataService` in specs that don't need real pricing files.

Next steps
- Create the new files for `FirstFullYearService` and `RiMonthlySpendingTablesComponent` in the repo.
- Add the insertion into `landing.component.html`.
- Run focused tests for the new service and component.
- Update failing specs to mock `PricingDataService` and re-run full suite.

Notes
- Ensure imports use standalone components where possible for consistency with project style.
- Keep `projectionEndYear` usage consistent when requesting aggregated months.
- Prefer mocking over adding fixtures to keep unit tests fast and deterministic.
