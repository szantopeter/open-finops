<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: 
  - PRINCIPLE 7: Enhanced to emphasize 100% business logic coverage requirement
  - Development workflow section: Strengthened TDD requirement from "where feasible" to "MUST follow"
- Added sections: 
  - PRINCIPLE 10 — Test-driven development workflow (new principle with explicit red-green-refactor cycle)
- Removed sections: none
- Templates requiring updates:
	- .specify/templates/plan-template.md ✅ updated (Constitution Check present)
	- .specify/templates/spec-template.md ✅ updated (Constitution Check present)
	- .specify/templates/tasks-template.md ✅ updated (TDD guidance added to all test sections)
	- .specify/templates/checklist-template.md ✅ updated (Constitution Check guidance present)
	- .specify/templates/commands/*.md ⚠ pending (no critical updates needed)
	- README.md, docs/quickstart.md ⚠ pending (recommended but not critical)
- Follow-up TODOs: none
- Amendment rationale: Added formal TDD requirement as PRINCIPLE 10 to enforce test-first
  workflow for all business logic. This is a MINOR version bump per governance rules
  (new principle added). The principle codifies existing practice and ensures consistent
  application across all features.
-->

# AWS RDS RI Portfolio Optimizer Constitution

## Core Principles

### PRINCIPLE 1 — Single source of truth for inputs
The RDS RI portfolio input is the Cloudability CSV export. The CSV structure is fixed and
MUST be treated as authoritative. AWS RDS pricing data MUST be stored as static files
under `assets/pricing` and MUST be consumed only from those files for deterministic
calculations.

Rationale: Determinism and auditability require a single, immutable source per input
type.

### PRINCIPLE 2 — No guessing; explicit failures
Calculations MUST NOT use heuristics, guesses, or silent defaults. If a required value is
unavailable or ambiguous, the code MUST surface a clear error. Any calculation that
cannot be completed MUST produce an explicit error state that is visible to the user
and recorded in logs.

Rationale: Financial analysis requires traceability and explicit error handling.

### PRINCIPLE 3 — Exact matching for pricing
Every RI row MUST be matched to pricing data by all of the following fields: instance
class, region, multiAZ, engine, edition, upfront payment, duration. Matching logic is
business logic and MUST be implemented in services distinct from UI components.

Rationale: Accurate cost computation depends on complete and exact matching.

### PRINCIPLE 4 — Calculation semantics
Monthly RI cost calculation MUST follow these steps:
1. Match the RI to pricing.
2. Calculate how many days in the month the RI was active.
3. Multiply the daily RI cost by active days and by the `count` field.

Equivalent steps MUST be followed for on‑demand cost calculations using on‑demand
daily prices. All intermediate values and assumptions used in the computation MUST be
preserved in the result model for audit.

Rationale: Ensure reproducibility and allow line‑by‑line inspection.

### PRINCIPLE 5 — Separation of concerns
Business logic MUST be implemented in services and pure functions fully covered by
unit tests; UI components MUST only render prepared models and emit user intents.
Avoid imperative subscriptions in components; prefer RxJS and async pipes; use OnPush
change detection where possible.

Rationale: Testability and maintainability.

### PRINCIPLE 6 — Persistence & state
Local persistence for UI state and parsed imports MUST use IndexedDB (via an async
wrapper) for large payloads; small synchronous metadata MAY be mirrored in
`localStorage`. Server upload is REQUIRED to obtain OS-level file creation timestamps
when those are necessary; browser File APIs provide only `lastModified`.

Rationale: Reliability and correct metadata.

### PRINCIPLE 7 — Testing & quality gates
Business logic MUST be 100% unit tested for positive and negative cases. Overall code
coverage MUST be ≥ 80% for all modules. Tests MUST mock external dependencies and
run in CI with headless Chrome. Linting and pre-push hooks MUST pass before merge.

Rationale: Confidence and regression prevention.

### PRINCIPLE 8 — Tooling & tech stack
Adopt and enforce the project's frontend tech standards: Angular 20+, TypeScript 5.8+
(strict), Tailwind + SCSS, RxJS, Apollo Angular, Auth0 Angular, Jasmine/Karma,
ESLint with `@wk/eslint-config`, GraphQL Code Generator, and Husky for Git hooks.
Charting libraries may be chosen per feature (ECharts recommended for heavy
analytics).

Rationale: Consistency across the codebase and operational familiarity.

### PRINCIPLE 9 — Error reporting & UX
Errors from business logic MUST be surfaced in the UI with clear messages and an
optional "view details" for diagnostics. Long-running parsing or computation tasks
MUST report progress and allow cancellation.

Rationale: User trust and responsiveness.

### PRINCIPLE 10 — Test-driven development workflow
All business logic implementation MUST follow test-driven development (TDD). For each
new service method, model method, or calculation function:
1. Write the unit test FIRST with clear assertions for expected behavior
2. Run the test and verify it FAILS (red phase)
3. Implement the minimal code to make the test PASS (green phase)
4. Refactor if needed while keeping tests green

Tests MUST be written before implementation code. Implementations submitted without
corresponding failing-first test evidence MAY be rejected in code review.

Rationale: TDD ensures testable design, complete test coverage, and prevents
implementation bias. Writing tests first forces clear thinking about interfaces,
edge cases, and error conditions before code is written.

## Implementation constraints
- Storage keys MUST be versioned (for example `ri-import:v1`). Components MUST
	implement migration logic when evolving persisted models.
- Parser code MUST be pure and decomposed into small helper functions for
	maintainability and to satisfy lint complexity rules.
- Pricing files under `assets/pricing` MUST include metadata required for exact
	matching (instance class, region, multiAZ, engine, edition, upfront, duration).

## Development workflow & quality gates
- Business logic development MUST follow test-driven development (TDD) as specified in
	PRINCIPLE 10. Write tests first, observe them fail, then implement.
- Unit tests MUST cover both happy and error paths with 100% coverage for business
	logic.
- Overall code coverage MUST be ≥ 80% for all modules.
- CI MUST run linting, tests and a coverage check. Any failure MUST block merges.
- Pre-push Git hooks MUST run linting and tests locally to avoid breaking CI.

## Governance
To propose an amendment, open a PR titled `chore(constitution): <short description>`
with the proposed change and a migration plan if needed. Major changes require a
MAJOR version bump; new principles or significant expansions require a MINOR bump;
document-only changes require a PATCH bump. At least two maintainers MUST approve
the amendment PR before merging.

CI MUST include a compliance review step for changes touching business logic or
templates; it verifies test coverage, linter success, and that compute models
record required audit fields. Compliance failures MUST block merge.

## Consistency propagation checklist
The following templates and docs MUST be reviewed and updated where necessary:
- `.specify/templates/plan-template.md` — ensure a Constitution Check step is
	present. ✅ updated
- `.specify/templates/spec-template.md` — ensure required sections for audit data
	and error states are present. ✅ updated
- `.specify/templates/tasks-template.md` — ensure task categories include pricing
	ingestion, matching rules, persistence migration, and TDD workflow. ✅ updated
- `.specify/templates/checklist-template.md` — ensure Constitution Check guidance
	is included. ✅ updated
- `.specify/templates/commands/*.md` — ensure no agent-specific references remain.
	⚠ pending (no critical updates needed)
- `README.md`, `docs/quickstart.md` — add summary of governance and how to run
	compliance checks. ⚠ pending (recommended but not critical)

## Versioning metadata
**Version**: 1.1.0 | **Ratified**: 2025-11-10 | **Last Amended**: 2025-11-11

