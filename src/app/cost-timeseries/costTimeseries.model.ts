import { RiRow } from '../components/ri-portfolio-upload/models/ri-portfolio.model';
import { PricingData } from '../components/ri-portfolio-upload/models/pricing.model';

export interface CostTimeseries {
    riRow: RiRow; 
    pricingData: PricingData;
    monthlyCost: { 
        year: number;
        month: number;
        cost: {
            fullUpfront_3y?: RiCost | null;
            fullUpfront_1y?: RiCost | null;
            partialUpUpfront_3y?: RiCost | null;
            partialUpfront_1y?: RiCost | null;
            noUpfront_1y?: RiCost | null;
            onDemand?: RiCost | null;
        }
    }[];
};

export interface RiCost {
    upfrontCost: number;
    monthlyCost: number;
}

export default CostTimeseries;