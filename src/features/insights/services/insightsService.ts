import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

// People only (crawlers and data-centre traffic are excluded and counted separately). A visit is one
// browser session: page views with no gap of 30 minutes or more. Days are India time (IST).
export type SiteKey = 'doctordekho' | 'nexeagle';

export interface LocationCount {
    name: string;
    /** State, for a city row. */
    parent: string | null;
    visits: number;
}

export interface PageVisitCount {
    pagePath: string | null;
    /** Page views. */
    count: number;
    visits: number;
}

export interface DailyVisitCount {
    date: string;
    /** Visits that started that day. */
    count: number;
    pageViews: number;
}

export interface SiteVisitStats {
    site: SiteKey | null;
    from: string;
    to: string;
    visits: number;
    pageViews: number;
    automatedVisitsExcluded: number;
    automatedPageViewsExcluded: number;
    visitsInIndia: number;
    visitsOutsideIndia: number;
    visitsLocationUnknown: number;
    indiaStates: LocationCount[];
    indiaCities: LocationCount[];
    countries: LocationCount[];
    careInterestCities: LocationCount[];
    bookingCities: LocationCount[];
    topPages: PageVisitCount[];
    dailyTrend: DailyVisitCount[];
    sites: LocationCount[];
}

export const getSiteVisitStats = async (from?: string, to?: string, site?: SiteKey): Promise<SiteVisitStats> => {
    const response = await api.get<SiteVisitStats>(API_ENDPOINTS.INSIGHTS.SITE_VISITS, {
        params: { from: from || undefined, to: to || undefined, site: site || undefined }
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

