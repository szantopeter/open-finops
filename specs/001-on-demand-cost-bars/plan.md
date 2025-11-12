# Implementation Plan: On-Demand Cost Comparison in Monthly Chart

**Branch**: `001-on-demand-cost-bars` | **Date**: 12 November 2025 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-on-demand-cost-bars/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add on-demand cost bars to the monthly RI cost chart, displaying side-by-side comparison with savings percentages and amounts in tooltips, plus total savings percentage. Implementation uses ECharts grouped bar chart with Angular services for calculation logic.

## Technical Context

**Language/Version**: TypeScript 5.8+, Angular 20+  
**Primary Dependencies**: RxJS 7.8, ECharts 5+ for charting  
**Storage**: IndexedDB (via idb-keyval) for UI state, in-memory for calculations  
**Testing**: Jasmine/Karma for unit tests  
**Target Platform**: Web browser (Chrome, Firefox, Safari)  
**Project Type**: Web application (single-page Angular app)  
**Performance Goals**: Chart loads within 5 seconds for up to 1000 RI rows  
**Constraints**: Calculations accurate to 2 decimal places, no graceful error handling  
**Scale/Scope**: Handle datasets up to 1000 RI rows, multiple months

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates determined based on the project's constitution. At minimum, verify:

- Input sources are identified and mapped to `assets/pricing` where applicable.
- Required pricing matching fields are documented for this feature (instance class,
  region, multiAZ, engine, edition, upfront, duration) when calculations are
  involved.
- Storage/migration considerations are listed when the feature persists data
  (use versioned keys like `ri-import:v1`).
- Any calculation that cannot be completed MUST have an error mode described.

If any of the checks above cannot be satisfied at plan time, document the gap and
an explicit mitigation path in the Complexity Tracking section.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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
│   ├── ri-analytics/
│   │   ├── components/
│   │   │   └── monthly-cost-chart/
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── ri-cost-aggregation.service.ts
│   │   │   ├── ri-pricing-matcher.service.ts
│   │   │   └── ri-import.service.ts
│   │   └── models/
│   │       ├── pricing-record.model.ts
│   │       └── ri-matching-criteria.model.ts
│   └── shared/
│       └── interceptor/
└── assets/
    └── pricing/
```

**Structure Decision**: Web application structure following Angular conventions, with feature modules under ri-analytics.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
