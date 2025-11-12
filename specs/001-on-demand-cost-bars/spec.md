# Feature Specification: On-Demand Cost Comparison in Monthly Chart

**Feature Branch**: `001-on-demand-cost-bars`  
**Created**: 12 November 2025  
**Status**: Draft  
**Input**: User description: "For every month I would like the chart to show how much it would have costed with the on demand prices. Add a 2nd bar for every month. Match each group to the appropriate pricing category then using the on-demand price and the number of days calculate the result. The tooltip should show for every month the % of saving. Additionally display the total saving % throughout the whole period"

## Clarifications

### Session 2025-11-12

- Q: How should the system handle incomplete or missing data? → A: Always display an error message, never handle gracefully.
- Q: What should the tooltip display for monthly savings? → A: Monthly saving % and amount between RI and on-demand

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - View Monthly Cost Comparison with Savings (Priority: P1)

As a cost analyst, I want to see both Reserved Instance (RI) costs and on-demand costs side-by-side in the monthly chart so I can understand the savings achieved through RI purchases.

**Why this priority**: This is the core functionality that enables users to evaluate the effectiveness of their RI strategy by comparing actual costs vs. what they would have paid without RIs.

**Independent Test**: Can be fully tested by loading sample data and verifying the chart displays two bars per month with correct cost values and savings percentages in tooltips.

**Acceptance Scenarios**:

1. **Given** valid RI portfolio data is loaded, **When** the monthly cost chart is displayed, **Then** each month shows two bars: one for RI costs and one for on-demand costs
2. **Given** the chart is displayed, **When** hovering over a month, **Then** the tooltip shows RI cost, on-demand cost, savings percentage, and savings amount for that month
3. **Given** data spans multiple months, **When** viewing the chart, **Then** the total savings percentage across all months is displayed prominently

---

### User Story 2 - Show Clear Error Messages for Incomplete Data (Priority: P2)

As a cost analyst, I want the system to show clear error messages when data is incomplete or pricing cannot be matched so I understand what went wrong and can fix the data.

**Why this priority**: Ensures users are informed of issues rather than seeing incomplete or incorrect results, maintaining data integrity.

**Independent Test**: Can be tested by providing data with unmatched pricing and verifying error messages are shown and chart does not display.

**Acceptance Scenarios**:

1. **Given** some RI rows cannot be matched to pricing data, **When** the chart attempts to load, **Then** an error message is displayed explaining the unmatched data and the chart is not shown
2. **Given** pricing data is missing entirely, **When** viewing the chart, **Then** a clear error message indicates the data loading failure

---

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when pricing data is completely missing?
- How are error messages displayed when multiple RI rows are unmatched?
- What if the Cloudability CSV has invalid data formats?
- How does the system validate data integrity before attempting calculations?

## Requirements *(mandatory)*

## Constitution Check *(mandatory)*

Before implementation, each spec MUST include:
- A clear statement of input sources (e.g., Cloudability CSV) and which fields will be used for pricing match.
- Exact pricing match requirements when applicable (instance class, region, multiAZ, engine, edition, upfront, duration).
- Explicit error-state semantics for incomplete calculations.
- Storage key versioning strategy if the feature persists imports or results.

This section is mandatory for feature acceptance and will be validated during CI compliance checks.

**Input Sources**: RI portfolio data from Cloudability CSV export. Pricing data from static files under assets/pricing. Fields used for matching: instanceClass, region, multiAz, engine, edition, upfrontPayment, durationMonths.

**Pricing Match Requirements**: Match by all of: instance class, region, multi-AZ, engine, edition, upfront payment, duration. Use fallback matching for engine variations (e.g., 'oracle-se2' matches 'oracle-se2-byol').

**Error Handling**: Always display error message for any missing data or unmatched pricing. Calculations must fail explicitly and not proceed with partial data.

**Storage**: No additional persistence required; calculations are done in-memory from loaded data.

### Functional Requirements

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

- **FR-001**: System MUST calculate on-demand cost for each RI row by matching to pricing data and multiplying on-demand daily rate by active days in month by count
- **FR-002**: System MUST aggregate on-demand costs by month and group (same as RI costs)
- **FR-003**: System MUST display a stacked bar chart with RI costs and on-demand costs as separate bars per month
- **FR-004**: System MUST show in tooltips: RI cost, on-demand cost, savings percentage, and savings amount for each month
- **FR-005**: System MUST calculate and display total savings percentage across all months: (1 - total_RI_cost / total_on_demand_cost) * 100
- **FR-006**: System MUST display error message for unmatched pricing and prevent chart display
- **FR-007**: System MUST ensure calculations are accurate to 2 decimal places for currency values

### Key Entities *(include if feature involves data)*

- **Monthly Cost Data**: Contains RI cost, on-demand cost, and savings percentage per month per group
- **Pricing Record**: Contains on-demand daily rate used for calculations
- **RI Row**: Source data with instance details and active periods

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Chart loads and displays both cost bars within 5 seconds for datasets up to 1000 RI rows
- **SC-002**: Savings percentages are calculated accurately to within 0.01% of expected values
- **SC-003**: Users can identify months with highest savings at a glance through visual chart representation
- **SC-004**: System displays clear error messages for unmatched pricing scenarios without proceeding with calculations
- **SC-005**: Total savings percentage matches manual calculation across all test datasets
