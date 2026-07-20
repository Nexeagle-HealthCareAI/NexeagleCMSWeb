import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface RegionVisitCount {
    country: string | null;
    region: string | null;
    city: string | null;
    count: number;
}

export interface PageVisitCount {
    pagePath: string | null;
    count: number;
}

export interface DailyVisitCount {
    date: string;
    count: number;
}

export interface SiteVisitStats {
    totalVisits: number;
    uniqueVisitors: number;
    topRegions: RegionVisitCount[];
    topPages: PageVisitCount[];
    dailyTrend: DailyVisitCount[];
}

export const getSiteVisitStats = async (from?: string, to?: string): Promise<SiteVisitStats> => {
    const response = await api.get<SiteVisitStats>(API_ENDPOINTS.INSIGHTS.SITE_VISITS, {
        params: { from: from || undefined, to: to || undefined }
    });
    return response.data;
};

export interface PatientLoginItem {
    mobileMasked: string;
    lastLoginAt: string | null;
    loginCount: number;
    firstSeenAt: string;
}

export interface PagedResponse<T> {
    data: T[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export const getPatientLogins = async (
    page: number,
    limit: number,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc'
): Promise<PagedResponse<PatientLoginItem>> => {
    const response = await api.get<PagedResponse<PatientLoginItem>>(API_ENDPOINTS.INSIGHTS.PATIENT_LOGINS, {
        params: { page, limit, search: search || undefined, sortBy: sortBy || undefined, sortDir: sortDir || undefined }
    });
    return response.data;
};

export interface OnlineAppointmentItem {
    apptId: string;
    bookedAt: string;
    apptDate: string;
    status: string;
    patientName: string | null;
    patientMobileMasked: string | null;
    doctorName: string | null;
    hospitalName: string | null;
    isLoggedIn: boolean;
    bookedByMobileMasked: string | null;
    ipAddress: string | null;
    referrerUrl: string | null;
    utmCampaign: string | null;
}

export const getOnlineAppointments = async (
    page: number,
    limit: number,
    from?: string,
    to?: string,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
    source?: string
): Promise<PagedResponse<OnlineAppointmentItem>> => {
    const response = await api.get<PagedResponse<OnlineAppointmentItem>>(API_ENDPOINTS.INSIGHTS.APPOINTMENTS, {
        params: {
            page, limit,
            from: from || undefined,
            to: to || undefined,
            search: search || undefined,
            sortBy: sortBy || undefined,
            sortDir: sortDir || undefined,
            source: source || undefined,
        }
    });
    return response.data;
};

// ── Auth Funnel (WhatsApp Login) ────────────────────────────────────────────
export interface AuthFunnelStats {
    totalVisitorSessions: number;
    loginInitiatedSessions: number;
    otpSentSessions: number;
    otpVerifiedSessions: number;
    loginInitiationRatePct: number;
    authCompletionRatePct: number;
    avgTimeToAuthenticateSeconds: number | null;
}

export const getAuthFunnelStats = async (from?: string, to?: string): Promise<AuthFunnelStats> => {
    const response = await api.get<AuthFunnelStats>(API_ENDPOINTS.INSIGHTS.AUTH_FUNNEL, {
        params: { from: from || undefined, to: to || undefined }
    });
    return response.data;
};

export interface AuthFunnelAttemptItem {
    mobileMasked: string;
    otpSentAt: string | null;
    verifiedAt: string | null;
    outcome: string;
    timeToAuthenticateSeconds: number | null;
    country: string | null;
    region: string | null;
    city: string | null;
}

export const getAuthFunnelAttempts = async (
    page: number,
    limit: number,
    from?: string,
    to?: string,
    search?: string
): Promise<PagedResponse<AuthFunnelAttemptItem>> => {
    const response = await api.get<PagedResponse<AuthFunnelAttemptItem>>(API_ENDPOINTS.INSIGHTS.AUTH_FUNNEL_ATTEMPTS, {
        params: { page, limit, from: from || undefined, to: to || undefined, search: search || undefined }
    });
    return response.data;
};

// ── Booking & Search Funnel ─────────────────────────────────────────────────
export interface SpecialtyDemandItem {
    specialtyId: string;
    searchCount: number;
    profileViewCount: number;
    completedBookingCount: number;
}

export interface BookingFunnelStats {
    searchCount: number;
    profileViewCount: number;
    searchToViewRatePct: number;
    visitStepCount: number;
    detailsStepCount: number;
    doneStepCount: number;
    specialtyDemand: SpecialtyDemandItem[];
}

export const getBookingFunnelStats = async (from?: string, to?: string): Promise<BookingFunnelStats> => {
    const response = await api.get<BookingFunnelStats>(API_ENDPOINTS.INSIGHTS.BOOKING_FUNNEL, {
        params: { from: from || undefined, to: to || undefined }
    });
    return response.data;
};

// ── All Searches (raw log) ──────────────────────────────────────────────────
export interface SearchLogItem {
    occurredAt: string;
    query: string | null;
    specialtyId: string | null;
    resultsCount: number | null;
    aiUsed: boolean;
    country: string | null;
    region: string | null;
    city: string | null;
}

export const getSearchLog = async (
    page: number,
    limit: number,
    from?: string,
    to?: string,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc'
): Promise<PagedResponse<SearchLogItem>> => {
    const response = await api.get<PagedResponse<SearchLogItem>>(API_ENDPOINTS.INSIGHTS.SEARCHES, {
        params: {
            page, limit,
            from: from || undefined,
            to: to || undefined,
            search: search || undefined,
            sortBy: sortBy || undefined,
            sortDir: sortDir || undefined,
        }
    });
    return response.data;
};
