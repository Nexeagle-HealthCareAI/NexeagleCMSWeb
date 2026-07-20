import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface User {
    name: string;
    role: string;
    contact: string;
    email: string;
    status: string;
    lastLoginTime?: string;
    loginMethod?: string;
}

export interface Doctor {
    name: string;
    departments: string[];
    speciality: string;
    registeredOn: string;
    degree: string;
    registrationNumber: string;
    appointments: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
    uniquePatients: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
}

export interface ChartDataPoint {
    label: string;
    value: number;
}

export interface HospitalStats {
    uniquePatients: {
        daily: ChartDataPoint[];
        weekly: ChartDataPoint[];
        monthly: ChartDataPoint[];
        yearly: ChartDataPoint[];
    };
    appointments: {
        daily: ChartDataPoint[];
        weekly: ChartDataPoint[];
        monthly: ChartDataPoint[];
        yearly: ChartDataPoint[];
    };
}

export interface HospitalPaymentHistoryItem {
    planName: string;
    amount: number;
    reference: string;
    paymentMode: string | null;
    status: string; // PendingApproval, Approved, Rejected
    submittedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
}

export interface Hospital {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    contactNumber: string;
    email: string;
    hospitalType?: string; // Optional in API response
    partnerName: string;
    totalPatients: number;
    registeredOn: string;
    status: string;
    // Subscription summary (list + detail)
    subscriptionPlanName?: string | null;
    subscriptionStatus?: string | null; // Trial, Active, Expired, Blocked, Rejected, Pending, PendingApproval
    subscriptionDaysRemaining?: number | null;
    subscriptionIsEnterprise?: boolean;
    // Detail-only
    trialStartDate?: string | null;
    trialEndDate?: string | null;
    subscriptionStartDate?: string | null;
    subscriptionEndDate?: string | null;
    paymentHistory?: HospitalPaymentHistoryItem[];
    users?: User[]; // Optional in API response
    doctors?: Doctor[]; // Optional in API response
    stats?: HospitalStats;
    // Quick counts — not date-scoped.
    totalDoctors?: number;
    totalNonDoctorUsers?: number;
}

// Online (booked via NexEagleWebsite) vs hospital-booked (created by staff in easyHMSWeb)
// appointment counts for an arbitrary date range.
export interface HospitalAppointmentSourceStats {
    onlineAppointments: number;
    hospitalAppointments: number;
    totalAppointments: number;
}

export interface HospitalsResponse {
    data: Hospital[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export const getHospitals = async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
    status?: string,
    subscriptionStatus?: string
): Promise<HospitalsResponse> => {
    try {
        const response = await api.get<HospitalsResponse>(API_ENDPOINTS.HOSPITALS.GET_ALL, {
            params: {
                page, limit,
                search: search || undefined,
                sortBy: sortBy || undefined,
                sortDir: sortDir || undefined,
                status: status || undefined,
                subscriptionStatus: subscriptionStatus || undefined
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getHospitalById = async (id: string): Promise<Hospital> => {
    try {
        const response = await api.get<Hospital>(`${API_ENDPOINTS.HOSPITALS.GET_BY_ID}/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// from/to are "yyyy-MM-dd" (inclusive). Omit both for all-time; pass the same date for both for
// "today". Backend distinguishes online vs hospital-booked via Appointments.BookingSource.
export const getHospitalAppointmentStats = async (
    id: string,
    from?: string,
    to?: string
): Promise<HospitalAppointmentSourceStats> => {
    const response = await api.get<HospitalAppointmentSourceStats>(
        `${API_ENDPOINTS.HOSPITALS.APPOINTMENT_STATS}/${id}/appointment-stats`,
        { params: { from: from || undefined, to: to || undefined } }
    );
    return response.data;
};

export interface StatMetric {
    value: number;
    change: number;
    changeType: 'increase' | 'decrease' | 'nochange';
    period: string;
}

export interface DashboardStats {
    totalHospitals: StatMetric;
    totalDoctors: StatMetric;
    totalPatients: StatMetric;
    totalUsers: StatMetric;
    charts: {
        hospitals: {
            daily: ChartDataPoint[];
            weekly: ChartDataPoint[];
            monthly: ChartDataPoint[];
            yearly: ChartDataPoint[];
        };
        doctors: {
            daily: ChartDataPoint[];
            weekly: ChartDataPoint[];
            monthly: ChartDataPoint[];
            yearly: ChartDataPoint[];
        };
        patients: {
            daily: ChartDataPoint[];
            weekly: ChartDataPoint[];
            monthly: ChartDataPoint[];
            yearly: ChartDataPoint[];
        };
        users: {
            daily: ChartDataPoint[];
            weekly: ChartDataPoint[];
            monthly: ChartDataPoint[];
            yearly: ChartDataPoint[];
        };
    };
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
    try {
        const response = await api.get<DashboardStats>(API_ENDPOINTS.DASHBOARD.STATS);
        return response.data;
    } catch (error) {
        throw error;
    }
};
