# Data Model: On-Demand Cost Comparison in Monthly Chart

## Monthly Cost Data

**Purpose**: Aggregated cost data per month per group for chart visualization.

**Fields**:
- `monthKey`: string (YYYY-MM format)
- `groupKey`: string (unique identifier for RI group)
- `riCost`: number (total RI cost for the month, 2 decimal places)
- `onDemandCost`: number (total on-demand cost for the month, 2 decimal places)
- `savingsAmount`: number (onDemandCost - riCost, 2 decimal places)
- `savingsPercentage`: number ((1 - riCost/onDemandCost) * 100, 2 decimal places)
- `details`: array of calculation details (for audit)

**Validation Rules**:
- All numeric fields >= 0
- savingsPercentage between 0 and 100
- monthKey matches YYYY-MM format

**Relationships**:
- Belongs to chart data collection
- Derived from RI rows and pricing records

## Pricing Record

**Purpose**: Pricing data for cost calculations.

**Fields**:
- `instanceClass`: string
- `region`: string
- `multiAz`: boolean
- `engine`: string
- `edition`: string | null
- `upfrontPayment`: string
- `durationMonths`: number
- `dailyReservedRate`: number
- `upfrontCost`: number
- `dailyOnDemandRate`: number (for on-demand calculations)

**Validation Rules**:
- Required: instanceClass, region, engine, upfrontPayment, durationMonths
- Numeric fields >= 0

**Relationships**:
- Referenced by RI rows for matching

## RI Row

**Purpose**: Source data from CSV import.

**Fields**:
- `instanceClass`: string
- `region`: string
- `multiAz`: boolean
- `engine`: string
- `edition`: string | null
- `upfrontPayment`: string
- `durationMonths`: number
- `startDate`: string (ISO date)
- `endDate`: string | null (ISO date)
- `count`: number (default 1)

**Validation Rules**:
- Required: instanceClass, region, engine, upfrontPayment, durationMonths, startDate
- count > 0

**Relationships**:
- Processed into Monthly Cost Data via aggregation service