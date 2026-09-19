import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface HospitalOperationsSummaryItem {
    hospitalId: string;
    hospitalName: string;
    admissionsCount: number;
    pathologyOrdersCount: number;
    pharmacyInvoiceCount: number;
    // Total OPD appointments (walk-in AND online) for the date range. onlineAppointmentsCount
    // below is the NEXEAGLE_PUBLIC-only subset of this.
    opdAppointmentsCount: number;
    onlineAppointmentsCount: number;
    // "Trial" (or no subscription row) = free tier; anything else (e.g. "Active") = paid, no limit.
    subscriptionStatus: string;
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
