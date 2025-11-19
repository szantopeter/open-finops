import { RiGroup } from './ri-group.model';

export interface MonthlyCostAggregate {
  month: Date; // first day of the month
  riGroup: RiGroup;
  totalCost: number; // sum of all costs for this group in this month
  upfrontCost: number; // upfront portion allocated to this month
  recurringCost: number; // recurring portion for this month
}