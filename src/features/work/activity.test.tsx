import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const can = vi.hoisted(() => ({ audit: true }));
vi.mock('./access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canAuditWork: () => can.audit, canExportWork: () => true,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from './pages/WorkBoardPage';
import { describeActivity, isFlagged, lastSeenText } from './activityMeta';
import { GUARD_EVENT } from './components/PresenceBar';
import type { WorkActivity } from './types';

const row = (over: Partial<WorkActivity>): WorkActivity => ({
  source: 'items', action: 'status', actorUserId: 'u-2', actorName: 'Asha Rao', projectKey: 'HMS', workItemId: 'w-1', itemKey: 'HMS-1', itemTitle: 'Billing',
  documentId: null, documentName: null, oldValue: null, newValue: null, detail: null, createdAt: '2026-11-21T06:00:00Z', ...over,
});
const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);

describe('activity wording', () => {
  it('says what happened in plain words', () => {
    expect(describeActivity(row({ oldValue: 'To do', newValue: 'Done' }))).toBe('changed the status from To do to Done');
    expect(describeActivity(row({ action: 'created', newValue: 'Task' }))).toBe('created this task');
    expect(describeActivity(row({ source: 'access', action: 'MemberRemoved', detail: 'Bilal Khan' }))).toBe('removed Bilal Khan from HMS');
    expect(describeActivity(row({ source: 'sessions', action: 'CopyBlocked' }))).toBe('tried to copy from the protected screen');
    expect(describeActivity(row({ source: 'docs', action: 'download', documentName: 'Offer letter.pdf' }))).toBe('downloaded “Offer letter.pdf”');
  });

  it('flags what a review should look at', () => {
    expect(isFlagged(row({ source: 'sessions', action: 'ScreenshotKey' }))).toBe(true);
    expect(isFlagged(row({ action: 'deleted' }))).toBe(true);
    expect(isFlagged(row({ source: 'sessions', action: 'Opened' }))).toBe(false);
    expect(isFlagged(row({}))).toBe(false);
  });

  it('words last seen', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    expect(lastSeenText(null, false, now)).toBe('Not seen yet');
    expect(lastSeenText('2026-11-21T11:59:30Z', true, now)).toBe('Online now');
    expect(lastSeenText('2026-11-21T11:40:00Z', false, now)).toBe('Last seen 20 min ago');
    expect(lastSeenText('2026-11-21T07:00:00Z', false, now)).toBe('Last seen 5 h ago');
  });
});

describe('activity on the page', () => {
  it('shows the person their own sign-in details and who is online', async () => {
    const user = userEvent.setup();
    open('/work');
    expect(await screen.findByText(/on the board since/)).toBeInTheDocument();
    expect(screen.getByText(/previous visit/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Team.*2 online/ }));
    const team = screen.getByRole('group', { name: 'Team, last seen' });
    expect(within(team).getAllByText('Online now')).toHaveLength(2);
    expect(within(team).getByText(/Last seen/)).toBeInTheDocument();
  });

  it('lists who did what, and narrows to what needs a look', async () => {
    const user = userEvent.setup();
    open('/work?tab=activity');
    const log = await screen.findByLabelText('Activity log');
    expect(within(log).getAllByText(/opened the work board/).length).toBeGreaterThan(0);
    expect(within(log).getAllByRole('button', { name: /^HMS-\d+$/ }).length).toBeGreaterThan(0);

    // The protected screen stops a copy: it is reported and appears in the log, flagged.
    window.dispatchEvent(new CustomEvent(GUARD_EVENT, { detail: 'CopyBlocked' }));
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await user.click(screen.getByRole('checkbox', { name: /Needs a look only/ }));
    await waitFor(() => expect(within(screen.getByLabelText('Activity log')).getByText(/tried to copy from the protected screen/)).toBeInTheDocument());
    expect(within(screen.getByLabelText('Activity log')).queryByText(/opened the work board/)).not.toBeInTheDocument();
  });

  it('has no Activity tab without the permission', async () => {
    can.audit = false;
    open('/work?tab=activity');
    await screen.findByRole('table', { name: 'Work items' });
    expect(screen.queryByRole('tab', { name: /Activity/ })).not.toBeInTheDocument();
    can.audit = true;
  });
});
