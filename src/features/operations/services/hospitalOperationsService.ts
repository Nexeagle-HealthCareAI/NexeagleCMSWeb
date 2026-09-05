import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface HospitalOperationsSummaryItem {
    hospitalId: string;
    hospitalName: string;
    admissionsCount: number;
    pathologyOrdersCount: number;
    pharmacyInvoiceCount: number;
    pharmacyRevenue: number;
    onlineAppointmentsCount: number;
}

export interface HospitalOperationsSummaryResponse {
    success: boolean;
    message?: string | null;
    fromDate: string;
    toDate: string;
    hospitals: HospitalOperationsSummaryItem[];
}

// fromDate/toDate: "YYYY-MM-DD" — a single-day report passes the same value for both.
export const getHospitalOperationsSummary = async (
    fromDate: string,
    toDate: string
): Promise<HospitalOperationsSummaryResponse> => {
    const response = await api.get<HospitalOperationsSummaryResponse>(API_ENDPOINTS.HOSPITAL_OPERATIONS.SUMMARY, {
        params: { fromDate, toDate },
    });
    return response.data;
};
