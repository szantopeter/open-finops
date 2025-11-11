# Tasks: Monthly RI Cost Visualization

**Input**: Design documents from `/specs/001-monthly-ri-cost-chart/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests are REQUIRED for all business logic per constitution (100% coverage). Unit tests are included in tasks below.

**Organization**: Tasks are grouped by user story. This feature has one primary user story (P1), so most tasks fall under that story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

Single Angular project structure:
- Models: `src/app/ri-analytics/models/`
- Services: `src/app/ri-analytics/services/`
- Components: `src/app/ri-analytics/components/`
- Tests: Colocated with source files (`.spec.ts`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and verify pricing data availability

- [ ] T001 Install ECharts dependencies: `npm install echarts ngx-echarts --save`
- [ ] T002 Verify pricing data files exist in `src/assets/pricing/` (manual check, document in commit)
- [ ] T003 [P] Configure ECharts module in `src/app/app.config.ts` or appropriate module file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models and pricing infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create RiMatchingCriteria model in `src/app/ri-analytics/models/ri-matching-criteria.model.ts` with equals() and toKey() methods
- [ ] T005 [P] Create RiMatchingCriteria unit test in `src/app/ri-analytics/models/ri-matching-criteria.model.spec.ts` (test equals() with exact 7-field matching, test toKey() stability)
- [ ] T006 [P] Create PricingRecord model in `src/app/ri-analytics/models/pricing-record.model.ts` with validation rules
- [ ] T007 [P] Create PricingRecord unit test in `src/app/ri-analytics/models/pricing-record.model.spec.ts` (test validation rules)
- [ ] T008 [P] Create RiGroup model in `src/app/ri-analytics/models/ri-group.model.ts` with calculateMonthlyCosts() and getTotalRiCount() methods
- [ ] T009 [P] Create MonthlyCostAggregate model in `src/app/ri-analytics/models/monthly-cost-aggregate.model.ts` with getChartLabel() and getTooltipText() methods
- [ ] T010 Create RiPricingMatcherService in `src/app/ri-analytics/services/ri-pricing-matcher.service.ts` with loadPricingData(), matchRiToPricing(), and batchMatchRisToPricing() methods
- [ ] T011 Create RiPricingMatcherService unit test in `src/app/ri-analytics/services/ri-pricing-matcher.service.spec.ts` (REQUIRED: test exact 7-field matching per FR-010, test failure for missing pricing, test batch matching)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Monthly RI Cost Distribution (Priority: P1) 🎯 MVP

**Goal**: Display a stacked bar chart showing monthly RI cost obligations grouped by exact 7-field matching, with prorated costs for mid-month start/end dates

**Independent Test**: Import a Cloudability CSV with multiple RIs of different types, navigate to the chart page, verify monthly bars display with correctly stacked RI groups showing accurate costs including upfront payments in first month

### Unit Tests for User Story 1 (REQUIRED per constitution)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Create RiCostAggregationService unit test in `src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts` (test exact grouping by 7 fields, test upfront in first month only, test proration for mid-month start, test proration for mid-month end, test full-month cost calculation, test multiple RIs in same group summed correctly, test edge cases: RI starts on last day of month, RI ends on first day of month)
- [ ] T013 [P] [US1] Create RiGroup unit test in `src/app/ri-analytics/models/ri-group.model.spec.ts` (test calculateMonthlyCosts() with various date ranges, test getTotalRiCount() sums count field)
- [ ] T014 [P] [US1] Create MonthlyCostAggregate unit test in `src/app/ri-analytics/models/monthly-cost-aggregate.model.spec.ts` (test getChartLabel() formatting, test getTooltipText() formatting, test totalCost = upfrontCost + recurringCost)

### Implementation for User Story 1

- [ ] T015 [US1] Implement RiCostAggregationService in `src/app/ri-analytics/services/ri-cost-aggregation.service.ts` with aggregateMonthlyCosts() and calculateMonthlyCostForRi() methods per contract (depends on T012 test file)
- [ ] T016 [US1] Implement RiGroup.calculateMonthlyCosts() method in `src/app/ri-analytics/models/ri-group.model.ts` with daily proration logic for mid-month dates (depends on T013 test file)
- [ ] T017 [US1] Implement MonthlyCostAggregate methods in `src/app/ri-analytics/models/monthly-cost-aggregate.model.ts` (depends on T014 test file)
- [ ] T018 [US1] Run unit tests for RiCostAggregationService and verify all tests pass: `npm test -- --include="**/ri-cost-aggregation.service.spec.ts"`
- [ ] T019 [US1] Run unit tests for RiGroup and verify all tests pass: `npm test -- --include="**/ri-group.model.spec.ts"`
- [ ] T020 [US1] Run unit tests for MonthlyCostAggregate and verify all tests pass: `npm test -- --include="**/monthly-cost-aggregate.model.spec.ts"`
- [ ] T021 [P] [US1] Create MonthlyCostChartComponent in `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts` with ECharts configuration for stacked bars
- [ ] T022 [P] [US1] Create MonthlyCostChartComponent template in `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.html` with chart container and error states
- [ ] T023 [P] [US1] Create MonthlyCostChartComponent styles in `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.scss`
- [ ] T024 [US1] Create MonthlyCostChartComponent unit test in `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts` (test component initialization, test error state display, test empty state display)
- [ ] T025 [US1] Integrate RiDataService in MonthlyCostChartComponent to load RI import data from IndexedDB
- [ ] T026 [US1] Integrate RiPricingMatcherService in MonthlyCostChartComponent to match RIs to pricing data
- [ ] T027 [US1] Integrate RiCostAggregationService in MonthlyCostChartComponent to calculate monthly costs
- [ ] T028 [US1] Configure ECharts options in MonthlyCostChartComponent: xAxis (category: months), yAxis (value: cost), series (stacked bars per RI group), tooltip (show RI group details), legend (RI group labels)
- [ ] T029 [US1] Implement error handling in MonthlyCostChartComponent for unmatched RIs (display list of unmatched RIs with 7-field criteria per FR-008)
- [ ] T030 [US1] Implement error handling in MonthlyCostChartComponent for missing/malformed pricing files (display error message per FR-009)
- [ ] T031 [US1] Implement empty state handling in MonthlyCostChartComponent when no RI data available (display message per FR-014)
- [ ] T032 [US1] Add chart to application routing in `src/app/app.routes.ts` with path `/ri-analytics/monthly-cost-chart`
- [ ] T033 [US1] Add navigation link to chart page in application menu/navigation component
- [ ] T034 [US1] Run component unit tests and verify all tests pass: `npm test -- --include="**/monthly-cost-chart.component.spec.ts"`
- [ ] T035 [US1] Manual integration test: Import sample Cloudability CSV, navigate to chart, verify chart displays with correct stacked bars and grouping

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements, performance optimization, and final validation

- [ ] T036 [P] Add optional caching for aggregation results in StorageService with versioned key `ri-monthly-chart:v1`
- [ ] T037 [P] Add optional filter preferences storage in StorageService with versioned key `ri-chart-filters:v1` (for future time-range filtering)
- [ ] T038 Run full test suite and verify coverage: `npm run test:ci` (verify ≥80% overall, 100% for business logic)
- [ ] T039 Run linting and fix any errors: `npm run lint`
- [ ] T040 Performance test: Import 500 RIs, measure chart render time (should be <2 seconds per SC-001)
- [ ] T041 Performance test: Calculate aggregates for 50 groups across 24 months, measure time (should be <1 second per performance goals)
- [ ] T042 Validation test: Verify upfront payments appear only in first month per SC-002 (manual test with sample data)
- [ ] T043 Validation test: Verify prorated costs for mid-month RIs are accurate to the day per SC-003 (manual test with sample data)
- [ ] T044 Validation test: Verify exact 7-field grouping accuracy per SC-004 (covered by unit tests, but verify in UI)
- [ ] T045 Validation test: Verify explicit error messages for unmatched RIs per SC-005 (manual test with incomplete pricing data)
- [ ] T046 [P] Update quickstart.md with final implementation notes and any deviations from plan
- [ ] T047 [P] Update AGENTS.md or project README with information about the new chart feature
- [ ] T048 Run quickstart.md validation: Follow quickstart.md setup steps and verify feature works end-to-end

-- Cross-cutting TDD Evidence Task

- [ ] T049 [P] Add PR checklist item and require `TDD evidence` in PRs that implement business logic for this feature: update the repository CONTRIBUTING or PR template and add a short automated PR checklist entry (path: `.github/pull_request_template.md` or similar) that requires a `TDD evidence` section describing failing-first tests, reproduction steps, and proof that tests pass after the implementation. Add a unit test or script that verifies the PR description contains the required section when possible.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS User Story 1
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **Polish (Phase 4)**: Depends on User Story 1 completion

### Task Dependencies Within User Story 1

**Critical Path**:
1. T012-T014: Write unit tests FIRST (parallel)
2. T015-T017: Implement services/models (T015 depends on T012, T016 depends on T013, T017 depends on T014)
3. T018-T020: Verify unit tests pass (depends on implementations)
4. T021-T024: Create component and test (parallel, depends on services/models)
5. T025-T031: Integrate services and implement logic (sequential, depends on component creation)
6. T032-T033: Add routing and navigation (depends on component completion)
7. T034-T035: Final testing (depends on routing)

**Parallel Opportunities**:
- T004-T009: All model creation tasks (parallel)
- T012-T014: All unit test writing for services/models (parallel)
- T021-T023: Component files creation (parallel)

### Parallel Example: Foundational Phase

```bash
# Launch all model creation tasks together:
Task T004: "Create RiMatchingCriteria model in src/app/ri-analytics/models/ri-matching-criteria.model.ts"
Task T005: "Create RiMatchingCriteria unit test in src/app/ri-analytics/models/ri-matching-criteria.model.spec.ts"
Task T006: "Create PricingRecord model in src/app/ri-analytics/models/pricing-record.model.ts"
Task T007: "Create PricingRecord unit test in src/app/ri-analytics/models/pricing-record.model.spec.ts"
Task T008: "Create RiGroup model in src/app/ri-analytics/models/ri-group.model.ts"
Task T009: "Create MonthlyCostAggregate model in src/app/ri-analytics/models/monthly-cost-aggregate.model.ts"
```

### Parallel Example: User Story 1 Tests

```bash
# Launch all unit test writing tasks together:
Task T012: "Create RiCostAggregationService unit test in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts"
Task T013: "Create RiGroup unit test in src/app/ri-analytics/models/ri-group.model.spec.ts"
Task T014: "Create MonthlyCostAggregate unit test in src/app/ri-analytics/models/monthly-cost-aggregate.model.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install ECharts, verify pricing data)
2. Complete Phase 2: Foundational (create models, implement RiPricingMatcherService) - CRITICAL
3. Complete Phase 3: User Story 1 (implement aggregation, create chart component, integrate services)
4. **STOP and VALIDATE**: Run full test suite, verify chart renders correctly with sample data
5. Deploy/demo if ready

### Quality Gates

Before considering User Story 1 complete:
- ✅ All unit tests pass (npm run test:ci)
- ✅ Linting passes with no errors (npm run lint)
- ✅ Test coverage ≥80% overall, 100% for RiPricingMatcherService and RiCostAggregationService
- ✅ Manual integration test passes (import CSV, view chart, verify correctness)
- ✅ Constitution compliance verified:
  - FR-010: Unit test proves exact 7-field grouping (T012)
  - FR-007: Exact matching implemented (T011)
  - FR-008: Explicit errors for unmatched RIs (T029)
  - FR-009: Explicit errors for missing pricing (T030)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. (Future enhancements: P2, P3 stories would go here if they existed)
4. Polish phase → Final validation and optimization

---

## Notes

- [P] tasks = different files, no dependencies
- [US1] label maps task to User Story 1 for traceability
- User Story 1 is the MVP and the only user story for this feature
- Unit tests are REQUIRED per constitution (100% coverage for business logic)
- Verify tests FAIL before implementing (TDD approach)
- Commit after each task or logical group
- Stop at checkpoints to validate independently

## Constitution-Driven Task Summary

This feature implements the following constitution-mandated tasks:

✅ **Pricing ingestion & mapping** (T002, T006-T007, T010-T011): Verify pricing files exist, create PricingRecord model, implement RiPricingMatcherService  
✅ **Exact-match rule implementation** (T004-T005, T011, FR-010): Create RiMatchingCriteria with equals() method, unit test proving exact 7-field matching  
✅ **Persistence & migration** (T036-T037): Optional caching with versioned keys `ri-monthly-chart:v1` and `ri-chart-filters:v1`  
✅ **Audit & result model** (T009, T017): MonthlyCostAggregate records activeDays for audit, intermediate values preserved  
✅ **Error-state handling** (T029-T031): Explicit errors for unmatched RIs, missing pricing files, empty data with clear UI messages and logging  
✅ **Testing requirements** (T005, T007, T011-T014, T018-T020, T024, T034, T038): 100% unit test coverage for business logic (RiPricingMatcherService, RiCostAggregationService) with positive and negative test cases

No constitution-driven tasks were omitted. All requirements from constitution principles are addressed.

---

## Summary Statistics

**Total Tasks**: 48  
**Setup Tasks**: 3 (Phase 1)  
**Foundational Tasks**: 8 (Phase 2)  
**User Story 1 Tasks**: 24 (Phase 3)  
**Polish Tasks**: 13 (Phase 4)  

**Parallel Opportunities**: 15 tasks marked [P]  
**Constitution-Required Tests**: 8 unit test files (T005, T007, T009, T011, T012-T014, T024)  
**Manual Validation Tests**: 7 tasks (T035, T040-T045)  

**Suggested MVP Scope**: Phases 1-3 (35 tasks) → Delivers complete User Story 1 with chart visualization
