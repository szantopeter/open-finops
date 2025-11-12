# Tasks: On-Demand Cost Comparison in Monthly Chart

**Input**: Design documents from `/specs/001-on-demand-cost-bars/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per constitution PRINCIPLE 7 (100% business logic coverage) and PRINCIPLE 10 (TDD workflow).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application structure following Angular conventions, with feature modules under ri-analytics.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend data models for the new feature

- [X] T001 Create extended MonthlyCostData model in src/app/ri-analytics/models/monthly-cost-data.model.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service extensions that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend RiCostAggregationService with on-demand calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.ts
- [X] T003 Update RiPricingMatcherService for on-demand rates in src/app/ri-analytics/services/ri-pricing-matcher.service.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Monthly Cost Comparison with Savings (Priority: P1) 🎯 MVP

**Goal**: Display grouped bar chart showing both RI and on-demand costs with savings tooltips and total savings percentage

**Independent Test**: Load sample data, verify chart shows two bars per month, tooltips display costs and savings, total savings shown

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
> **Constitution PRINCIPLE 10**: All business logic MUST follow TDD (test-driven development).

- [ ] T004 [P] [US1] Unit tests for on-demand cost calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts
- [ ] T005 [P] [US1] Unit tests for savings calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts
- [ ] T006 [P] [US1] Component tests for grouped bar chart rendering in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts

### Implementation for User Story 1

- [ ] T007 [US1] Implement on-demand cost aggregation in src/app/ri-analytics/services/ri-cost-aggregation.service.ts
- [ ] T008 [US1] Implement savings calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.ts
- [ ] T009 [US1] Update MonthlyCostChartComponent for grouped bars in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts
- [ ] T010 [US1] Add tooltip with savings display in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts
- [ ] T011 [US1] Add total savings percentage display in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Show Clear Error Messages for Incomplete Data (Priority: P2)

**Goal**: Display clear error messages when data is incomplete instead of showing partial results

**Independent Test**: Load data with unmatched pricing, verify error message shown and chart not displayed

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**
> **Constitution PRINCIPLE 10**: All business logic MUST follow TDD (test-driven development).

- [ ] T012 [P] [US2] Unit tests for strict error handling in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts
- [ ] T013 [P] [US2] Component tests for error message display in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts

### Implementation for User Story 2

- [ ] T014 [US2] Implement strict error handling in aggregation service in src/app/ri-analytics/services/ri-cost-aggregation.service.ts
- [ ] T015 [US2] Update component to display errors instead of partial data in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] T016 [P] Update component tests for complete coverage in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts
- [ ] T017 Run quickstart.md validation
- [ ] T018 Performance optimization for large datasets
- [ ] T019 Documentation updates in README.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks can run in parallel
- Once Foundational phase completes, user stories can start in parallel
- All tests for a user story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for on-demand cost calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts"
Task: "Unit tests for savings calculations in src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts"
Task: "Component tests for grouped bar chart rendering in src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution-driven: pricing matching, audit trails, error handling

## Constitution-driven tasks

- Pricing ingestion & mapping: ensured in foundational phase
- Exact-match rules: implemented in aggregation service
- Persistence & migration: no additional persistence
- Audit & result models: intermediate values recorded
- Error-state handling: strict error display implemented