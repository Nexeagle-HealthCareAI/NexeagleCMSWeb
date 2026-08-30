import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

// ── Types ───────────────────────────────────────────────────────────────────

export type LeadStage =
    | 'New'
    | 'Contacted'
    | 'Demo Scheduled'
    | 'Demo Done'
    | 'Negotiation'
    | 'Closed Won'
    | 'Closed Lost';

export type LeadPriority = 'High' | 'Medium' | 'Low';
export type LeadSource = 'Cold Call' | 'WhatsApp' | 'Website' | 'Referral' | 'Event' | 'Partner' | 'Manual' | 'Other';
export type ActivityType = 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Note';

export interface SalesLeadFollowUp {
    followUpId: string;
    activityType: ActivityType;
    notes: string;
    authorName: string | null;
    createdAt: string;
}

export interface SalesLeadSummary {
    leadId: string;
    hospitalName: string;
    contactName: string | null;
    mobile: string | null;
    city: string | null;
    state: string | null;
    source: LeadSource;
    stage: LeadStage;
    priority: LeadPriority;
    assignedToUserId: string | null;
    assignedToName: string | null;
    followUpCount: number;
    lastFollowUpAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SalesLeadDetail extends SalesLeadSummary {
    email: string | null;
    notes: string | null;
    createdByUserId: string | null;
    followUps: SalesLeadFollowUp[];
}

export interface SalesLeadListResult {
    data: SalesLeadSummary[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
}

export interface CreateSalesLeadRequest {
    hospitalName: string;
    contactName?: string;
    mobile?: string;
    email?: string;
    city?: string;
    state?: string;
    source: LeadSource;
    stage: LeadStage;
    priority: LeadPriority;
    notes?: string;
    assignedToUserId?: string;
}

export interface UpdateSalesLeadRequest {
    hospitalName?: string;
    contactName?: string;
    mobile?: string;
    email?: string;
    city?: string;
    state?: string;
    source?: LeadSource;
    stage?: LeadStage;
    priority?: LeadPriority;
    notes?: string;
    assignedToUserId?: string;
}

export interface AddFollowUpRequest {
    activityType: ActivityType;
    notes: string;
}

export interface SalesLeadFilter {
    stage?: LeadStage | '';
    priority?: LeadPriority | '';
    assignedToUserId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

// ── API Calls ────────────────────────────────────────────────────────────────

export const salesLeadService = {
    getLeads: async (filter: SalesLeadFilter = {}): Promise<SalesLeadListResult> => {
        const params: Record<string, string | number | undefined> = {};
        if (filter.stage)            params.stage = filter.stage;
        if (filter.priority)         params.priority = filter.priority;
        if (filter.assignedToUserId) params.assignedToUserId = filter.assignedToUserId;
        if (filter.search)           params.search = filter.search;
        if (filter.page)             params.page = filter.page;
        if (filter.limit)            params.limit = filter.limit;

        const res = await api.get<SalesLeadListResult>(API_ENDPOINTS.MARKETING.LEADS, { params });
        return res.data;
    },

    getLead: async (leadId: string): Promise<SalesLeadDetail> => {
        const res = await api.get<SalesLeadDetail>(`${API_ENDPOINTS.MARKETING.LEAD_DETAIL}/${leadId}`);
        return res.data;
    },

    createLead: async (req: CreateSalesLeadRequest): Promise<SalesLeadDetail> => {
        const res = await api.post<SalesLeadDetail>(API_ENDPOINTS.MARKETING.LEADS, req);
        return res.data;
    },

    updateLead: async (leadId: string, req: UpdateSalesLeadRequest): Promise<SalesLeadDetail> => {
        const res = await api.put<SalesLeadDetail>(`${API_ENDPOINTS.MARKETING.LEAD_DETAIL}/${leadId}`, req);
        return res.data;
    },

    deleteLead: async (leadId: string): Promise<void> => {
        await api.delete(`${API_ENDPOINTS.MARKETING.LEAD_DETAIL}/${leadId}`);
    },

    addFollowUp: async (leadId: string, req: AddFollowUpRequest): Promise<SalesLeadFollowUp> => {
        const res = await api.post<SalesLeadFollowUp>(
            `${API_ENDPOINTS.MARKETING.LEAD_FOLLOWUPS}/${leadId}/followups`,
            req
        );
        return res.data;
    },
};
