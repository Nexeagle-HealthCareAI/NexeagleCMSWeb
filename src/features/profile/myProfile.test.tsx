import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Profile } from './services/profileService';

const me: Profile = { userId: 'u-1', email: 'me@example.com', fullName: 'Local reviewer', phoneNumber: null, jobTitle: null, photoVersion: null, roles: ['Team member'] };

const profileApi = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), setPhoto: vi.fn(), removePhoto: vi.fn(), setPhotoFor: vi.fn(), removePhotoFor: vi.fn() }));
vi.mock('./services/profileService', async (orig) => ({ ...(await orig<typeof import('./services/profileService')>()), profileService: profileApi }));
vi.mock('../admin/services/adminService', () => ({
    adminService: {
        getPermissions: async () => [
            { key: 'work.view', pageKey: 'work', action: 'view', displayName: 'Open the Daily Work Board and team chat', category: 'Daily Work Board', sortOrder: 50 },
            { key: 'insights.view', pageKey: 'insights', action: 'view', displayName: 'See patient app insights', category: 'Doctor Dekho & insights', sortOrder: 40 },
        ],
    },
}));
// No canvas in the test browser: the picture is "opened" and "cropped" without one.
vi.mock('../healthWiki/components/prepareImage', async (orig) => ({
    ...(await orig<typeof import('../healthWiki/components/prepareImage')>()),
    openImage: async () => ({ source: {} as CanvasImageSource, width: 800, height: 600, close: () => undefined }),
}));
vi.mock('./preparePhoto', async (orig) => ({
    ...(await orig<typeof import('./preparePhoto')>()),
    drawFramed: () => undefined,
    framedPhoto: async () => new File(['x'], 'photo.webp', { type: 'image/webp' }),
}));
vi.mock('../../components/userPhoto', async (orig) => ({ ...(await orig<typeof import('../../components/userPhoto')>()), rememberPhoto: vi.fn(), forgetPhotos: vi.fn(), useUserPhoto: (id?: string | null, v?: string | null) => (id && v ? 'blob:photo' : null) }));

import MyProfile from './pages/MyProfile';
import { useAuthStore } from '../../store/useAuthStore';

beforeEach(() => {
    vi.clearAllMocks();
    profileApi.get.mockResolvedValue(me);
    profileApi.update.mockImplementation(async (c: Partial<Profile>) => ({ ...me, ...c, phoneNumber: c.phoneNumber ? '+919876543210' : null }));
    profileApi.setPhoto.mockResolvedValue('638000000000000000');
    useAuthStore.setState({ user: { id: 'u-1', name: 'Local reviewer', email: 'me@example.com', role: 'Team member' }, permissions: ['work.view'] });
});

const open = () => render(<MemoryRouter><MyProfile /></MemoryRouter>);

describe('My profile', () => {
    it('lets me change my name, job title and phone, and shows it in the menu', async () => {
        const user = userEvent.setup();
        open();
        const save = await screen.findByRole('button', { name: 'Save changes' });
        expect(save).toBeDisabled();
        expect(screen.getByText('me@example.com')).toBeInTheDocument(); // shown, not editable

        await user.type(screen.getByRole('textbox', { name: 'Job title' }), 'Support lead');
        await user.type(screen.getByRole('textbox', { name: /Phone number/ }), '+91 98765 43210');
        await user.click(save);
        await waitFor(() => expect(profileApi.update).toHaveBeenCalledWith({ fullName: 'Local reviewer', jobTitle: 'Support lead', phoneNumber: '+91 98765 43210' }));
        await waitFor(() => expect(useAuthStore.getState().user?.jobTitle).toBe('Support lead'));
        expect(await screen.findByRole('textbox', { name: /Phone number/ })).toHaveValue('+919876543210');
    });

    it("says what's wrong when the server refuses", async () => {
        const user = userEvent.setup();
        profileApi.update.mockRejectedValue({ response: { status: 409, data: { message: 'Someone else already has that phone number.' } } });
        open();
        await user.type(await screen.findByRole('textbox', { name: /Phone number/ }), '9800000001');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Someone else already has that phone number.');
    });

    it('shows my roles and only what I can open', async () => {
        open();
        expect(await screen.findByText('Team member')).toBeInTheDocument();
        expect(await screen.findByText('Open the Daily Work Board and team chat')).toBeInTheDocument();
        expect(screen.queryByText('See patient app insights')).not.toBeInTheDocument();
    });

    it('adds a photo after cropping it, and can remove it', async () => {
        const user = userEvent.setup();
        open();
        await screen.findByRole('button', { name: 'Save changes' });
        await user.upload(screen.getByLabelText('Choose a photo for Local reviewer'), new File(['jpg'], 'me.jpg', { type: 'image/jpeg' }));
        const crop = await screen.findByRole('dialog', { name: 'Your photo' });
        expect(within(crop).getByRole('slider', { name: 'Zoom' })).toBeInTheDocument();
        await user.click(within(crop).getByRole('button', { name: 'Save photo' }));
        await waitFor(() => expect(profileApi.setPhoto).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/webp' })));
        await waitFor(() => expect(useAuthStore.getState().user?.photoVersion).toBe('638000000000000000'));
        expect(screen.queryByRole('dialog', { name: 'Your photo' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Remove/ }));
        await waitFor(() => expect(profileApi.removePhoto).toHaveBeenCalled());
        await waitFor(() => expect(useAuthStore.getState().user?.photoVersion).toBeNull());
    });

    it('refuses a file that is not a picture', async () => {
        const user = userEvent.setup({ applyAccept: false });
        open();
        await screen.findByRole('button', { name: 'Save changes' });
        await user.upload(screen.getByLabelText('Choose a photo for Local reviewer'), new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }));
        expect(screen.queryByRole('dialog', { name: 'Your photo' })).not.toBeInTheDocument();
        expect(profileApi.setPhoto).not.toHaveBeenCalled();
    });
});
