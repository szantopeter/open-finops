# Service Contracts: On-Demand Cost Comparison

## RiCostAggregationService

**Purpose**: Aggregate monthly costs from RI data and pricing records, including on-demand cost calculations.

### Methods

#### aggregateMonthlyCosts(rows: RiRow[], pricingRecords: PricingRecord[]): Record<string, Record<string, MonthlyCostData>>

**Input**:
- `rows`: Array of RI row objects
- `pricingRecords`: Array of pricing record objects

**Output**:
- Nested record: monthKey -> groupKey -> MonthlyCostData

**Behavior**:
- Matches each RI row to pricing record
- Calculates RI cost: dailyReservedRate * activeDays * count + upfront (first month)
- Calculates on-demand cost: dailyOnDemandRate * activeDays * count
- Aggregates by month and group
- Computes savings amount and percentage
- Returns error diagnostics for unmatched rows

**Error Handling**:
- Throws error if any row cannot be matched to pricing
- Validates input data integrity

## RiPricingMatcherService

**Purpose**: Match RI rows to appropriate pricing records.

### Methods

#### loadPricingData(records: PricingRecord[]): void

**Input**:
- `records`: Array of pricing records

**Behavior**:
- Builds internal index for fast matching
- Creates fallback keys for engine variations

## MonthlyCostChartComponent

**Purpose**: Display grouped bar chart with RI and on-demand costs.

### Properties

- `data`: MonthlyCostData[][] | null
- `totalSavingsPercentage`: number | null

### Methods

#### ngOnInit(): void

**Behavior**:
- Subscribes to data service
- Loads pricing data
- Aggregates costs
- Updates chart

#### updateChart(data: MonthlyCostData[][]): void

**Input**:
- `data`: Chart data array

**Behavior**:
- Configures ECharts with grouped bars
- Sets up tooltips with cost and savings info
- Displays total savings text