import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';

vi.mock('./access', () => ({
  SOCIAL_MOCK: true,
  canViewSocial: () => true,
  socialCan: () => ({ view: true, reply: true, compose: true, publish: true, ads: true, connect: true }),
}));

import SocialPage from './SocialPage';
import { captionFor, checkPost, hashtags, n, timeLeft } from './socialUtils';
import { visibleGroups } from '../../components/nav/navConfig';
import type { SocialDraftSave } from './types';

const open = (path = '/social') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/social" element={<SocialPage />} />
        <Route path="/social/:tab" element={<SocialPage />} />
        <Route path="/social/:tab/:id" element={<SocialPage />} />
      </Routes>
    </MemoryRouter>,
  );

const jpg = (k: number) => ({ key: `k${k}.jpg`, mime: 'image/jpeg', name: `p${k}.jpg`, size: 1000 });
const post = (p: Partial<SocialDraftSave> = {}): SocialDraftSave => ({
  accountId: 'acc-1', title: '', toFacebook: true, toInstagram: true, kind: 'Carousel', caption: 'Five questions to ask.', media: [jpg(1), jpg(2)],
  whenMode: 'approved', checklist: {}, ...p,
});

beforeAll(() => {
  // jsdom has no object URLs; previews fall back to the placeholder.
  if (!URL.createObjectURL) Object.assign(URL, { createObjectURL: () => 'blob:example', revokeObjectURL: () => undefined });
});

describe('Social rules on the screen', () => {
  it('checks posts the way Facebook, Instagram and the API do', () => {
    const now = new Date('2026-11-27T06:00:00Z');
    expect(checkPost(post(), now)).toBeNull();
    expect(checkPost(post({ toFacebook: false, toInstagram: false }), now)).toMatch(/Choose Facebook/);
    expect(checkPost(post({ kind: 'Text', media: [] }), now)).toMatch(/Instagram posts need a picture/);
    expect(checkPost(post({ kind: 'Story', media: [jpg(1)] }), now)).toMatch(/Instagram only/);
    expect(checkPost(post({ media: [jpg(1)] }), now)).toMatch(/2 to 10/);
    expect(checkPost(post({ media: Array.from({ length: 11 }, (_, i) => jpg(i)) }), now)).toMatch(/at most 10/);
    expect(checkPost(post({ kind: 'Photo', media: [{ key: 'x.png', mime: 'image/png', name: 'x.png', size: 1 }] }), now)).toMatch(/JPEG/);
    expect(checkPost(post({ caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ') }), now)).toMatch(/30 hashtags/);
    expect(checkPost(post({ whenMode: 'schedule', scheduledAt: '2026-11-27T06:05:00Z' }), now)).toMatch(/10 minutes/);
    expect(checkPost(post({ toInstagram: false, kind: 'Link', media: [], link: 'nexeagle' }), now)).toMatch(/https/);
  });

  it('uses each channel’s own caption when there is one', () => {
    expect(captionFor({ caption: 'Both', instagramCaption: ' ', facebookCaption: 'Only FB' }, 'instagram')).toBe('Both');
    expect(captionFor({ caption: 'Both', instagramCaption: ' ', facebookCaption: 'Only FB' }, 'facebook')).toBe('Only FB');
    expect(hashtags('#one #two # three')).toBe(2);
  });

  it('shows Meta’s numbers and the reply window plainly', () => {
    expect(n(null)).toBe('—');
    expect(n(12400)).toBe('12.4k');
    expect(n(20000)).toBe('20k');
    const now = new Date('2026-11-27T10:00:00Z');
    expect(timeLeft('2026-11-27T13:20:00Z', now)).toBe('3 h 20 min');
    expect(timeLeft('2026-11-30T12:00:00Z', now)).toBe('3 d 2 h');
    expect(timeLeft('2026-11-27T09:00:00Z', now)).toBeNull();
  });

  it('puts Social in the menu for people with social.view', () => {
    expect(visibleGroups(['social.view']).flatMap(g => g.items.map(i => i.to))).toContain('/social');
  });
});

describe('Social → Posts', () => {
  it('lists every post with its numbers and opens one with its comments', async () => {
    const user = userEvent.setup();
    open('/social');
    expect(await screen.findByText('Five questions to ask before choosing hospital software', { selector: '.sc-cap' })).toBeInTheDocument();
    expect(screen.getByText('Behind the scenes with the support team', { selector: '.sc-cap' })).toBeInTheDocument();
    expect(screen.getByText(/Posts, last 30 days/)).toBeInTheDocument();
    expect(screen.getAllByText('Posted outside the CMS', { exact: false }).length).toBeGreaterThan(0);

    const panel = await screen.findByRole('complementary', { name: 'Post' });
    expect(await within(panel).findByText('Is this available for a 30-bed hospital?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Instagram', pressed: false }));
    await waitFor(() => expect(screen.queryByText('Behind the scenes with the support team', { selector: '.sc-cap' })).not.toBeInTheDocument());
  });

  it('answers a comment from the post', async () => {
    const user = userEvent.setup();
    const ok = vi.spyOn(toast, 'success');
    open('/social');
    const panel = await screen.findByRole('complementary', { name: 'Post' });
    await within(panel).findByText('Is this available for a 30-bed hospital?');
    const card = within(panel).getByText('Is this available for a 30-bed hospital?').closest('.sc-comment') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /^Reply$/ }));
    await user.type(within(card).getByRole('textbox', { name: 'Reply' }), 'Yes, from 10 beds up.');
    await user.click(within(card).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(ok).toHaveBeenCalledWith('Reply posted.'));
    expect(within(card).getByText(/Yes, from 10 beds up/)).toBeInTheDocument();
  });
});

describe('Social → Compose', () => {
  it('will not send a post Instagram cannot take', async () => {
    const user = userEvent.setup();
    open('/social/compose');
    await user.click(await screen.findByRole('button', { name: 'Text' }));
    expect(await screen.findByText('Instagram posts need a picture or a video.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Instagram ·/ }));
    expect(screen.queryByText('Instagram posts need a picture or a video.')).not.toBeInTheDocument();
  });

  it('writes a Facebook post, sends it for approval and shows it waiting', async () => {
    const user = userEvent.setup();
    const ok = vi.spyOn(toast, 'success');
    open('/social/compose');
    await user.click(await screen.findByRole('checkbox', { name: /Instagram ·/ }));
    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.type(screen.getByRole('textbox', { name: 'Caption' }), 'Our office is closed on Monday.');
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Holiday notice');
    expect(screen.getByLabelText('Facebook preview')).toHaveTextContent('Our office is closed on Monday.');
    await user.click(screen.getByRole('button', { name: 'Send for approval' }));
    await waitFor(() => expect(ok).toHaveBeenCalledWith('Sent for approval.'));
    const approvals = await screen.findByText(/Waiting for your approval/);
    expect(within(approvals.closest('section')!).getByText('Holiday notice')).toBeInTheDocument();
  });

  it('needs the healthcare checks before approving', async () => {
    const user = userEvent.setup();
    const bad = vi.spyOn(toast, 'error');
    const ok = vi.spyOn(toast, 'success');
    open('/social/compose');
    await user.click(await screen.findByRole('checkbox', { name: /Instagram ·/ }));
    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.type(screen.getByRole('textbox', { name: 'Caption' }), 'Free camp on Sunday.');
    await user.click(screen.getByRole('button', { name: 'Approve now' }));
    expect(bad).toHaveBeenCalledWith(expect.stringMatching(/Tick the checks/));
    await user.click(screen.getByRole('checkbox', { name: /No patient testimonials/ }));
    await user.click(screen.getByRole('checkbox', { name: /Facts we can back up/ }));
    await user.click(screen.getByRole('button', { name: 'Approve now' }));
    await waitFor(() => expect(ok).toHaveBeenCalledWith(expect.stringMatching(/^Approved/)));
    expect(await screen.findByText(/Goes out/)).toBeInTheDocument();
  });
});

describe('Social → Inbox', () => {
  it('replies to an Instagram message and keeps a note', async () => {
    const user = userEvent.setup();
    open('/social/inbox');
    await user.click(await screen.findByRole('button', { name: /Example Clinic Owner/ }));
    expect(await screen.findByText('Can you send the price list?', { selector: '.wa-b-text' })).toBeInTheDocument();
    expect(screen.getByText(/Free reply for/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'Sending it now.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Sending it now.', { selector: '.wa-b-text' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Note/ }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Call on Friday.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText(/Call on Friday\./)).toBeInTheDocument();
  });

  it('after 24 hours a reply goes as a human agent', async () => {
    const user = userEvent.setup();
    open('/social/inbox');
    await user.click(await screen.findByRole('button', { name: /Example Hospital Admin/ }));
    expect(await screen.findByText(/human agent/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeEnabled();
  });

  it('makes a lead from a conversation', async () => {
    const user = userEvent.setup();
    open('/social/inbox');
    await user.click(await screen.findByRole('button', { name: /Example Clinic Owner/ }));
    const side = await screen.findByRole('complementary', { name: 'Lead' });
    await user.type(within(side).getByRole('textbox', { name: /Phone/ }), '9800000021');
    await user.selectOptions(within(side).getByRole('combobox', { name: 'Interested in' }), '1HMS');
    await user.click(within(side).getByRole('button', { name: 'Make lead' }));
    expect(await within(side).findByText('In the CRM.')).toBeInTheDocument();
  });
});

describe('Social → Leads', () => {
  it('finds the lead the webhook missed and brings it in', async () => {
    const user = userEvent.setup();
    open('/social/leads');
    expect(await screen.findByText(/Meta has 16 leads for the form “Demo request”/)).toBeInTheDocument();
    expect(screen.getByText('Example Hospital Owner')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Bring in the missing lead \(1\)/ }));
    expect(await screen.findByText(/every lead in the last 30 days is in the CRM/)).toBeInTheDocument();
    expect(await screen.findByText('Example missed lead')).toBeInTheDocument();
  });
});

describe('Social → Ads and Setup', () => {
  it('shows cost per lead by campaign', async () => {
    open('/social/ads');
    expect(await screen.findByText('1HMS demo')).toBeInTheDocument();
    expect(screen.getByText('Cost per lead', { selector: '.wa-tile > span' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Spend per day/ })).toBeInTheDocument();
  });

  it('shows the checklist and what a second account still needs', async () => {
    const user = userEvent.setup();
    open('/social/setup');
    expect(await screen.findByText('NexEagle: connected')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'Doctor Dekho');
    expect(await screen.findByText('Doctor Dekho: not fully connected yet')).toBeInTheDocument();
    expect(screen.getByText('Choose the Page first.')).toBeInTheDocument();
  });
});
