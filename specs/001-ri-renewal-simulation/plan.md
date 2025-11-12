# Implementation Plan: RI Renewal Cost Simulation

**Branch**: `001-ri-renewal-simulation` | **Date**: 2025-11-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ri-renewal-simulation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a third bar to the monthly cost chart visualizing the cost impact of renewing all expiring RIs. The renewal projection begins in the month each RI expires and continues through the end of next calendar year. Update the Total Period Savings display to show breakdown by first (partial) year and second (full) year.

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode enabled)  
**Primary Dependencies**: Angular 20+, RxJS 7.8, ECharts 5+  
**Storage**: IndexedDB (via idb-keyval 6.2.2) for UI state, in-memory for calculations  
**Testing**: Jasmine + Karma, minimum 80% code coverage, 100% for business logic  
**Target Platform**: Web (Angular SPA)  
**Project Type**: Web application (single frontend project)  
**Performance Goals**: Renewal calculations complete within 5 seconds of data load  
**Constraints**: Must maintain existing chart rendering performance, no backend dependencies  
**Scale/Scope**: Extend existing monthly cost chart component and aggregation service

## Constitution Check

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Input sources**: 
- ✅ Cloudability CSV export (existing) provides RI data with startDate, endDate, count, and pricing match fields
- ✅ Static pricing files in `assets/pricing` (existing) provide renewal pricing data

**Pricing matching fields**:
- ✅ All existing fields required: instanceClass, region, multiAz, engine, edition, upfrontPayment, durationMonths
- ✅ Renewal uses same matching criteria as original RI (same conditions)

**Storage/migration**:
- ✅ No new storage keys needed - all calculations are derived on-demand from existing RI and pricing data
- ✅ No migration required

**Error handling**:
- ✅ Missing pricing for renewal → flag as error in existing error tracking system
- ✅ Invalid expiration dates → display error, skip that RI from renewal calculations
- ✅ Calendar year boundary edge cases → explicit validation and error messages

**TDD workflow**:
- ✅ All new business logic follows TDD: write tests first, verify failure, implement, verify pass

**Post-Phase 1 Validation**:
- ✅ Data models defined with proper validation rules
- ✅ Service contracts documented with preconditions/postconditions
- ✅ Agent context updated with new technology stack information
- ✅ No violations of constitution principles identified

**Input sources**: 
- ✅ Cloudability CSV export (existing) provides RI data with startDate, endDate, count, and pricing match fields
- ✅ Static pricing files in `assets/pricing` (existing) provide renewal pricing data

**Pricing matching fields**:
- ✅ All existing fields required: instanceClass, region, multiAz, engine, edition, upfrontPayment, durationMonths
- ✅ Renewal uses same matching criteria as original RI (same conditions)

**Storage/migration**:
- ✅ No new storage keys needed - calculations are derived on-demand from existing RI and pricing data
- ✅ No migration required

**Error handling**:
- ✅ Missing pricing for renewal → flag as error in existing error tracking system
- ✅ Invalid expiration dates → display error, skip that RI from renewal calculations
- ✅ Calendar year boundary edge cases → explicit validation and error messages

**TDD workflow**:
- ✅ All new business logic follows TDD: write tests first, verify failure, implement, verify pass

## Project Structure

### Documentation (this feature)

```text
specs/001-ri-renewal-simulation/
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
│   └── ri-analytics/
│       ├── components/
│       │   └── monthly-cost-chart/
│       │       ├── monthly-cost-chart.component.ts      # UPDATE: Add renewal bar rendering
│       │       ├── monthly-cost-chart.component.html    # UPDATE: Add renewal data binding
│       │       ├── monthly-cost-chart.component.spec.ts # UPDATE: Add renewal tests
│       │       └── monthly-cost-chart.component.scss    # UPDATE: Add renewal bar styling
│       ├── services/
│       │   ├── ri-cost-aggregation.service.ts           # UPDATE: Add renewal calculations
│       │   └── ri-cost-aggregation.service.spec.ts      # UPDATE: Add renewal logic tests
│       └── models/
│           └── monthly-cost-data.model.ts               # UPDATE: Add renewal cost fields
└── assets/
    └── pricing/                                         # EXISTING: Pricing data source

tests/
└── unit/
    └── ri-analytics/                                    # UPDATE: Add renewal scenario tests
```

**Structure Decision**: Single web application structure with updates to existing ri-analytics module. All changes extend existing components and services without introducing new modules or structural changes.
