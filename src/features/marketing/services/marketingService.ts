import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface DemoLoginLeadItem {
    leadId: string;
    occurredAt: string;
    patientName: string | null;
    mobile: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
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

export const getDemoLoginLeads = async (
    page: number,
    limit: number
): Promise<PagedResponse<DemoLoginLeadItem>> => {
    const response = await api.get<PagedResponse<DemoLoginLeadItem>>(API_ENDPOINTS.MARKETING.DEMO_LOGINS, {
        params: { page, limit }
    });
    return response.data;
};

export interface DemoLocationCount {
    country: string | null;
    region: string | null;
    city: string | null;
    count: number;
}

export interface DemoLoginStats {
    totalLogins: number;
    uniqueVisitors: number;
    topLocations: DemoLocationCount[];
}

export const getDemoLoginStats = async (): Promise<DemoLoginStats> => {
    const response = await api.get<DemoLoginStats>(API_ENDPOINTS.MARKETING.DEMO_LOGINS_STATS);
    return response.data;
};
