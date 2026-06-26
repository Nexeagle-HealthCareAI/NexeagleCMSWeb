import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    login as apiLogin,
    logout as apiLogout,
    getMe as apiGetMe,
    changePassword as apiChangePassword,
    refreshSession as apiRefreshSession,
    loginWithOtp as apiLoginWithOtp,
    type User,
    type LoginResponse,
} from '../features/login/services/authService';

interface AuthState {
    user: User | null;
    /** Access token */
    token: string | null;
    permissions: string[];
    mustChangePassword: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (identifier: string, password: string) => Promise<void>;
    logout: () => void;
    applySession: (data: LoginResponse) => void;
    /** OTP login – call after the user enters the 6-digit code. */
    applyOtpSession: (identifier: string, otp: string) => Promise<void>;
    fetchMe: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    hasAccess: (permissionKey: string) => boolean;
    /** Silently renew the access token using the HttpOnly refresh cookie. */
    silentRefresh: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            permissions: [],
            mustChangePassword: false,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await apiLogin(email, password);
                    set({
                        user: res.user,
                        token: res.token,
                        permissions: res.permissions ?? [],
                        mustChangePassword: res.mustChangePassword,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({ error: error.message || 'Login failed', isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                void apiLogout(); // best-effort server-side revoke (cookie sent automatically)
                set({
                    user: null,
                    token: null,
                    permissions: [],
                    mustChangePassword: false,
                    isAuthenticated: false,
                    error: null,
                });
                localStorage.removeItem('auth-storage');
            },

            // Used by the api refresh interceptor after rotating tokens.
            applySession: (data) => set({
                user: data.user,
                token: data.token,
                permissions: data.permissions ?? [],
                mustChangePassword: data.mustChangePassword,
                isAuthenticated: true,
            }),

            fetchMe: async () => {
                try {
                    const me = await apiGetMe();
                    set({
                        user: me.user,
                        permissions: me.permissions ?? [],
                        mustChangePassword: me.mustChangePassword,
                    });
                } catch {
                    // 401s are handled by the api interceptor (refresh or logout).
                }
            },

            changePassword: async (currentPassword, newPassword) => {
                await apiChangePassword(currentPassword, newPassword);
                set({ mustChangePassword: false });
            },

            applyOtpSession: async (identifier, otp) => {
                const res = await apiLoginWithOtp(identifier, otp);
                set({
                    user: res.user,
                    token: res.token,
                    permissions: res.permissions ?? [],
                    mustChangePassword: res.mustChangePassword,
                    isAuthenticated: true,
                });
            },

            hasAccess: (permissionKey) => get().permissions.includes(permissionKey),

            silentRefresh: async () => {
                try {
                    const res = await apiRefreshSession();
                    set({
                        user: res.user,
                        token: res.token,
                        permissions: res.permissions ?? [],
                        mustChangePassword: res.mustChangePassword,
                        isAuthenticated: true,
                    });
                    return true;
                } catch {
                    set({ isAuthenticated: false, user: null, token: null, permissions: [] });
                    localStorage.removeItem('auth-storage');
                    return false;
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                permissions: state.permissions,
                mustChangePassword: state.mustChangePassword,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
