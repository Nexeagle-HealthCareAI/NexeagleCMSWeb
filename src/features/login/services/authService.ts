import axios from 'axios';
import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
            email,
            password
        });

        return response.data;
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data?.message || 'Login failed');
        }
        throw new Error('Network error or server unreachable');
    }
};

export const logout = async (): Promise<void> => {
    // In a real app, this might invalidate the token on the server
    // For now, client-side cleanup is handled by the store
    return Promise.resolve();
};

