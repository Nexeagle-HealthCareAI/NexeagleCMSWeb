import { describe, expect, it } from 'vitest';
import { areasOf, effectiveAccess, openAreas, temporaryPassword, whenText } from './accessAreas';
import type { PermissionDto } from './services/adminService';

const p = (key: string, category: string, sortOrder: number, displayName = key): PermissionDto => ({ key, pageKey: key.split('.')[0], action: key.split('.')[1], displayName, category, sortOrder });
const catalog = [
    p('work.edit', 'Daily Work Board', 51), p('work.view', 'Daily Work Board', 50),
    p('dashboard.view', 'Dashboards', 10), p('settings.view', 'No longer used', 901),
];
const roles = [
    { roleId: 'm', name: 'Manager', isActive: true, permissionKeys: ['dashboard.view', 'work.view', 'work.edit'] },
    { roleId: 't', name: 'Team member', isActive: true, permissionKeys: ['work.view'] },
    { roleId: 'old', name: 'Hospital Manager', isActive: false, permissionKeys: ['dashboard.view'] },
];

describe('access areas', () => {
    it('groups permissions by area in menu order and hides retired ones', () => {
        expect(areasOf(catalog).map(a => [a.name, a.permissions.map(x => x.key)])).toEqual([
            ['Dashboards', ['dashboard.view']],
            ['Daily Work Board', ['work.view', 'work.edit']],
        ]);
        expect(openAreas(catalog, ['work.view', 'settings.view']).map(a => a.name)).toEqual(['Daily Work Board']);
    });

    it('works out what someone can open and why', () => {
        const access = effectiveAccess(catalog, roles, ['t', 'old'], { 'work.edit': 'Allow' });
        expect(access.get('work.view')).toEqual({ has: true, fromRoles: ['Team member'], exception: undefined });
        expect(access.get('work.edit')).toMatchObject({ has: true, fromRoles: [], exception: 'Allow' });
        // A switched-off role gives nothing.
        expect(access.get('dashboard.view')?.has).toBe(false);

        const denied = effectiveAccess(catalog, roles, ['m'], { 'work.edit': 'Deny' });
        expect(denied.get('work.edit')).toMatchObject({ has: false, fromRoles: ['Manager'], exception: 'Deny' });
    });

    it('makes readable temporary passwords', () => {
        const pw = temporaryPassword();
        expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
        expect(temporaryPassword()).not.toBe(pw);
    });

    it('says when someone last signed in', () => {
        const now = new Date(2026, 10, 24, 15);
        expect(whenText(null, now)).toBe('Never');
        expect(whenText(new Date(2026, 10, 24, 9).toISOString(), now)).toBe('Today');
        expect(whenText(new Date(2026, 10, 23, 22).toISOString(), now)).toBe('Yesterday');
        expect(whenText(new Date(2026, 10, 20).toISOString(), now)).toBe('4 days ago');
        expect(whenText(new Date(2026, 8, 2).toISOString(), now)).toMatch(/2 Sept? 2026/);
    });
});
