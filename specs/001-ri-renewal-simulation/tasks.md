# Implementation Tasks: RI Renewal Cost Simulation

**Feature**: 001-ri-renewal-simulation  
**Date**: 2025-11-12  
**Status**: Ready for Implementation

## Overview

This document defines the detailed implementation tasks for adding RI renewal cost simulation to the monthly cost chart. The feature adds a third bar showing projected costs if all RIs were renewed upon expiration, with full calendar year coverage and annual savings breakdown.

## Task Breakdown

### Phase 1: Data Model Extensions (Foundation)

- [x] **TASK-001**: Extend MonthlyCostData model to include renewalCost field
  - File: `src/app/ri-analytics/models/monthly-cost-data.model.ts`
  - Add optional `renewalCost?: number` field
  - Update interface documentation
  - Ensure backward compatibility

- [x] **TASK-002**: Create SavingsBreakdown data model
  - File: `src/app/ri-analytics/models/savings-breakdown.model.ts` (new)
  - Define SavingsBreakdown interface with year1, year2, total fields
  - Define SavingsYearData interface for individual year data
  - Add validation rules and documentation

- [x] **TASK-003**: Create RenewalProjection data model
  - File: `src/app/ri-analytics/models/renewal-projection.model.ts` (new)
  - Define RenewalProjection interface for internal calculations
  - Include originalRi, renewalStart, pricing, monthlyCost fields
  - Add validation rules

### Phase 2: Service Extensions (Business Logic)

- [x] **TASK-004**: Extend RiCostAggregationService error tracking
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
  - Add `renewalErrors` array to lastErrors structure
  - Initialize empty array in constructor
  - Update error tracking documentation

- [x] **TASK-005**: Implement detectExpiringRis method
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
  - Add private method to identify RIs expiring within projection period
  - Filter RIs with endDate within current month through next calendar year
  - Return filtered RiRow array

- [x] **TASK-006**: Implement calculateRenewalProjection method
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
  - Add private method to calculate renewal costs for single RI
  - Match pricing using same criteria as original RI
  - Return RenewalProjection or null for failures
  - Track errors in renewalErrors array

- [x] **TASK-007**: Extend aggregateMonthlyCosts method
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
  - Detect expiring RIs using detectExpiringRis
  - Calculate renewal projections for each expiring RI
  - Add renewalCost to MonthlyCostData for appropriate months
  - Ensure projections cover full calendar year

- [x] **TASK-008**: Implement calculateSavingsBreakdown method
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.ts`
  - Add public method to calculate annual savings breakdown
  - Determine calendar year boundaries from current date
  - Sum savings for partial first year and full second year
  - Return SavingsBreakdown with proper labels

### Phase 3: Component Updates (UI/Visualization)

- [x] **TASK-009**: Update MonthlyCostChartComponent data binding
  - File: `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts`
  - Update component to handle renewalCost data from service
  - Add renewal data processing logic
  - Update chart data transformation methods

- [x] **TASK-010**: Extend chart options for third bar
  - File: `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts`
  - Add third ECharts series for renewal costs
  - Use distinct color (cyan #00BCD4) for renewal bars
  - Filter series to show only months with renewal costs

- [x] **TASK-011**: Update chart tooltip formatter
  - File: `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts`
  - Extend tooltip to show RI, On-Demand, and Renewal costs
  - Format currency values consistently
  - Add renewal cost labels and descriptions

- [x] **TASK-012**: Update chart legend and styling
  - File: `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.ts`
  - Add styling for renewal bar series
  - Update legend labels to include renewal information
  - Ensure responsive design maintains readability

## Implementation Status Summary

✅ **PHASES 1-3 COMPLETE**: Core implementation finished and successfully builds
- Data models extended with renewal support
- Service logic implements renewal calculations  
- UI components updated with third renewal bar
- All code compiles without errors

## Remaining Tasks (Lower Priority)

### Phase 4: Testing (Quality Assurance)

- [ ] **TASK-013**: Add unit tests for data models
  - File: `src/app/ri-analytics/models/savings-breakdown.model.spec.ts` (new)
  - Test SavingsBreakdown and SavingsYearData validation
  - Test RenewalProjection creation and validation
  - Cover edge cases and error conditions

- [ ] **TASK-014**: Extend RiCostAggregationService tests
  - File: `src/app/ri-analytics/services/ri-cost-aggregation.service.spec.ts`
  - Add tests for detectExpiringRis method
  - Add tests for calculateRenewalProjection method
  - Add tests for calculateSavingsBreakdown method
  - Test error tracking for renewal failures

- [ ] **TASK-015**: Update MonthlyCostChartComponent tests
  - File: `src/app/ri-analytics/components/monthly-cost-chart/monthly-cost-chart.component.spec.ts`
  - Add tests for renewal data processing
  - Test chart rendering with third bar
  - Test tooltip formatting with renewal costs
  - Verify component handles missing renewal data

- [ ] **TASK-016**: Add integration tests for renewal workflow
  - File: `tests/unit/ri-analytics/renewal-integration.spec.ts` (new)
  - Test end-to-end renewal calculation with sample data
  - Test calendar year boundary handling
  - Test error scenarios and recovery
  - Validate performance with large datasets

### Phase 5: UI Integration (User Experience)

- [ ] **TASK-017**: Add savings breakdown display component
  - File: `src/app/ri-analytics/components/savings-breakdown/` (new directory)
  - Create component to display year1/year2 savings breakdown
  - Integrate with existing cost display areas
  - Add proper TypeScript interfaces and styling

- [ ] **TASK-018**: Update main application template
  - File: `src/app/app.component.html`
  - Integrate savings breakdown component
  - Ensure responsive layout accommodates new elements
  - Update component communication patterns

- [ ] **TASK-019**: Add loading states and error handling UI
  - Update relevant components to show renewal calculation progress
  - Display renewal-specific errors in UI
  - Add user-friendly error messages for calculation failures
  - Ensure graceful degradation when renewal data unavailable

### Phase 6: Documentation and Validation (Finalization)

- [ ] **TASK-020**: Update component documentation
  - Update README.md with renewal feature description
  - Document new chart interactions and data interpretation
  - Add troubleshooting guide for renewal calculations
  - Update API documentation for new service methods

- [ ] **TASK-021**: Performance validation
  - Run performance tests with renewal calculations
  - Verify 5-second completion requirement
  - Test memory usage with large RI datasets
  - Optimize calculations if performance targets not met

- [ ] **TASK-022**: Final integration testing
  - Test complete user workflow with real data
  - Validate all acceptance criteria from spec.md
  - Cross-browser testing for chart rendering
  - Accessibility testing for new UI elements

## Dependencies and Prerequisites

**Must Complete Before Starting**:
- All design documents (spec.md, plan.md, data-model.md, contracts/, quickstart.md) must be complete
- Constitution check must pass
- Existing ri-analytics module must be functional
- ECharts integration must be working

**Testing Prerequisites**:
- Sample RI data with expiration dates
- Complete pricing data for renewal calculations
- Existing test infrastructure must be operational

## Success Criteria Validation

Each task includes validation steps to ensure:
- Code compiles without errors
- Unit tests pass with >80% coverage
- Integration tests validate end-to-end functionality
- Performance requirements are met
- UI renders correctly across devices
- Error handling works as specified

## Risk Mitigation

**High-Risk Areas**:
- Calendar year boundary calculations (TASK-007, TASK-008)
- Chart rendering performance with third series (TASK-010)
- Error handling without blocking calculations (TASK-006)

**Contingency Plans**:
- Fallback to simplified renewal display if performance issues
- Graceful error handling for missing pricing data
- Progressive enhancement for older browsers

## Implementation Order

Tasks are ordered to minimize dependencies and enable incremental testing:
1. Start with data models (foundation)
2. Extend service logic (core functionality)
3. Update UI components (visualization)
4. Add comprehensive tests (quality)
5. Integrate into main application (experience)
6. Final validation and documentation (completion)