import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canAuditWork: () => true, canExportWork: () => true,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from './pages/WorkBoardPage';
import { insertMention, mentionedIn, mentionQuery, splitMentions } from './chatMeta';
import type { WorkUser } from './types';

const people: WorkUser[] = [
  { userId: 'a', fullName: 'Asha Rao', email: 'asha@example.com' },
  { userId: 'b', fullName: 'Asha Rao Kumar', email: 'ark@example.com' },
  { userId: 'c', fullName: 'Bilal Khan', email: 'bilal@example.com' },
];
const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);

describe('tagging helpers', () => {
  it('finds the name being typed after @', () => {
    expect(mentionQuery('ping @As', 8)).toEqual({ start: 5, query: 'As' });
    expect(mentionQuery('mail me at a@b.com', 18)).toBeNull();
    expect(mentionQuery('no tag here', 11)).toBeNull();
  });

  it('puts the chosen name in, and reads back who is tagged', () => {
    const next = insertMention('ping @As now', 8, 5, 'Asha Rao');
    expect(next.text).toBe('ping @Asha Rao  now');
    expect(mentionedIn('@Bilal Khan please check', people)).toEqual(['c']);
    expect(mentionedIn('nobody', people)).toEqual([]);
  });

  it('marks each tag in a message, longest name first', () => {
    const parts = splitMentions('Hi @Asha Rao Kumar and @Bilal Khan!', people.map(p => p.fullName));
    expect(parts.filter(p => p.mention).map(p => p.text)).toEqual(['@Asha Rao Kumar', '@Bilal Khan']);
    expect(parts.map(p => p.text).join('')).toBe('Hi @Asha Rao Kumar and @Bilal Khan!');
  });
});

describe('team chat', () => {
  it('shows the conversations, the unread tag for me, and clears it on opening', async () => {
    open('/work');
    // Asha tagged me in the HMS conversation: the tab and the bell both say so. (The bell's second
    // one is Bilal's tag in a comment on the story, from the example data.)
    expect(await screen.findByRole('button', { name: /Notifications, 2 unread/ })).toBeInTheDocument();
    const tab = screen.getByRole('tab', { name: /Chat/ });
    await waitFor(() => expect(within(tab).getByLabelText(/unread/)).toBeInTheDocument());

    await userEvent.setup().click(tab);
    const log = await screen.findByRole('log', { name: 'Messages' });
    expect(await within(log).findByText(/billing demo is on Friday/)).toBeInTheDocument();
    expect(within(log).getByText('Important')).toBeInTheDocument();
    expect(within(log).getByRole('button', { name: /HMS-3/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Notifications, 1 unread/ })).toBeInTheDocument());
  });

  it('sends a message that tags a teammate, picked from the @ list', async () => {
    const user = userEvent.setup();
    open('/work?tab=chat');
    const log = await screen.findByRole('log', { name: 'Messages' });
    await within(log).findByText(/billing demo/);

    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'Please review @Bil');
    await user.click(await screen.findByRole('option', { name: /Bilal Khan/ }));
    expect(box).toHaveValue('Please review @Bilal Khan ');
    await user.type(box, 'today{Enter}');

    const sent = await within(log).findByText('@Bilal Khan');
    expect(sent.tagName).toBe('MARK');
    expect(box).toHaveValue('');
    // The example teammate answers and tags me back.
    expect(await within(log).findByText(/got it, looking now/, {}, { timeout: 8000 })).toBeInTheDocument();
  }, 15000);

  it('will not escalate without someone to escalate to, then does', async () => {
    const user = userEvent.setup();
    open('/work?tab=chat');
    const log = await screen.findByRole('log', { name: 'Messages' });
    await within(log).findByText(/billing demo/);

    await user.click(screen.getByRole('button', { name: 'Escalate', pressed: false }));
    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'Server is down{Enter}');
    expect(box).toHaveValue('Server is down');

    await user.type(box, ' @Asha');
    await user.click(await screen.findByRole('option', { name: /Asha Rao/ }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(within(log).getByText('Escalation')).toBeInTheDocument());
  });

  it('starts a direct message and shows when the person was last seen', async () => {
    const user = userEvent.setup();
    open('/work?tab=chat');
    await screen.findByRole('log', { name: 'Messages' });

    await user.click(screen.getByRole('button', { name: /^Message$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Message someone' });
    await user.click(within(dialog).getByRole('button', { name: /Bilal Khan/ }));

    expect(await screen.findByRole('heading', { name: 'Bilal Khan', level: 2 })).toBeInTheDocument();
    expect(await screen.findByText('No messages yet. Say hello.')).toBeInTheDocument();
  });

  it('escalates a work item from its panel and writes that in its history', async () => {
    const user = userEvent.setup();
    open('/work');
    const list = await screen.findByRole('table', { name: 'Work items' });
    await user.click(within(list).getByText('Show price and tax'));
    await user.click(await screen.findByRole('button', { name: 'Escalate' }));
    const dialog = await screen.findByRole('dialog', { name: /Escalate HMS-/ });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Bilal Khan' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'What is needed' }), 'Customer is waiting');
    await user.click(within(dialog).getByRole('button', { name: 'Escalate' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /Chat/ }));
    const log = await screen.findByRole('log', { name: 'Messages' });
    expect(await within(log).findByText('Customer is waiting')).toBeInTheDocument();
    expect(within(log).getAllByText('Escalation').length).toBeGreaterThan(0);
  });
});
