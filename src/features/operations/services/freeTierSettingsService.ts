import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface FreeTierSettingsResponse {
    globalMonthlyLimit: number;
}

export interface HospitalFreeTierLimitItem {
    hospitalId: string;
    hospitalName: string | null;
    // null = no override -- this hospital uses the global default.
    monthlyLimit: number | null;
    effectiveLimit: number;
}

export interface UpdateFreeTierLimitResult {
    success: boolean;
    message?: string | null;
}

export const getGlobalFreeTierLimit = async (): Promise<FreeTierSettingsResponse> => {
    const response = await api.get<FreeTierSettingsResponse>(API_ENDPOINTS.FREE_TIER_SETTINGS.GLOBAL);
    return response.data;
};

export const setGlobalFreeTierLimit = async (monthlyLimit: number): Promise<UpdateFreeTierLimitResult> => {
    const response = await api.put<UpdateFreeTierLimitResult>(API_ENDPOINTS.FREE_TIER_SETTINGS.GLOBAL, { monthlyLimit });
    return response.data;
};

export const getHospitalFreeTierOverrides = async (): Promise<HospitalFreeTierLimitItem[]> => {
    const response = await api.get<HospitalFreeTierLimitItem[]>(API_ENDPOINTS.FREE_TIER_SETTINGS.HOSPITALS);
    return response.data;
};

// monthlyLimit null clears the override, reverting the hospital to the global default.
export const setHospitalFreeTierOverride = async (hospitalId: string, monthlyLimit: number | null): Promise<UpdateFreeTierLimitResult> => {
    const response = await api.put<UpdateFreeTierLimitResult>(`${API_ENDPOINTS.FREE_TIER_SETTINGS.HOSPITALS}/${hospitalId}`, { monthlyLimit });
    return response.data;
};
