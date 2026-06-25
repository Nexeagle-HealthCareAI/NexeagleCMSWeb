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
    expiresInSeconds: number;
    user: User;
    permissions: string[];
    mustChangePassword: boolean;
}

export interface MeResponse {
    user: User;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
}

export interface OtpRequestResponse {
    message: string;
    deliveryMethod: 'email' | 'sms';
    /** Populated in Development only – displayed in UI so you can test without a mail/SMS provider. */
    devOtp?: string;
}

const toError = (error: unknown, fallback: string): Error => {
    if (axios.isAxiosError(error) && error.response) {
        return new Error((error.response.data as any)?.message || fallback);
    }
    return new Error('Network error or server unreachable');
};

/** Password-based login. `identifier` can be an email address or phone number. */
export const login = async (identifier: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { identifier, password });
        return response.data;
    } catch (error) {
        throw toError(error, 'Login failed');
    }
};

export const getMe = async (): Promise<MeResponse> => {
    const response = await api.get<MeResponse>(API_ENDPOINTS.AUTH.ME);
    return response.data;
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
        await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword });
    } catch (error) {
        throw toError(error, 'Password change failed');
    }
};

/** Renew the access token using the HttpOnly refresh cookie (no body needed). */
export const refreshSession = async (): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.REFRESH);
        return response.data;
    } catch (error) {
        throw toError(error, 'Session refresh failed');
    }
};

export const logout = async (): Promise<void> => {
    try {
        await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
        // Best-effort – client state is cleared regardless.
    }
};

/** Step 1 – request an OTP to be sent to the given email or phone. */
export const requestOtp = async (identifier: string): Promise<OtpRequestResponse> => {
    try {
        const response = await api.post<OtpRequestResponse>(API_ENDPOINTS.AUTH.REQUEST_OTP, { identifier });
        return response.data;
    } catch (error) {
        throw toError(error, 'Failed to send OTP');
    }
};

/** Step 2 – verify the OTP and sign in. */
export const loginWithOtp = async (identifier: string, otp: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN_OTP, { identifier, otp });
        return response.data;
    } catch (error) {
        throw toError(error, 'OTP verification failed');
    }
};

// ── Forgot Password ──────────────────────────────────────────────────────────

/** Step 1 – send a password-reset OTP to the given email or phone. */
export const requestForgotPasswordOtp = async (identifier: string): Promise<OtpRequestResponse> => {
    try {
        const response = await api.post<OtpRequestResponse>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { identifier });
        return response.data;
    } catch (error) {
        throw toError(error, 'Failed to send password-reset OTP');
    }
};

/** Step 2 – verify the OTP and set the new password. */
export const resetPasswordWithOtp = async (identifier: string, otp: string, newPassword: string): Promise<void> => {
    try {
        await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { identifier, otp, newPassword });
    } catch (error) {
        throw toError(error, 'Password reset failed');
    }
};

