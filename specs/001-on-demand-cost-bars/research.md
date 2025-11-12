# Research Findings: On-Demand Cost Comparison in Monthly Chart

## Decision: Use ECharts Grouped Bar Chart for Visualization

**Rationale**: ECharts is already integrated in the project and provides excellent support for grouped bar charts with customizable tooltips, legends, and performance for up to 1000+ data points. The grouped bar layout allows clear side-by-side comparison of RI vs on-demand costs.

**Alternatives Considered**:
- D3.js: More flexible but requires additional dependency and custom implementation; rejected due to project constraints on new dependencies and existing ECharts integration.
- Chart.js: Simpler but less performant for large datasets; rejected due to scale requirements.

## Decision: Calculate Savings in Aggregation Service

**Rationale**: Extend the existing RiCostAggregationService to compute both RI and on-demand costs, then calculate savings percentage and amount per month. This keeps business logic centralized and testable.

**Alternatives Considered**:
- Calculate in component: Rejected to maintain separation of concerns and testability.
- Separate service: Rejected as it would duplicate aggregation logic unnecessarily.

## Decision: Display Total Savings as Text Element

**Rationale**: Add a prominent text display above or below the chart showing the total savings percentage across all months. This provides immediate visibility without cluttering the chart.

**Alternatives Considered**:
- Include in chart legend: Rejected as it may not be as prominent.
- Separate chart: Rejected as overkill for a single metric.

## Decision: Error Handling via Component State

**Rationale**: When pricing data is unmatched, set component data to null and display error message in UI, preventing chart rendering. This follows the constitution's strict error handling requirement.

**Alternatives Considered**:
- Graceful degradation: Rejected per constitution PRINCIPLE 9.

## Decision: Tooltip Format

**Rationale**: Show RI cost, on-demand cost, savings amount ($X.XX), and savings percentage (X.XX%) for each month on hover.

**Alternatives Considered**:
- Only percentage: Rejected as amount provides additional context.
- Only amount: Rejected as percentage shows relative savings.