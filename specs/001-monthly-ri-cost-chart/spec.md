# Feature Specification: Monthly RI Cost Visualization

**Feature Branch**: `001-monthly-ri-cost-chart`  
**Created**: 2025-11-10  
**Status**: Draft  
**Input**: User description: "I would like to create a bar chart, that shows the monthly distribution of the reservations. Bars should be stacked and the groups should be by individual RI types. The height of the bar should show the amount we pay in that month. For example if there is a RI with an upfront payment, then the upfront payment must be shown in the first month, monthly payments should be in the month we pay them. RIs have to be matched by the appropriate pricing category, by all of the following fields : instance class, region, multi AZ, engine, edition, upfront payment, duration. There should be a test to prove that RIs are only added to the same group if all the above fields are matched."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Monthly RI Cost Distribution (Priority: P1)

A cost analyst needs to visualize the monthly cost breakdown of all active Reserved Instances to understand payment obligations over time and identify cost patterns across different RI configurations.

**Why this priority**: This is the core value proposition of the feature. Without the visualization, users cannot quickly assess their monthly RI financial commitments or compare costs across different RI types. This addresses the primary user need and is independently valuable.

**Independent Test**: Can be fully tested by loading a Cloudability CSV export with multiple RIs of different types and verifying that the chart displays monthly bars with correctly stacked RI groups, showing accurate costs for each month including upfront payments in the first month.

**Acceptance Scenarios**:

1. **Given** I have imported a Cloudability CSV with multiple active RIs, **When** I view the monthly cost chart, **Then** I see a bar for each month with the total height representing the sum of all RI costs for that month
2. **Given** the chart is displayed, **When** I examine each monthly bar, **Then** each bar is stacked with segments representing different RI groups, where each group combines RIs with identical instance class, region, multiAZ, engine, edition, upfront payment, and duration
3. **Given** an RI has an upfront payment, **When** I view the chart, **Then** the upfront payment amount appears in the first month's bar as part of that RI's group segment
4. **Given** an RI has monthly recurring payments, **When** I view the chart, **Then** each month's bar includes the monthly payment amount for that RI in the appropriate group segment
5. **Given** multiple RIs exist in the same group (matching all categorization fields), **When** I view the chart, **Then** those RIs are combined into a single stacked segment with their costs summed together

---

### Edge Cases

- What happens when an RI has no pricing data available for matching (all required fields present but no match found in `assets/pricing`)? The system MUST display an explicit error for that RI and exclude it from the chart with a warning message listing the unmatched RIs.
- What happens when an RI's start date is mid-month? The system MUST calculate a prorated cost for that first month based on the number of active days.
- What happens when an RI ends mid-month? The system MUST calculate a prorated cost for the final month based on the number of active days.
- What happens when no RIs are imported or all RIs fall outside the selected time range? The chart displays an empty state message: "No reservation data available for the selected period."
- What happens when two RIs in the same group overlap in time? The costs are summed for each month they are both active (no deduplication).
- What happens when pricing data files are missing or malformed? The system MUST fail explicitly with a clear error message before attempting to render the chart.

## Requirements *(mandatory)*

## Constitution Check *(mandatory)*

**Input sources**: 
- RDS RI portfolio data from Cloudability CSV export (structure fixed, authoritative source)
- AWS RDS pricing data from static files under `assets/pricing` (consumed for deterministic calculations)

**Exact pricing match requirements**:
Every RI row MUST be matched to pricing data using ALL of the following fields:
- Instance class
- Region
- MultiAZ (boolean flag)
- Engine
- Edition
- Upfront payment type
- Duration (in months)

Matching logic MUST be implemented as a pure service function separate from UI components. Matching MUST NOT use partial matches, fuzzy logic, or defaults; all seven fields must match exactly.

**Explicit error-state semantics**:
- If any RI cannot be matched to pricing data (no exact match found), the calculation MUST fail for that RI and surface an explicit error listing the unmatched RI details (all seven matching fields).
- If pricing files are missing or malformed, the system MUST fail before rendering and display: "Pricing data unavailable or invalid. Cannot calculate RI costs."
- If upfront payment or monthly payment amounts are missing from matched pricing data, the system MUST fail for that RI with: "Incomplete pricing data for [RI details]."
- All calculation failures MUST be logged with full context (RI identifier, attempted match criteria, failure reason).

**Storage key versioning strategy**:
If aggregated chart data or user filter preferences are persisted:
- Use versioned key `ri-monthly-chart:v1` for cached aggregation results
- Use versioned key `ri-chart-filters:v1` for user's time-range selections
- Implement migration logic if the schema for either cache changes in the future

This feature depends on imported RI data from the existing upload/preview feature and pricing files under `assets/pricing`. No new persistent storage is introduced except optional caching/filter state.

### Functional Requirements

- **FR-001**: System MUST aggregate monthly costs for all active RIs by calculating upfront and recurring charges for each month within the RI's active period
- **FR-002**: System MUST group RIs by exact match on all seven categorization fields (instance class, region, multiAZ, engine, edition, upfront payment, duration) before aggregating costs
- **FR-003**: System MUST allocate upfront payment amounts to the first month of the RI's start date
- **FR-004**: System MUST allocate monthly recurring payment amounts to each month the RI is active
- **FR-005**: System MUST prorate costs for RIs that start or end mid-month based on the number of active days in that month
- **FR-006**: System MUST display a stacked bar chart with one bar per month and stacked segments representing distinct RI groups
- **FR-007**: System MUST match each RI to pricing data using all seven required fields with exact equality (no partial matching)
- **FR-008**: System MUST surface explicit errors for any RI that cannot be matched to pricing data, listing the unmatched RI's categorization fields
- **FR-009**: System MUST display an error message if pricing data files are missing or malformed before attempting calculations
- **FR-010**: System MUST implement a unit test that verifies RIs are grouped together if and only if all seven categorization fields match exactly
- **FR-011**: System MUST display monthly bars in chronological order (earliest to latest)
- **FR-012**: System MUST label each bar with the month and year (e.g., "Jan 2025")
- **FR-013**: System MUST show the total cost for each month as the sum of all stacked segment heights
- **FR-014**: System MUST display an empty state message when no RI data is available for the chart

- **FR-015**: Development workflow MUST follow the project's TDD constitution principle: every feature PR that implements business logic for this feature is REQUIRED to include a "TDD evidence" section in the pull request description. That section must document at minimum:
	- The failing-first test(s) added (file path(s) and test name(s)) and a short explanation of the failing assertion(s)
	- Steps to reproduce the failing test locally (commands and any required sample data)
	- A reference to the commit(s) that show the failing test before the implementation (or a short video/screenshot if the repo workflow prevents committing failing tests)
	- A short note confirming the tests pass after the implementation and listing the test run command used
	The PR will not be approved by reviewers until the TDD evidence section is present and demonstrably complete (or an agreed alternative workflow is documented in the PR).

### Key Entities

- **RI Group**: Represents a collection of RIs that share identical values for all seven categorization fields (instance class, region, multiAZ, engine, edition, upfront payment, duration). Used to aggregate costs within a stacked bar segment.
- **Monthly Cost Aggregate**: Represents the total cost obligation for a specific RI group in a specific month, including prorated upfront and recurring charges. Each aggregate maps to one stacked segment in the monthly bar.
- **RI Matching Criteria**: A composite key of the seven required fields used to locate pricing data and group RIs. Must match exactly to pricing records; no partial matches allowed.
- **Pricing Record**: External data from `assets/pricing` files containing daily or monthly rates for a specific RI configuration (identified by the seven matching fields). Used to calculate cost obligations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view the monthly RI cost distribution chart within 2 seconds of importing a Cloudability CSV with up to 500 RIs
- **SC-002**: The chart correctly displays upfront payments in the first month for 100% of RIs with upfront charges
- **SC-003**: The chart correctly calculates and displays prorated costs for RIs starting or ending mid-month with accuracy to the day
- **SC-004**: RIs are grouped into stacked segments with 100% accuracy based on exact match of all seven categorization fields (verified by unit tests)
- **SC-005**: The system displays explicit error messages for any RI that cannot be matched to pricing data, with 100% of unmatched RIs identified in error output
- **SC-006**: Users can identify the highest-cost month and the contributing RI groups within 10 seconds of viewing the chart
- **SC-007**: The chart renders without visual artifacts or overlapping segments for datasets containing up to 50 distinct RI groups across 24 months
