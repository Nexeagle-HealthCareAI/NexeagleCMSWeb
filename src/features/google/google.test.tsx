import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';

vi.mock('./access', () => ({
  GOOGLE_MOCK: true,
  canViewGoogle: () => true,
  googleCan: () => ({ view: true, ads: true, connect: true }),
}));

import GooglePage from './GooglePage';
import { duration, periodRange, validLabel, validTagId } from './googleUtils';

const open = (path = '/google') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/google" element={<GooglePage />} />
        <Route path="/google/:tab" element={<GooglePage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { localStorage.clear(); });

describe('Google rules on the screen', () => {
  it('counts periods back from today, both days included', () => {
    const now = new Date(2026, 10, 27);
    expect(periodRange('7', now)).toEqual({ from: '2026-11-21', to: '2026-11-27' });
    expect(periodRange('30', now)).toEqual({ from: '2026-10-29', to: '2026-11-27' });
    expect(periodRange('year', now)).toEqual({ from: '2026-01-01', to: '2026-11-27' });
    expect(periodRange('last', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('checks tag IDs and labels the way the API does', () => {
    expect(validTagId('G-ABC123', 'G-')).toBe(true);
    expect(validTagId('UA-1234', 'G-')).toBe(false);
    expect(validTagId('AW-12-3', 'AW-')).toBe(false);
    expect(validLabel('AbC-d_1')).toBe(true);
    expect(validLabel('AW-1/AbC')).toBe(false);
    expect(duration(125)).toBe('2m 05s');
  });
});

describe('Google section', () => {
  it('opens on the overview with Analytics numbers, channels and campaigns', async () => {
    open();
    expect(await screen.findByText('Visitors')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where visitors came from' })).toBeInTheDocument();
    expect(screen.getByText('Paid search (Google Ads)')).toBeInTheDocument();
    expect(screen.getByText('1hms_demo_bihar')).toBeInTheDocument();
    expect(screen.getByText(/refreshed every 10 minutes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(await screen.findByRole('button', { name: 'Show as table' }));
    expect(await screen.findByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
  });

  it('switching to Doctor Dekho says what is missing and offers Setup', async () => {
    open();
    await screen.findByText('Visitors');
    await userEvent.selectOptions(screen.getByLabelText('Account'), 'Doctor Dekho');
    expect(await screen.findByText(/Doctor Dekho is not connected to Google yet/)).toBeInTheDocument();
    expect(screen.getByText(/No Google Analytics property is chosen for Doctor Dekho/)).toBeInTheDocument();
    expect(localStorage.getItem('cms.google.account')).toBe('g-doctordekho');
  });

  it('shows a page with how people arrived and the searches that led there', async () => {
    open('/google/pages');
    const pricing = await screen.findByRole('button', { name: '/pricing' });
    await userEvent.click(pricing);
    const aside = screen.getByRole('complementary', { name: 'Page details' });
    expect(await within(aside).findByText('example search one')).toBeInTheDocument();
    expect(within(aside).getByText('/pricing')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search pages'), '1rad');
    expect(screen.queryByRole('button', { name: '/pricing' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '/1rad' })).toBeInTheDocument();
  });

  it('compares Google Ads with Meta and explains search terms', async () => {
    open('/google/ads');
    expect(await screen.findByRole('heading', { name: 'Google and Meta, same period' })).toBeInTheDocument();
    expect(screen.getByText('Meta (Facebook, Instagram)')).toBeInTheDocument();
    expect(screen.getByText('1HMS demo, Bihar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search terms' }));
    expect(await screen.findByText('example search with no lead')).toBeInTheDocument();
    expect(screen.getByText(/negative keywords/)).toBeInTheDocument();
  });

  it('lists Google leads, says what was told to Google, and filters by source', async () => {
    open('/google/leads');
    expect(await screen.findByText('Example Hospital Owner')).toBeInTheDocument();
    expect(screen.getByText(/Demo Done · sent/)).toBeInTheDocument();
    expect(screen.getByText('Not from a Google ad: nothing to send')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Google lead forms' }));
    await waitFor(() => expect(screen.queryByText('Example Hospital Owner')).not.toBeInTheDocument());
    expect(screen.getByText('Example Clinic Owner')).toBeInTheDocument();
  });

  it('Setup shows the checklist, the addresses to give Google and checks the tag IDs', async () => {
    open('/google/setup');
    expect(await screen.findByText('NexEagle: connected')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com/api/v1/google/oauth/callback')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com/api/v1/google/leads')).toBeInTheDocument();
    expect(screen.getByText(/Signed in as marketing@example.com/)).toBeInTheDocument();

    const g = screen.getByDisplayValue('G-EXAMPLE001');
    await userEvent.clear(g);
    await userEvent.type(g, 'UA-1234');
    expect(screen.getByText(/looks like G-XXXXXXXXXX/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save the tag' })).toBeDisabled();
    await userEvent.clear(g);
    await userEvent.type(g, 'g-example002');
    const save = screen.getByRole('button', { name: 'Save the tag' });
    expect(save).toBeEnabled();
    const ok = vi.spyOn(toast, 'success');
    await userEvent.click(save);
    await waitFor(() => expect(ok).toHaveBeenCalledWith(expect.stringMatching(/within 5 minutes/)));
  });

  it('sends results to Google only once every ticked stage has its conversion action', async () => {
    open('/google/setup');
    await screen.findByText('NexEagle: connected');
    const contacted = screen.getByRole('checkbox', { name: 'Contacted' });
    expect(screen.getByRole('checkbox', { name: 'Demo Done' })).toBeChecked();
    await userEvent.click(contacted);
    const saveBtn = screen.getAllByRole('button', { name: 'Save' }).at(-1)!;
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText('Choose a conversion action for every ticked stage.')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByLabelText('Conversion action for Contacted')).getByRole('option', { name: 'CRM: demo done' })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Conversion action for Contacted'), 'CRM: demo done');
    expect(saveBtn).toBeEnabled();
  });

  it('says how Google sign-in went when Google sends people back', async () => {
    const ok = vi.spyOn(toast, 'success');
    open('/google/setup?google=connected');
    await waitFor(() => expect(ok).toHaveBeenCalledWith(expect.stringMatching(/Signed in with Google/)));
    const bad = vi.spyOn(toast, 'error');
    open('/google/setup?google=error&reason=access_denied');
    await waitFor(() => expect(bad).toHaveBeenCalledWith(expect.stringMatching(/access_denied/)));
  });

  it('a wrong tab goes back to the overview', async () => {
    open('/google/nothing');
    expect(await screen.findByText('Visitors')).toBeInTheDocument();
  });
});
