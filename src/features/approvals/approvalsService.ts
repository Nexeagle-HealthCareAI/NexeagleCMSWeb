import { api } from '../../services/api';
import { API_ENDPOINTS } from '../../services/endpoints';

/**
 * One inbox for manual plan payments from both products.
 *
 * 1HMS (EasyHMS) requests live in the CMS database (/SubscriptionApproval);
 * 1Rad keeps its own database, reached through the CMS proxy
 * (/rad-subscriptions/payment-requests, service key). Both are turned into the
 * same `Payment` shape here so the page treats them alike.
 */
export type ProductKey = '1hms' | '1rad';
export type PayStatus = 'waiting' | 'approved' | 'rejected' | 'replaced';

export interface Payment {
    key: string;
    product: ProductKey;
    /** The id the approve/reject call needs: hospitalId for 1HMS, requestId for 1Rad. */
    actionId: string;
    hospitalId: string;
    hospitalName: string;
    plan: string;
    amount: number | null;
    mode: string | null;
    reference: string | null;
    payer: string | null;
    submittedAt: string | null;
    status: PayStatus;
    reviewedAt: string | null;
    note: string | null;
    /** Extra facts worth checking before approving (referral, plan switch, storage). */
    extras: string[];
}

interface HmsPending {
    hospitalSubscriptionId: string; hospitalId: string; hospitalName: string; planName: string; applicationName: string;
    subscriptionEndDate: string | null; paymentAmount: number | null; paymentReference: string | null; paymentMode: string | null;
    paymentDate: string | null; isProratedSwitch: boolean; previousPlanName: string | null; proratedCreditAmount: number | null;
    referralCode: string | null; referralCodeRewardKind: 'PercentageOff' | 'ExtraMonths' | null; referralCodeRewardValue: number | null;
}
interface HmsHistory {
    paymentId: string; hospitalId: string; hospitalName: string; planName: string; applicationName: string; amount: number;
    reference: string; paymentMode: string | null; status: string; submittedAt: string; reviewedAt: string | null;
    rejectionReason: string | null; isProratedSwitch: boolean; previousPlanName: string | null; proratedCreditAmount: number | null;
    referralCode: string | null; referralCodeRewardKind: 'PercentageOff' | 'ExtraMonths' | null; referralCodeRewardValue: number | null;
}
interface RadRequest {
    requestId: string; hospitalId: string; hospitalName: string; planName: string; billingCycle: string; status: string;
    reviewNote: string | null; createdAt: string; paymentMode: string; amount: number; modules: string | null;
    storageOverageGb: number; storageOverageAmount: number; transactionReference: string; payerName: string;
    payerContact: string; paidAt: string; reviewedAt: string | null;
}

export const inr = (n: number | null | undefined) =>
    n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const referral = (code: string | null, kind: string | null, value: number | null) =>
    code ? `Referral code ${code}${kind === 'PercentageOff' ? ` · ${value}% off` : kind === 'ExtraMonths' ? ` · +${value} month${value === 1 ? '' : 's'}` : ''}` : null;
const planSwitch = (on: boolean, prev: string | null, credit: number | null) =>
    on ? `Switching from ${prev || 'another plan'}${credit ? ` · credit ${inr(credit)}` : ''}` : null;
const edition = (modules: string | null) => {
    const m = (modules || '').toUpperCase();
    if (m.includes('RIS') && m.includes('PACS')) return 'RIS + PACS';
    if (m.includes('PACS')) return 'PACS';
    if (m.includes('RIS')) return 'RIS';
    return null;
};
const hmsStatus = (s: string): PayStatus => {
    const v = s.toLowerCase();
    return v === 'approved' ? 'approved' : v === 'rejected' ? 'rejected' : v === 'superseded' ? 'replaced' : 'waiting';
};
const productName = (app: string) => (/1rad/i.test(app) ? '1Rad' : '1HMS');

const fromHmsPending = (r: HmsPending): Payment => ({
    key: `hms-p-${r.hospitalSubscriptionId}`, product: /1rad/i.test(r.applicationName || '') ? '1rad' : '1hms',
    actionId: r.hospitalId, hospitalId: r.hospitalId, hospitalName: r.hospitalName,
    plan: `${productName(r.applicationName || '')} · ${r.planName}`, amount: r.paymentAmount, mode: r.paymentMode,
    reference: r.paymentReference, payer: null, submittedAt: r.paymentDate, status: 'waiting', reviewedAt: null, note: null,
    extras: [planSwitch(r.isProratedSwitch, r.previousPlanName, r.proratedCreditAmount), referral(r.referralCode, r.referralCodeRewardKind, r.referralCodeRewardValue)].filter(Boolean) as string[],
});
const fromHmsHistory = (r: HmsHistory): Payment => ({
    key: `hms-h-${r.paymentId}`, product: /1rad/i.test(r.applicationName || '') ? '1rad' : '1hms',
    actionId: r.hospitalId, hospitalId: r.hospitalId, hospitalName: r.hospitalName,
    plan: `${productName(r.applicationName || '')} · ${r.planName}`, amount: r.amount, mode: r.paymentMode, reference: r.reference,
    payer: null, submittedAt: r.submittedAt, status: hmsStatus(r.status), reviewedAt: r.reviewedAt, note: r.rejectionReason,
    extras: [planSwitch(r.isProratedSwitch, r.previousPlanName, r.proratedCreditAmount), referral(r.referralCode, r.referralCodeRewardKind, r.referralCodeRewardValue)].filter(Boolean) as string[],
});
const fromRad = (r: RadRequest): Payment => {
    const s = (r.status || '').toLowerCase();
    return {
        key: `rad-${r.requestId}`, product: '1rad', actionId: r.requestId, hospitalId: r.hospitalId, hospitalName: r.hospitalName,
        plan: ['1Rad', edition(r.modules), r.planName, r.billingCycle].filter(Boolean).join(' · '),
        amount: r.amount, mode: r.paymentMode, reference: r.transactionReference,
        payer: [r.payerName, r.payerContact].filter(Boolean).join(' · ') || null,
        submittedAt: r.paidAt || r.createdAt,
        status: s === 'pending' ? 'waiting' : s === 'approved' ? 'approved' : 'rejected',
        reviewedAt: r.reviewedAt, note: r.reviewNote,
        extras: r.storageOverageGb > 0 ? [`Includes ${r.storageOverageGb} GB extra storage (${inr(r.storageOverageAmount)})`] : [],
    };
};

export interface LoadResult { payments: Payment[]; errors: string[] }

export const loadPayments = async (): Promise<LoadResult> => {
    const [pending, history, rad] = await Promise.allSettled([
        api.get<HmsPending[]>('/SubscriptionApproval/pending'),
        api.get<HmsHistory[]>('/SubscriptionApproval/history'),
        api.get<RadRequest[]>(API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS),
    ]);
    const payments: Payment[] = [];
    const errors: string[] = [];
    if (pending.status === 'fulfilled' && Array.isArray(pending.value.data)) payments.push(...pending.value.data.map(fromHmsPending));
    else errors.push('Could not load waiting 1HMS payments.');
    if (history.status === 'fulfilled' && Array.isArray(history.value.data)) {
        // The history list also carries the still-waiting payments; those already came from /pending.
        payments.push(...history.value.data.filter(h => hmsStatus(h.status) !== 'waiting').map(fromHmsHistory));
    } else errors.push('Could not load past 1HMS payments.');
    if (rad.status === 'fulfilled' && Array.isArray(rad.value.data)) payments.push(...rad.value.data.map(fromRad));
    else errors.push('Could not load 1Rad payments.');
    return { payments, errors };
};

export const errorText = (e: unknown, fallback: string) => {
    const d = (e as { response?: { data?: unknown } })?.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    const m = (d as { message?: string } | undefined)?.message;
    return m || fallback;
};

export const approvePayment = async (p: Payment): Promise<string | null> => {
    const res = p.key.startsWith('rad-')
        ? await api.post(`${API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS}/${p.actionId}/approve`, {})
        : await api.post(`/SubscriptionApproval/${p.actionId}/approve`, {});
    return (res.data as { message?: string } | undefined)?.message || null;
};

export const rejectPayment = async (p: Payment, reason: string): Promise<string | null> => {
    const res = p.key.startsWith('rad-')
        ? await api.post(`${API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS}/${p.actionId}/reject`, { reason })
        : await api.post(`/SubscriptionApproval/${p.actionId}/reject`, { reason });
    return (res.data as { message?: string } | undefined)?.message || null;
};
