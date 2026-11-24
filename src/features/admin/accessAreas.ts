import type { PermissionDto } from './services/adminService';

/** The area for permissions of pages taken out of the CMS (script 34): never shown. */
export const RETIRED_AREA = 'No longer used';

export interface AccessArea {
    name: string;
    permissions: PermissionDto[];
}

/** Permissions grouped by area of the CMS, in menu order, without the retired ones. */
export function areasOf(catalog: PermissionDto[]): AccessArea[] {
    const areas = new Map<string, PermissionDto[]>();
    [...catalog]
        .filter(p => (p.category ?? '') !== RETIRED_AREA)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))
        .forEach(p => {
            const name = p.category || 'Other';
            areas.set(name, [...(areas.get(name) ?? []), p]);
        });
    return [...areas].map(([name, permissions]) => ({ name, permissions }));
}

/** Only the areas and permissions in `keys` (what someone can open). */
export function openAreas(catalog: PermissionDto[], keys: Iterable<string>): AccessArea[] {
    const has = new Set(keys);
    return areasOf(catalog)
        .map(a => ({ ...a, permissions: a.permissions.filter(p => has.has(p.key)) }))
        .filter(a => a.permissions.length > 0);
}

export type Exception = 'Allow' | 'Deny';

/** Whether a person has a permission, and why. */
export interface Grant {
    has: boolean;
    /** Roles that give it. */
    fromRoles: string[];
    /** Added or taken away just for this person (Deny wins over every role). */
    exception?: Exception;
}

/**
 * What a person can open: everything their switched-on roles give, plus what was added just for
 * them, minus what was taken away just for them. The same rule the API uses at sign-in.
 */
export function effectiveAccess(
    catalog: PermissionDto[],
    roles: { roleId: string; name: string; isActive: boolean; permissionKeys: string[] }[],
    roleIds: Iterable<string>,
    exceptions: Record<string, Exception>,
): Map<string, Grant> {
    const held = new Set(roleIds);
    const result = new Map<string, Grant>();
    for (const p of catalog) {
        const fromRoles = roles.filter(r => r.isActive && held.has(r.roleId) && r.permissionKeys.includes(p.key)).map(r => r.name);
        const exception = exceptions[p.key];
        const has = exception === 'Deny' ? false : exception === 'Allow' || fromRoles.length > 0;
        result.set(p.key, { has, fromRoles, exception });
    }
    return result;
}

/** A temporary password: 12 letters and digits that are hard to confuse (no 0/O, 1/l/I). */
export function temporaryPassword(): string {
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => letters[b % letters.length]).join('');
}

/** "Today", "Yesterday", "3 days ago" or a date; "Never" when there is none. */
export function whenText(iso?: string | null, now = new Date()): string {
    if (!iso) return 'Never';
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return 'Never';
    const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((day(now) - day(then)) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
