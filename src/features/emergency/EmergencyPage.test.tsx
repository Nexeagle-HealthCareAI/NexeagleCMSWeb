import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Emergency takeover in the CMS: hospitals waiting to be verified (verify, or send back with a reason), places not on 1HMS added
// here, and the alert log. Answers have the CMS API's { success, data } shape around 1HMS's own.

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock('../../services/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a) } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import EmergencyPage from './EmergencyPage';

const pending = {
  settingId: 's1', hospitalId: 'h1', source: 'HOSPITAL', name: 'Salt Lake Care', kind: 'HOSPITAL', isEnabled: true, emergencyPhone: '03340001111',
  alertWhatsApp: '9830000001', latitude: 22.58, longitude: 88.42, landmark: 'Near City Centre', city: 'Kolkata', is24x7: true,
  capabilities: ['cardiac', 'icu'], termsVersion: '2026-10', termsAcceptedAt: '2026-10-25T05:00:00Z', verificationStatus: 'PENDING', listed: false,
};
const ok = (data: unknown) => ({ data: { success: true, data } });

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset(); toast.success.mockReset(); toast.error.mockReset();
  get.mockImplementation((url: string) => Promise.resolve(url === '/emergency/alerts'
    ? ok({ events: [{ eventId: 'e1', at: '2026-10-25T08:35:00Z', reason: 'chest pain', channel: 'web', sharedMobile: '98xxxxxx10',
      places: [{ settingId: 's1', name: 'Salt Lake Care', distanceKm: 1.2, whatsAppSent: true, inApp: true, callTaps: 2, acknowledged: 'Dr Sen: ready' }] }] })
    : ok({ items: [pending], pending: 1, verified: 4, rejected: 0 })));
  post.mockResolvedValue(ok({ success: true }));
});

describe('Emergency takeover (CMS)', () => {
  it('lists hospitals waiting for verification with what to check', async () => {
    render(<EmergencyPage />);
    const row = await screen.findByRole('listitem', { name: 'Salt Lake Care' });
    expect(get).toHaveBeenCalledWith('/emergency/places', { params: { status: 'PENDING' } });
    expect(within(row).getByRole('link', { name: '03340001111' })).toHaveAttribute('href', 'tel:03340001111');
    expect(within(row).getByRole('link', { name: /map pin/i })).toHaveAttribute('href', expect.stringContaining('22.58,88.42'));
    expect(within(row).getByText(/cardiac, icu/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /To verify/ })).toHaveTextContent('1');
  });

  it('verifies a hospital', async () => {
    render(<EmergencyPage />);
    const row = await screen.findByRole('listitem', { name: 'Salt Lake Care' });
    await userEvent.click(within(row).getByRole('button', { name: /verify/i }));
    expect(post).toHaveBeenCalledWith('/emergency/places/s1/verify', { decision: 'VERIFIED', note: null });
    expect(toast.success).toHaveBeenCalledWith('Salt Lake Care is verified and shown to patients.');
  });

  it('sends a hospital back only with a reason', async () => {
    render(<EmergencyPage />);
    const row = await screen.findByRole('listitem', { name: 'Salt Lake Care' });
    await userEvent.click(within(row).getByRole('button', { name: /send back/i }));
    const send = within(row).getAllByRole('button', { name: 'Send back' }).at(-1)!;
    expect(send).toBeDisabled();
    await userEvent.type(within(row).getByLabelText('What should the hospital fix?'), 'Emergency number did not answer');
    await userEvent.click(send);
    expect(post).toHaveBeenCalledWith('/emergency/places/s1/verify', { decision: 'REJECTED', note: 'Emergency number did not answer' });
  });

  it('adds a place that is not on 1HMS and shows 1HMS\'s refusal', async () => {
    post.mockRejectedValueOnce({ response: { data: { message: 'Set the map pin (latitude and longitude).' } } });
    render(<EmergencyPage />);
    await userEvent.click(screen.getByRole('button', { name: /add a place not on 1hms/i }));
    const form = screen.getByRole('form', { name: 'Add a place not on 1HMS' });
    await userEvent.type(within(form).getByLabelText('Name *'), 'District Hospital Barasat');
    await userEvent.type(within(form).getByLabelText('Emergency phone *'), '108');
    await userEvent.click(within(form).getByRole('button', { name: 'Add and show to patients' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Set the map pin');

    post.mockResolvedValueOnce(ok({ items: [{ ...pending, source: 'CMS', name: 'District Hospital Barasat' }] }));
    await userEvent.type(within(form).getByLabelText('Latitude *'), '22.72');
    await userEvent.type(within(form).getByLabelText('Longitude *'), '88.48');
    await userEvent.click(within(form).getByRole('button', { name: 'Add and show to patients' }));
    expect(post).toHaveBeenLastCalledWith('/emergency/places', expect.objectContaining({
      name: 'District Hospital Barasat', emergencyPhone: '108', latitude: 22.72, longitude: 88.48, is24x7: true, isEnabled: true, kind: 'HOSPITAL',
    }));
    expect(toast.success).toHaveBeenCalledWith('District Hospital Barasat added and shown to patients.');
  });

  it('shows the alert log with WhatsApp status, call taps, acknowledgement and the masked number', async () => {
    render(<EmergencyPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Alert log' }));
    const row = await screen.findByRole('row', { name: /chest pain/ });
    expect(row).toHaveTextContent('Salt Lake Care · 1.2 km · WhatsApp sent · in 1HMS · 2 call taps · Acknowledged: Dr Sen: ready');
    expect(row).toHaveTextContent('98xxxxxx10');
  });
});
