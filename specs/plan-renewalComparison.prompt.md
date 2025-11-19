## Plan: Implement Renewal Comparison Feature

TL;DR: Implement a renewal comparison table displaying 6 scenarios with columns: Scenario, Upfront Payment, Duration, First Full Year, Savings, Savings %, RI Cost, On-Demand Cost, Max Monthly RI Spending.

Complete the renewal comparison table feature by creating a service that generates 6 renewal scenarios and updating the component to use it. The table will include the following exact fields: Scenario, Upfront Payment, Duration, First Full Year, Savings, Savings %, RI Cost, On-Demand Cost, Max Monthly RI Spending.

### Steps
1. Create RiRenewalComparisonService with getRenewalScenarios() method generating all upfront payment and duration combinations.
2. Update RiRenewalComparisonComponent to inject and subscribe to the service instead of using @Input.
3. Verify the component is properly imported in the landing page.
4. Run tests and build to ensure no compilation or runtime errors.

### Further Considerations
1. Ensure the service follows the same pattern as MonthlyCostChartService for data loading and error handling.
2. The 6 scenarios should cover: No Upfront/Partial Upfront/All Upfront × 12/36 months.
3. Component should handle empty data gracefully when no RI portfolio is loaded.
