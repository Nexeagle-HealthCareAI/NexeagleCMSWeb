import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface HealthCheck {
    component: string;
    status: string;
    description: string;
}

export interface HealthResponse {
    status: string;
    totalDuration: string;
    checks: HealthCheck[];
}

export const getApplicationHealth = async (): Promise<HealthResponse> => {
    try {
        const response = await api.get<HealthResponse>(API_ENDPOINTS.SYSTEM.HEALTH);
        return response.data;
    } catch (error) {
        throw error;
    }
};
