import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PermissionDto, RoleDto, UserDetail } from './services/adminService';

const catalog: PermissionDto[] = [
    { key: 'dashboard.view', pageKey: 'dashboard', action: 'view', displayName: 'See the growth dashboard', category: 'Dashboards', sortOrder: 10 },
    { key: 'work.view', pageKey: 'work', action: 'view', displayName: 'Open the Daily Work Board and team chat', category: 'Daily Work Board', sortOrder: 50 },
    { key: 'work.edit', pageKey: 'work', action: 'edit', displayName: 'Create and update tasks', category: 'Daily Work Board', sortOrder: 51 },
    { key: 'user-management.manage', pageKey: 'user-management', action: 'manage', displayName: 'Add people and change their roles and access', category: 'Administration', sortOrder: 111 },
    { key: 'settings.view', pageKey: 'settings', action: 'view', displayName: 'Settings (now open to everyone as My profile)', category: 'No longer used', sortOrder: 901 },
];
const roles: RoleDto[] = [
    { roleId: 'b0000001-0000-0000-0000-000000000001', name: 'Administrator', description: 'Everything.', isSystemDefined: true, isActive: true, permissionKeys: catalog.map(c => c.key) },
    { roleId: 'r-m', name: 'Manager', description: 'Everything except people and roles.', isSystemDefined: true, isActive: true, permissionKeys: ['dashboard.view', 'work.view', 'work.edit'] },
    { roleId: 'r-t', name: 'Team member', description: 'The board, chat and documents.', isSystemDefined: true, isActive: true, permissionKeys: ['work.view', 'work.edit'] },
    { roleId: 'r-old', name: 'Hospital Manager', isSystemDefined: true, isActive: false, permissionKeys: ['dashboard.view'] },
];
const asha: UserDetail = {
    userId: 'u-2', email: 'asha@example.com', fullName: 'Asha Rao', phoneNumber: '+919800000001', jobTitle: 'Support lead', photoVersion: null,
    isActive: true, mustChangePassword: false, lastLoginAt: null, roles: ['Team member'], roleIds: ['r-t'], overrides: [],
};
const bilal: UserDetail = { ...asha, userId: 'u-3', email: 'bilal@example.com', fullName: 'Bilal Khan', phoneNumber: null, jobTitle: null, isActive: false, roles: [], roleIds: [] };

const api = vi.hoisted(() => ({
    getPermissions: vi.fn(), getRoles: vi.fn(), getUsers: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(),
    createUser: vi.fn(), resetPassword: vi.fn(), updateRole: vi.fn(), createRole: vi.fn(), deleteRole: vi.fn(),
}));
vi.mock('./services/adminService', () => ({ adminService: api }));

import UsersAccess from './pages/UsersAccess';
import { useAuthStore } from '../../store/useAuthStore';

const open = (path = '/users') => render(<MemoryRouter initialEntries={[path]}><UsersAccess /></MemoryRouter>);
const manager = (canManage: boolean) => useAuthStore.setState({
    user: { id: 'u-1', name: 'Local reviewer', email: 'me@example.com', role: 'Administrator' },
    permissions: canManage ? ['user-management.view', 'user-management.manage'] : ['user-management.view'],
});

beforeEach(() => {
    vi.clearAllMocks();
    api.getPermissions.mockResolvedValue(catalog);
    api.getRoles.mockResolvedValue(roles);
    api.getUsers.mockResolvedValue([asha, bilal]);
    api.getUser.mockImplementation(async (id: string) => (id === 'u-2' ? asha : bilal));
    api.updateUser.mockImplementation(async (_id: string, change: Partial<UserDetail>) => ({ ...asha, ...change }));
    manager(true);
});

describe('Users & access', () => {
    it('lists people with their job, contact, roles and status, and finds them by phone', async () => {
        const user = userEvent.setup();
        open();
        const table = await screen.findByRole('table');
        const row = within(table).getByRole('button', { name: 'Asha Rao' }).closest('tr')!;
        expect(within(row).getByText('Support lead')).toBeInTheDocument();
        expect(within(row).getByText('+919800000001')).toBeInTheDocument();
        expect(within(row).getByText('Team member')).toBeInTheDocument();
        expect(within(within(table).getByRole('button', { name: 'Bilal Khan' }).closest('tr')!).getByText('Switched off')).toBeInTheDocument();

        await user.type(screen.getByRole('searchbox', { name: 'Search people' }), '98000');
        expect(within(table).queryByRole('button', { name: 'Bilal Khan' })).not.toBeInTheDocument();
        // Retired roles are not offered as a filter.
        expect(within(screen.getByRole('combobox', { name: 'Filter by role' })).queryByRole('option', { name: 'Hospital Manager' })).not.toBeInTheDocument();
    });

    it("changes someone's details and roles in one save, and shows where access comes from", async () => {
        const user = userEvent.setup();
        open();
        await user.click(await screen.findByRole('button', { name: 'Asha Rao' }));
        const panel = await screen.findByRole('dialog', { name: /Asha Rao: details and access/ });

        // What she can open, and why; nothing retired is shown.
        expect(await within(panel).findByText('Create and update tasks')).toBeInTheDocument();
        expect(within(panel).getAllByText('From Team member').length).toBe(2);
        expect(within(panel).queryByText(/Settings \(now open/)).not.toBeInTheDocument();

        const phone = within(panel).getByRole('textbox', { name: /Phone number/ });
        await user.clear(phone);
        await user.type(phone, '+91 98000 00009');
        await user.clear(within(panel).getByRole('textbox', { name: /Job title/ }));
        await user.type(within(panel).getByRole('textbox', { name: /Job title/ }), 'Team lead');
        await user.click(within(panel).getByRole('checkbox', { name: /Manager/ }));
        expect(await within(panel).findByText('See the growth dashboard')).toBeInTheDocument();

        await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('u-2', {
            fullName: 'Asha Rao', email: 'asha@example.com', phoneNumber: '+91 98000 00009', jobTitle: 'Team lead',
            isActive: true, roleIds: ['r-t', 'r-m'], overrides: [],
        }));
    });

    it('takes one permission away just for one person', async () => {
        const user = userEvent.setup();
        open('/users?person=u-2');
        const panel = await screen.findByRole('dialog', { name: /Asha Rao/ });
        await user.click(await within(panel).findByRole('button', { name: /Change single permissions/ }));
        await user.selectOptions(within(panel).getByRole('combobox', { name: 'Create and update tasks: just for this person' }), 'Deny');
        expect(within(panel).getByText('Taken away just for this person')).toBeInTheDocument();
        await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('u-2', expect.objectContaining({ overrides: [{ key: 'work.edit', effect: 'Deny' }] })));
    });

    it('asks before closing with changes that are not saved', async () => {
        const user = userEvent.setup();
        open('/users?person=u-2');
        const panel = await screen.findByRole('dialog', { name: /Asha Rao/ });
        await user.type(await within(panel).findByRole('textbox', { name: /Full name/ }), ' R');
        await user.click(within(panel).getByRole('button', { name: 'Close' }));
        expect(within(panel).getByText('You have changes that are not saved.')).toBeInTheDocument();
        await user.click(within(panel).getByRole('button', { name: 'Discard' }));
        expect(screen.queryByRole('dialog', { name: /Asha Rao/ })).not.toBeInTheDocument();
        expect(api.updateUser).not.toHaveBeenCalled();
    });

    it("doesn't let me switch off my own account", async () => {
        api.getUser.mockResolvedValue({ ...asha, userId: 'u-1', fullName: 'Local reviewer' });
        open('/users?person=u-1');
        const panel = await screen.findByRole('dialog', { name: /Local reviewer/ });
        expect(await within(panel).findByRole('checkbox', { name: /Can sign in/ })).toBeDisabled();
        expect(within(panel).getByText("You can't switch off your own account.")).toBeInTheDocument();
    });

    it('adds a person with a temporary password and a role', async () => {
        const user = userEvent.setup();
        api.createUser.mockResolvedValue({ ...bilal, userId: 'u-9', fullName: 'Chitra Das', isActive: true });
        open();
        await user.click(await screen.findByRole('button', { name: 'Add a person' }));
        const dialog = screen.getByRole('dialog', { name: 'Add a person' });
        await user.type(within(dialog).getByRole('textbox', { name: 'Full name' }), 'Chitra Das');
        await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'chitra@example.com');
        await user.click(within(dialog).getByRole('button', { name: 'Add person' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose at least one role');
        await user.click(within(dialog).getByRole('checkbox', { name: /Team member/ }));
        await user.click(within(dialog).getByRole('button', { name: 'Add person' }));
        await waitFor(() => expect(api.createUser).toHaveBeenCalledWith(expect.objectContaining({
            fullName: 'Chitra Das', email: 'chitra@example.com', roleIds: ['r-t'], password: expect.stringMatching(/^.{12}$/),
        })));
        expect(await screen.findByRole('dialog', { name: /Chitra Das|Bilal Khan|Asha Rao/ })).toBeInTheDocument();
    });

    it('shows a read-only page to someone who can only look', async () => {
        manager(false);
        open('/users?person=u-2');
        const panel = await screen.findByRole('dialog', { name: /Asha Rao/ });
        expect(await within(panel).findByText(/Only administrators can change them/)).toBeInTheDocument();
        expect(within(panel).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add a person' })).not.toBeInTheDocument();
    });

    it('edits a role by area, and keeps the Administrator role whole', async () => {
        const user = userEvent.setup();
        api.updateRole.mockResolvedValue(roles[2]);
        open('/users?tab=roles');
        expect(screen.queryByRole('button', { name: /Hospital Manager/ })).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: /^Team member/ }));
        const editor = screen.getByRole('dialog', { name: 'Role: Team member' });
        expect(within(editor).getByRole('textbox', { name: /Name/ })).toHaveAttribute('readonly');
        await user.click(within(editor).getByRole('checkbox', { name: 'Dashboards' }));
        await user.click(within(editor).getByRole('button', { name: 'Save role' }));
        await waitFor(() => expect(api.updateRole).toHaveBeenCalledWith('r-t', expect.objectContaining({ permissionKeys: ['work.view', 'work.edit', 'dashboard.view'] })));

        await user.click(await screen.findByRole('button', { name: /^Administrator/ }));
        const adminRole = screen.getByRole('dialog', { name: 'Role: Administrator' });
        expect(within(adminRole).getByText(/Administrators can always do everything/)).toBeInTheDocument();
        expect(within(adminRole).getByRole('switch', { name: 'Create and update tasks' })).toBeDisabled();
    });
});
