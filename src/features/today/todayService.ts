import { api } from '../../services/api';
import { API_ENDPOINTS } from '../../services/endpoints';
import { getDashboardStats, getHospitals, type Hospital } from '../dashboard/services/hospitalService';
import { getRadHospitals, type RadHospitalItem } from '../radCenters/services/radHospitalsService';
import { getBatches, type BatchListItem } from '../dataMigration/services/dataMigrationService';
import { healthWikiService } from '../healthWiki/services/healthWikiService';
import { canUseHealthWiki } from '../healthWiki/access';
import { emergencyService } from '../emergency/emergencyService';
import type { HealthArticle } from '../healthWiki/types';

/**
 * Everything the Today page shows, loaded in parallel. Each source is fetched
 * only when the user may open its page, and a source that fails is reported as
 * `null` so the rest of the page still shows.
 */
export type Product = '1hms' | '1rad' | 'dd' | 'all';

export interface HmsPending {
    hospitalSubscriptionId: string; hospitalId: string; hospitalName: string; planName: string;
    applicationName: string; paymentAmount: number | null; paymentMode: string | null; paymentDate: string | null;
}
export interface RadPending {
    requestId: string; hospitalId: string; hospitalName: string; planName: string; billingCycle: string;
    status: string; amount: number; paymentMode: string; createdAt: string;
}

export interface TodayData {
    hmsPending: HmsPending[] | null;
    radPending: RadPending[] | null;
    hospitals: Hospital[] | null;
    radCentres: RadHospitalItem[] | null;
    totals: { hospitals: number; doctors: number; patients: number; users: number } | null;
    failedImports: BatchListItem[] | null;
    articlesToReview: HealthArticle[] | null;
    placesToVerify: number | null;
    router: { reachable: boolean; modelBuiltAt: string | null; lastDecisionReceivedAt: string | null; error: string | null } | null;
}

const settle = async <T,>(allowed: boolean, job: () => Promise<T>): Promise<T | null> => {
    if (!allowed) return null;
    try { return await job(); } catch { return null; }
};

export const loadToday = async (perms: string[]): Promise<TodayData> => {
    const can = (p: string) => perms.includes(p);
    const [hmsPending, radPending, hospitals, radCentres, totals, failedImports, articlesToReview, placesToVerify, router] = await Promise.all([
        settle(can('subscriptions.view'), async () => {
            const r = await api.get<HmsPending[]>('/SubscriptionApproval/pending');
            return Array.isArray(r.data) ? r.data : [];
        }),
        settle(can('subscriptions.view'), async () => {
            const r = await api.get<RadPending[]>(API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS);
            return (Array.isArray(r.data) ? r.data : []).filter(x => String(x.status).toLowerCase() === 'pending');
        }),
        settle(can('onboarded-hospitals.view'), async () => (await getHospitals(1, 500)).data || []),
        settle(can('dashboard.view'), () => getRadHospitals()),
        settle(can('dashboard.view'), async () => {
            const s = await getDashboardStats();
            return { hospitals: s.totalHospitals?.value ?? 0, doctors: s.totalDoctors?.value ?? 0, patients: s.totalPatients?.value ?? 0, users: s.totalUsers?.value ?? 0 };
        }),
        settle(can('data-migration.manage'), async () => (await getBatches(undefined, 1, 50)).data.filter(b => b.status === 'Failed')),
        settle(canUseHealthWiki(perms), async () => (await healthWikiService.list()).filter(a => a.status === 'IN_REVIEW')),
        settle(can('emergency.manage'), async () => (await emergencyService.places('PENDING')).pending),
        settle(true, async () => (await api.get(API_ENDPOINTS.AGENT_MONITOR.STATUS)).data),
    ]);
    return { hmsPending, radPending, hospitals, radCentres, totals, failedImports, articlesToReview, placesToVerify, router };
};

/** "2 h", "3 d", "just now" — how long something has been waiting. */
export const waited = (iso: string | null | undefined, now = Date.now()): string => {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const mins = Math.max(0, Math.round((now - t) / 60000));
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} h`;
    return `${Math.round(h / 24)} d`;
};

export const inr = (n: number | null | undefined) =>
    n == null ? '' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
