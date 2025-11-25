import type { PricingData } from '../components/ri-portfolio-upload/models/pricing.model';
import type { RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';

interface MonthlyCost {
    year: number;
    month: number;
    cost: {
        fullUpfront_3y?: RiCost | null;
        fullUpfront_1y?: RiCost | null;
        partialUpfront_3y?: RiCost | null;
        partialUpfront_1y?: RiCost | null;
        noUpfront_1y?: RiCost | null;
        // Intentionally commented out because this combination doesn't exist in AWS pricing
        // noUpfront_3y?: RiCost | null;
        onDemand?: RiCost | null;
    };
}

export interface CostTimeseries {
    riRow: RiRow;
    pricingData: PricingData;
    monthlyCost: MonthlyCost[];
};

export interface RiCost {
    upfrontCost: number;
    monthlyCost: number;
}

export default CostTimeseries;
