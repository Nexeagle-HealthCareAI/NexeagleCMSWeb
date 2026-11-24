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
import { mockWork } from './services/mockWork';
import { useAuthStore } from '../../store/useAuthStore';

const STORY = 'Cashier adds lab tests to an OPD bill';
// The example data's "me" is u-1.
useAuthStore.setState({ user: { id: 'u-1', name: 'Local reviewer', email: 'dev@localhost' } as never });
const tagList = (panel: HTMLElement) => within(panel).findByRole('listbox', { name: 'People to tag' });
const open = (path = '/work') => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);

async function openStory(user: ReturnType<typeof userEvent.setup>) {
  open();
  const table = await screen.findByRole('table', { name: 'Work items' });
  await user.click(within(table).getByText(STORY));
  return screen.findByRole('complementary', { name: new RegExp(STORY) });
}

describe('Tagging people in a work item', () => {
  it('shows a tag for me in a comment, and lets me tag someone in mine', async () => {
    const user = userEvent.setup();
    const added = vi.spyOn(mockWork, 'addComment');
    const panel = await openStory(user);

    // Bilal tagged me: the comment stands out and the tag is marked.
    const found = await within(panel).findByText(/the GST line is still wrong/);
    const theirs = found.closest('li')!;
    expect(theirs).toHaveClass('is-for-me');
    expect(within(theirs).getByText('@Local reviewer').tagName).toBe('MARK');

    const box = within(panel).getByRole('textbox', { name: 'Add a comment' });
    await user.type(box, 'Please check the rounding @As');
    const list = await tagList(panel);
    const pick = within(list).getByRole('option', { name: /Asha Rao/ });
    expect(within(list).queryByRole('option', { name: /Local reviewer/ })).not.toBeInTheDocument(); // never yourself
    await user.click(pick);
    expect(box).toHaveValue('Please check the rounding @Asha Rao ');
    await user.type(box, 'today');
    await user.click(within(panel).getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(added).toHaveBeenCalledWith(expect.any(String), 'Please check the rounding @Asha Rao today', ['u-2']));
    const mine = (await within(panel).findByText(/Please check the rounding/, { selector: '.wk-comment-body span' })).closest('li')!;
    expect(within(mine).getByText('@Asha Rao').tagName).toBe('MARK');
    added.mockRestore();
  });

  it('picks a name with the keyboard', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    const box = within(panel).getByRole('textbox', { name: 'Add a comment' });
    await user.type(box, '@Bi');
    within(await tagList(panel)).getByRole('option', { name: /Bilal Khan/ });
    await user.keyboard('{Enter}');
    expect(box).toHaveValue('@Bilal Khan ');
    expect(within(panel).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('tags who can help in what is blocking the item', async () => {
    const user = userEvent.setup();
    const saved = vi.spyOn(mockWork, 'updateItem');
    const panel = await openStory(user);

    await user.click(within(panel).getByRole('button', { name: /Mark as blocked/ }));
    const reason = within(panel).getByRole('textbox', { name: 'What is blocking it?' });
    await user.type(reason, 'Waiting on the tax table from @Bi');
    await user.click(within(await tagList(panel)).getByRole('option', { name: /Bilal Khan/ }));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(saved).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      isBlocked: true, blockedReason: 'Waiting on the tax table from @Bilal Khan', blockedMentionUserIds: ['u-3'],
    })));
    const banner = (await within(panel).findByText(/Waiting on the tax table/)).closest('.wk-blocked') as HTMLElement;
    expect(within(banner).getByText('@Bilal Khan').tagName).toBe('MARK');
    saved.mockRestore();
  });

  it('tells me in the bell where I was tagged, and opens the item', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Work items' });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Notifications, [1-9]/ })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^Notifications/ }));
    const note = await screen.findByRole('button', { name: new RegExp(`Bilal Khan tagged you in a comment on HMS-\\d+ “${STORY}”`) });
    await user.click(note);
    expect(await screen.findByRole('complementary', { name: new RegExp(STORY) })).toBeInTheDocument();
  });
});
