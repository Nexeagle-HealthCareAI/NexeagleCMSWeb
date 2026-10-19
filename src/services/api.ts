import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { API_ENDPOINTS } from './endpoints';
import { toast } from 'sonner';
import { DEV_BYPASS } from '../devBypass';

if (!import.meta.env.VITE_API_URL) {
    console.warn('[api] VITE_API_URL is not set – falling back to hard-coded dev URL.');
}
const API_URL = import.meta.env.VITE_API_URL || 'http://151.185.45.77:5002/api/v1';

// SignalR hub lives at <origin>/chathub (outside the /api/v1 prefix), derived from the
// same configured API URL so it works across dev/prod instead of a hardcoded localhost.
export const SIGNALR_URL = API_URL.replace(/\/api\/v1\/?$/, '') + '/chathub';
// CRM alerts hub (CrmHub.cs) - same origin, needs a JWT with marketing.view.
export const CRM_HUB_URL = API_URL.replace(/\/api\/v1\/?$/, '') + '/hubs/crm';

export const api = axios.create({
    baseURL: API_URL,
    timeout: 15_000, // 15-second request timeout
    withCredentials: true, // required for cross-origin HttpOnly refresh-token cookie
    headers: {
        'Content-Type': 'application/json',
        'accept': '*/*'
    },
});

import { offlineCache } from '../utils/offlineCache';
import { syncManager } from '../utils/syncManager';
import { isCacheableUrl } from '../utils/clientData';
import { memoGet, cacheKey, isMemoCacheable, clearRequestCache } from '../utils/requestCache';

// Cache key generator
const getCacheKey = (config: any) => {
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    return `${url}?${params}`;
};

// Map URL to a friendly operation description
const getMutationDescription = (config: any) => {
    const url = config.url || '';
    if (url.includes('/status')) return 'Update Subscription Status';
    if (url.includes('/validity')) return 'Set Subscription Validity';
    if (url.includes('/plan')) return 'Assign Subscription Plan';
    if (url.includes('/approve-payment')) return 'Approve Payment Request';
    return 'Save CMS Update';
};

// Attach the access token and handle offline interception
api.interceptors.request.use(
    (config) => {
        // Intercept when device is explicitly offline
        if (!navigator.onLine) {
            if (config.method?.toLowerCase() === 'get') {
                console.log('[API Interceptor] Offline: Fetching from local cache...');
                // Throw cancel token to immediately jump to response interceptor bypass
                config.cancelToken = new axios.CancelToken((cancel) => {
                    cancel(`offline-get:${getCacheKey(config)}`);
                });
            } else if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
                console.log('[API Interceptor] Offline: Queuing mutation for sync...');
                const description = getMutationDescription(config);
                syncManager.enqueue(
                    config.url || '', 
                    config.method.toUpperCase() as any, 
                    config.data, 
                    description
                );
                config.cancelToken = new axios.CancelToken((cancel) => {
                    cancel(`offline-mutate:${description}`);
                });
            }
        }

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
    (response) => {
        // A successful change invalidates every cached GET (see utils/requestCache.ts).
        const method = response.config.method?.toLowerCase();
        if (method && method !== 'get') clearRequestCache();

        // Cache allow-listed GET responses for offline use (never patient, chat, lead or user data)
        if (response.config.method?.toLowerCase() === 'get' && response.status === 200 && isCacheableUrl(response.config.url)) {
            const cacheKey = getCacheKey(response.config);
            offlineCache.set(cacheKey, response.data);
        }
        return response;
    },
    async (error) => {
        const original = error.config;

        // 1. Handle custom PWA offline interceptors (Cancelled requests)
        if (axios.isCancel(error)) {
            const message = error.message || '';
            if (message.startsWith('offline-get:')) {
                const cacheKey = message.replace('offline-get:', '');
                const cachedData = offlineCache.get(cacheKey);
                if (cachedData !== null) {
                    return Promise.resolve({
                        data: cachedData,
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                        config: original
                    });
                }
                return Promise.reject(new Error('No cached data available offline.'));
            } else if (message.startsWith('offline-mutate:')) {
                const desc = message.replace('offline-mutate:', '');
                return Promise.resolve({
                    data: { message: `Operation "${desc}" saved offline. Will sync when online.`, status: 'queued' },
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: original
                });
            }
        }

        // 2. Fallback to cache for online requests that fail due to network loss/timeout
        if (original && original.method?.toLowerCase() === 'get' && (!error.response || error.code === 'ECONNABORTED')) {
            const cacheKey = getCacheKey(original);
            const cachedData = offlineCache.get(cacheKey);
            if (cachedData !== null) {
                toast.warning('Network issue. Displaying cached data.', { position: 'bottom-center' });
                return Promise.resolve({
                    data: cachedData,
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: original
                });
            }
        }

        const status = error.response?.status;
        if (status !== undefined && status >= 500) {
            // The API logs every request under this id (RequestLoggingMiddleware): quote it in bug reports.
            console.error(`[api] ${original?.method?.toUpperCase()} ${original?.url} failed with ${status}; request id ${error.response?.headers?.['x-request-id'] ?? 'unknown'}`);
        }
        const isAuthCall = typeof original?.url === 'string' && original.url.includes('/auth/');

        // In the local login-bypass mode a 401 is expected; never refresh or sign out because of it.
        if (status === 401 && original && !original._retry && !isAuthCall && !DEV_BYPASS) {
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


// ── Short-lived GET cache (memory only) ────────────────────────────────────────────────────────
// Wraps api.get so repeat calls within 30 s, and concurrent identical calls, share one request.
// Pass { headers: { 'Cache-Control': 'no-cache' } } to force a fresh request.
const rawGet = api.get.bind(api);
api.get = (<T = unknown, R = AxiosResponse<T>, D = unknown>(url: string, config?: AxiosRequestConfig<D>): Promise<R> => {
    const forceFresh = (config?.headers as Record<string, unknown> | undefined)?.['Cache-Control'] === 'no-cache';
    if (forceFresh || !isMemoCacheable(url)) return rawGet<T, R, D>(url, config);
    return memoGet<R>(cacheKey(url, config?.params), () => rawGet<T, R, D>(url, config));
}) as typeof api.get;

// Also cleared after an offline sync and when a hot lead arrives (logout clears it in useAuthStore,
// which cannot be subscribed to here: the store imports this module, so it is not ready yet).
if (typeof window !== 'undefined') {
    window.addEventListener('sync-completed', clearRequestCache);
    window.addEventListener('crm-hot-lead-received', clearRequestCache);
}
