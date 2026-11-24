import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const get = vi.hoisted(() => vi.fn());
vi.mock('../services/api', () => ({ api: { get } }));

import UserAvatar from './UserAvatar';
import { photoUrl } from './userPhoto';

URL.createObjectURL = vi.fn(() => 'blob:asha');
URL.revokeObjectURL = vi.fn();

describe("People's photos", () => {
    it('fetches each photo once with the sign-in, and shows initials without one', async () => {
        get.mockResolvedValue({ data: new Blob(['x'], { type: 'image/webp' }) });
        const { container, rerender } = render(<UserAvatar userId="u-2" name="Asha Rao" />);
        expect(screen.getByText('AR')).toBeInTheDocument();
        expect(get).not.toHaveBeenCalled();

        rerender(<UserAvatar userId="u-2" name="Asha Rao" photoVersion="7" />);
        await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'blob:asha'));
        expect(get).toHaveBeenCalledWith('/users/u-2/photo', { params: { v: '7' }, responseType: 'blob' });
        await photoUrl('u-2', '7');
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('falls back to initials when the photo cannot be loaded', async () => {
        get.mockRejectedValue(new Error('404'));
        render(<UserAvatar userId="u-3" name="Bilal Khan" photoVersion="1" />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(screen.getByText('BK')).toBeInTheDocument();
    });
});
