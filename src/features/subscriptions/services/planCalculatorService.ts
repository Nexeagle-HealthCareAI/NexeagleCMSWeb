import { api } from '../../../services/api';

export const MODULE_KEYS = ['IPD', 'OPD', 'Billing', 'Lab', 'RAD'] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export interface PriceBreakdown {
    doctors: number;
    beds: number;
    ratePerDoctor: number;
    doctorsSubtotal: number;
    ratePerBed: number;
    bedsSubtotal: number;
    modules: { module: string; charge: number }[];
    modulesSubtotal: number;
    total: number;
}

export interface MatchedTier {
    planId: string;
    name: string;
    maxDoctors: number;
    maxBeds: number;
    price: number;
}

export interface CalculateResponse {
    breakdown: PriceBreakdown;
    basePrice: number;
    matchedTier: MatchedTier | null;
}

export interface ChooseResponse {
    planId: string;
    isCustom: boolean;
    name: string;
    price: number;
}

export interface ModuleChargeRow {
    module: string;
    charge: number;
}

export const planCalculatorService = {
    calculate(applicationName: string, doctors: number, beds: number, modules: string[]): Promise<CalculateResponse> {
        return api.post('/plans/calculate', { applicationName, doctors, beds, modules }).then(r => r.data);
    },

    choose(body: { applicationName: string; planId?: string; doctors: number; beds: number; modules: string[]; billingCycle?: string }): Promise<ChooseResponse> {
        return api.post('/plans/choose', body).then(r => r.data);
    },

    getModuleCharges(application: string): Promise<ModuleChargeRow[]> {
        return api.get('/plans/module-charges', { params: { application } }).then(r => r.data);
    },

    putModuleCharges(applicationName: string, charges: ModuleChargeRow[]): Promise<ModuleChargeRow[]> {
        return api.put('/plans/module-charges', { applicationName, charges }).then(r => r.data);
    },
};
