import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export type Platform = 'EasyHMS' | '1Rad';

export interface HospitalSubscription {
    hospitalSubscriptionId: string;
    platform: Platform;
    hospitalId: string;
    hospitalName: string;
    planId: string | null;
    planName: string | null;
    status: string;        // effective status (Active/Trial/Pending/Expired/Blocked)
    storedStatus: string;
    trialStartDate: string | null;
    trialEndDate: string | null;
    subscriptionStartDate: string | null;
    subscriptionEndDate: string | null;
    nextBillingDate: string | null;
}

export interface PlatformSummary {
    platform: string;
    available: boolean;
    total: number;
    active: number;
    trial: number;
    pending: number;
    expired: number;
    blocked: number;
}

export interface SubscriptionSummary {
    platforms: PlatformSummary[];
    overall: PlatformSummary;
}

export interface Plan {
    planId: string;
    name: string;
    applicationName: string;
    billingCycle: string;
    isActive: boolean;
}

const base = API_ENDPOINTS.HOSPITAL_SUBSCRIPTIONS;

export const subscriptionsService = {
    async getSummary(): Promise<SubscriptionSummary> {
        const { data } = await api.get(base.SUMMARY);
        return data;
    },

    async list(platform: string = 'All', status: string = ''): Promise<HospitalSubscription[]> {
        const { data } = await api.get(base.LIST, { params: { platform, status: status || undefined } });
        return (data?.items ?? []) as HospitalSubscription[];
    },

    async getPlans(application: string = 'All'): Promise<Plan[]> {
        const { data } = await api.get(API_ENDPOINTS.PLANS.LIST, { params: { application } });
        return data as Plan[];
    },

    setStatus(platform: string, hospitalId: string, active: boolean) {
        return api.post(`${base.LIST}/${platform}/${hospitalId}/status`, { active });
    },

    setTrial(platform: string, hospitalId: string, body: { trialStartDate?: string | null; trialEndDate?: string | null }) {
        return api.post(`${base.LIST}/${platform}/${hospitalId}/trial`, body);
    },

    setValidity(
        platform: string,
        hospitalId: string,
        body: { subscriptionStartDate?: string | null; subscriptionEndDate?: string | null; nextBillingDate?: string | null },
    ) {
        return api.post(`${base.LIST}/${platform}/${hospitalId}/validity`, body);
    },

    assignPlan(platform: string, hospitalId: string, planId: string) {
        return api.post(`${base.LIST}/${platform}/${hospitalId}/plan`, { planId });
    },
};
