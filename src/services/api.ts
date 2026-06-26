import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { API_ENDPOINTS } from './endpoints';

if (!import.meta.env.VITE_API_URL) {
    console.warn('[api] VITE_API_URL is not set – falling back to hard-coded dev URL.');
}
const API_URL = import.meta.env.VITE_API_URL || 'http://151.185.47.77/api/v1';

// SignalR hub lives at <origin>/chathub (outside the /api/v1 prefix), derived from the
// same configured API URL so it works across dev/prod instead of a hardcoded localhost.
export const SIGNALR_URL = API_URL.replace(/\/api\/v1\/?$/, '') + '/chathub';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 15_000, // 15-second request timeout
    withCredentials: true, // required for cross-origin HttpOnly refresh-token cookie
    headers: {
        'Content-Type': 'application/json',
        'accept': '*/*'
    },
});

// Attach the access token to every request.
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// On a 401, try to rotate the refresh token once, then replay the request.
// Concurrent 401s share a single in-flight refresh.
let refreshPromise: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
    // Refresh token is in the HttpOnly cookie; withCredentials sends it automatically.
    const resp = await api.post(API_ENDPOINTS.AUTH.REFRESH);
    useAuthStore.getState().applySession(resp.data);
    return resp.data.token as string;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const status = error.response?.status;
        const isAuthCall = typeof original?.url === 'string' && original.url.includes('/auth/');

        if (status === 401 && original && !original._retry && !isAuthCall) {
            original._retry = true;
            try {
                const newToken = await (refreshPromise ??= doRefresh());
                refreshPromise = null;
                if (newToken) {
                    original.headers = original.headers ?? {};
                    original.headers.Authorization = `Bearer ${newToken}`;
                    return api(original);
                }
            } catch (refreshError) {
                refreshPromise = null;
                // Network/timeout error: don't force logout – let the request fail naturally.
                if (axios.isAxiosError(refreshError) && !refreshError.response) {
                    return Promise.reject(error);
                }
            }
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);
