import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

export interface PermissionDto {
    key: string;
    pageKey: string;
    action: string;
    displayName: string;
    category?: string;
    sortOrder: number;
}

export interface RoleDto {
    roleId: string;
    name: string;
    description?: string;
    isSystemDefined: boolean;
    isActive: boolean;
    permissionKeys: string[];
}

export type Effect = 'Allow' | 'Deny';
export interface PermissionOverride { key: string; effect: Effect; }

export interface UserSummary {
    userId: string;
    email: string;
    fullName: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt?: string | null;
    roles: string[];
}

export interface UserDetail extends UserSummary {
    roleIds: string[];
    overrides: PermissionOverride[];
}

export const adminService = {
    getUsers: () => api.get<UserSummary[]>(API_ENDPOINTS.ADMIN.USERS).then((r) => r.data),
    getUser: (id: string) => api.get<UserDetail>(`${API_ENDPOINTS.ADMIN.USERS}/${id}`).then((r) => r.data),
    createUser: (p: { email: string; fullName: string; password: string; roleIds: string[] }) =>
        api.post<UserDetail>(API_ENDPOINTS.ADMIN.USERS, p).then((r) => r.data),
    updateUser: (id: string, p: { fullName?: string; isActive?: boolean; roleIds?: string[]; overrides?: PermissionOverride[] }) =>
        api.put<UserDetail>(`${API_ENDPOINTS.ADMIN.USERS}/${id}`, p).then((r) => r.data),
    resetPassword: (id: string, newPassword: string) =>
        api.post(`${API_ENDPOINTS.ADMIN.USERS}/${id}/reset-password`, { newPassword }).then(() => undefined),

    getRoles: () => api.get<RoleDto[]>(API_ENDPOINTS.ADMIN.ROLES).then((r) => r.data),
    createRole: (p: { name: string; description?: string; permissionKeys: string[] }) =>
        api.post<RoleDto>(API_ENDPOINTS.ADMIN.ROLES, p).then((r) => r.data),
    updateRole: (id: string, p: { name?: string; description?: string; isActive?: boolean; permissionKeys?: string[] }) =>
        api.put<RoleDto>(`${API_ENDPOINTS.ADMIN.ROLES}/${id}`, p).then((r) => r.data),
    deleteRole: (id: string) => api.delete(`${API_ENDPOINTS.ADMIN.ROLES}/${id}`).then(() => undefined),

    getPermissions: () => api.get<PermissionDto[]>(API_ENDPOINTS.ADMIN.PERMISSIONS).then((r) => r.data),
};
