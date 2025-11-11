# Implementation Plan: Monthly RI Cost Visualization

**Branch**: `001-monthly-ri-cost-chart` | **Date**: 2025-11-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-monthly-ri-cost-chart/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Display a stacked bar chart showing monthly RI cost obligations grouped by exact matching on seven categorization fields (instance class, region, multiAZ, engine, edition, upfront payment, duration). Technical approach: pure service function for exact matching + grouping, ECharts for rendering stacked bars with up to 50 groups across 24 months, prorated cost calculation for mid-month start/end dates.

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode enabled)
**Primary Dependencies**: Angular 20+, RxJS 7.8, ECharts 5+ (for stacked bar charts), idb-keyval 6.2.2 (IndexedDB wrapper), PapaParse 5.4.1 (CSV parsing)
**Storage**: IndexedDB (via idb-keyval) for RI import data and pricing cache; localStorage fallback for metadata; versioned keys `ri-monthly-chart:v1` and `ri-chart-filters:v1` for optional caching
**Testing**: Jasmine 5.9 + Karma 6.4 in headless Chrome; unit tests required for business logic with 100% coverage
**Target Platform**: Web (Angular SPA running in modern browsers)
**Project Type**: Web application (frontend-only, single Angular project)
**Performance Goals**: Render chart with 500 RIs across 24 months in <2 seconds; calculate and aggregate costs for 50 distinct RI groups in <1 second
**Constraints**: 100% unit test coverage of business logic (constitution), exact 7-field matching required (no partial matches), explicit error messages for unmatched RIs, no guessing or heuristics in calculations
**Scale/Scope**: Up to 50 RI groups across 24 months (1,200 data points), rendering 24 stacked bars with up to 50 segments each

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ Input sources identified: Cloudability CSV (via existing RiImportService), pricing files in `assets/pricing`
- ✅ Required pricing matching fields documented: instance class, region, multiAZ, engine, edition, upfront payment, duration (all seven fields listed in spec FR-007)
- ✅ Storage versioning listed: `ri-monthly-chart:v1` for aggregation cache, `ri-chart-filters:v1` for filter preferences
- ✅ Error modes described: unmatched RIs (FR-008), missing/malformed pricing files (FR-009), incomplete pricing data (spec Constitution Check section)

**Result**: All gates pass. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-monthly-ri-cost-chart/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── ri-analytics/              # Feature module (already exists)
│   │   ├── components/
│   │   │   ├── monthly-cost-chart/       # NEW: Chart display component
│   │   │   │   ├── monthly-cost-chart.component.ts
│   │   │   │   ├── monthly-cost-chart.component.html
│   │   │   │   ├── monthly-cost-chart.component.scss
│   │   │   │   └── monthly-cost-chart.component.spec.ts
│   │   │   └── ri-import-upload/          # EXISTING: CSV upload/import
│   │   ├── services/
│   │   │   ├── ri-cost-aggregation.service.ts     # NEW: Cost calculation + grouping
│   │   │   ├── ri-cost-aggregation.service.spec.ts
│   │   │   ├── ri-pricing-matcher.service.ts      # NEW: Exact 7-field matching
│   │   │   ├── ri-pricing-matcher.service.spec.ts
│   │   │   ├── ri-data.service.ts          # EXISTING: Import data access
│   │   │   └── ri-import.service.ts        # EXISTING: CSV parsing
│   │   └── models/
│   │       ├── ri-group.model.ts           # NEW: RI group entity
│   │       ├── monthly-cost-aggregate.model.ts  # NEW: Monthly cost aggregate
│   │       ├── pricing-record.model.ts     # NEW: Pricing data structure
│   │       └── ri-matching-criteria.model.ts   # NEW: 7-field composite key
│   └── core/
│       └── services/
│           └── storage.service.ts          # EXISTING: IndexedDB wrapper
└── assets/
    └── pricing/                            # EXISTING: Static pricing files

tests/
└── unit/                                   # Jasmine/Karma unit tests (colocated with source)
```

**Structure Decision**: Single Angular project (web application). New feature artifacts are placed under `src/app/ri-analytics/` to maintain feature cohesion. Existing services (`RiDataService`, `RiImportService`, `StorageService`) are reused for data access. New services for pricing matching and cost aggregation are created to separate business logic from UI. Models defined for key entities (RI Group, Monthly Cost Aggregate, Pricing Record, RI Matching Criteria).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations detected.** All constitution requirements are satisfied.

---

## Phase Completion Summary

### Phase 0: Research ✅

**Deliverable**: `research.md`

**Key Decisions**:
1. **Charting Library**: ECharts 5.x selected for performance with 50+ stacked groups
2. **Proration Strategy**: Daily rate calculation for mid-month RI start/end dates
3. **Service Architecture**: Two services (RiPricingMatcherService, RiCostAggregationService) for separation of concerns
4. **Error Handling**: Fail-fast validation for missing/malformed pricing files

**Research Questions Resolved**: 4/4 (no NEEDS CLARIFICATION items remaining)

---

### Phase 1: Design ✅

**Deliverables**: 
- `data-model.md` — Four core entities (RiMatchingCriteria, PricingRecord, RiGroup, MonthlyCostAggregate)
- `contracts/service-contracts.md` — Three service interfaces with explicit input/output types and error handling
- `quickstart.md` — Setup, usage, troubleshooting guide for developers

**Design Artifacts**:
- Entity definitions with validation rules and relationships
- Service contracts with testing requirements
- Storage strategy with versioned keys (`ri-monthly-chart:v1`, `ri-chart-filters:v1`)
- Performance expectations (<2s render time for 500 RIs)

**Constitution Re-check**: ✅ All gates pass. No violations introduced during design phase.

---

## Next Steps

The planning phase is now complete. Proceed to task breakdown:

1. **Run `/speckit.tasks`** (or follow `speckit.tasks.prompt.md`) to generate `tasks.md`
2. Tasks should cover:
   - Installing ECharts dependencies (echarts, ngx-echarts)
   - Creating model classes (RiMatchingCriteria, PricingRecord, RiGroup, MonthlyCostAggregate)
   - Implementing RiPricingMatcherService with unit tests
   - Implementing RiCostAggregationService with unit tests
   - Creating MonthlyCostChartComponent with ECharts integration
   - Writing unit tests for exact 7-field matching logic (constitution requirement)
   - Writing unit tests for proration calculation (mid-month start/end)
   - Integrating with existing RiDataService and StorageService
   - Adding chart to application routing and navigation

3. **Implementation Guidelines**:
   - Follow test-first development where feasible (constitution requirement)
      - PRs that implement business logic MUST include a `TDD evidence` section in the pull request description documenting the failing-first test(s), reproduction steps, and proof that tests pass after implementation. Reviewers should verify this section before approving the PR.
   - Maintain 100% unit test coverage for business logic (RiPricingMatcherService, RiCostAggregationService)
   - Ensure all services are pure (no side effects) and synchronous where possible
   - Use explicit error result objects (no exceptions) for predictable error handling
   - Add `echarts` and `ngx-echarts` to `package.json` dependencies

4. **Quality Gates**:
   - All unit tests pass (npm run test:ci)
   - Linting passes with no errors (npm run lint)
   - Test coverage ≥80% overall, 100% for business logic
   - Constitution compliance verified (exact 7-field matching, no guessing, explicit errors)
