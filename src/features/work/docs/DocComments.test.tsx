import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canAuditWork: () => true, canExportWork: () => true,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));
vi.mock('../../../store/useAuthStore', () => {
  const state = { user: { id: 'u-1', name: 'Local reviewer', email: 'dev@localhost' }, permissions: [] as string[] };
  return { useAuthStore: (pick: (s: typeof state) => unknown) => pick(state) };
});

import WorkBoardPage from '../pages/WorkBoardPage';
import { docsService } from './docsService';

async function openPage(name = 'How we work', extra = '') {
  const doc = (await docsService.list(null, name.slice(0, 12))).find(d => d.name === name)!;
  render(<MemoryRouter initialEntries={[`/work?tab=docs&doc=${doc.documentId}${extra}`]}><WorkBoardPage /></MemoryRouter>);
  return { doc, panel: await screen.findByRole('region', { name: 'Comments' }) };
}

describe('comments on a document', () => {
  it('shows open threads with their replies and quoted text, and resolved ones apart', async () => {
    const { panel } = await openPage();
    expect(await within(panel).findByText('Should stand-up move to 10:30 on release days?')).toBeInTheDocument();
    expect(within(panel).getByText('Fine by me.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Stand-up is at 10:00\./ })).toBeInTheDocument();
    expect(within(panel).queryByText('Add the sprint length for new joiners.')).not.toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('tab', { name: 'Resolved (1)' }));
    expect(within(panel).getByText('Add the sprint length for new joiners.')).toBeInTheDocument();
    expect(within(panel).getByText(/Resolved by Asha Rao/)).toBeInTheDocument();
  });

  it('posts a comment that tags someone, and their answer arrives with a notification', async () => {
    const user = userEvent.setup();
    const { panel } = await openPage();
    await within(panel).findByText(/Should stand-up move/);

    const box = within(panel).getByRole('textbox', { name: 'Add a comment' });
    await user.type(box, 'Please confirm @Bil');
    await user.click(await within(panel).findByRole('option', { name: /Bilal Khan/ }));
    await user.click(within(panel).getByRole('button', { name: 'Comment' }));

    const tag = await within(panel).findByText('@Bilal Khan');
    expect(tag.tagName).toBe('MARK');
    expect(box).toHaveValue('');
    // The example teammate replies in the same thread and tags me.
    const all = await docsService.comments((await docsService.list(null)).find(d => d.name === 'How we work')!.documentId);
    const mine = all.find(c => c.body.startsWith('Please confirm'))!;
    await waitFor(async () => {
      const again = await docsService.comments(mine.documentId);
      expect(again.some(c => c.parentId === mine.commentId)).toBe(true);
    }, { timeout: 4000 });
    expect((await docsService.commentNotifications())[0]).toMatchObject({ kind: 'Mention', actorName: 'Bilal Khan', documentName: 'How we work' });
  });

  it('replies in a thread, resolves it and reopens it', async () => {
    const user = userEvent.setup();
    const { panel } = await openPage();
    const first = await within(panel).findByText('Should stand-up move to 10:30 on release days?');
    const thread = first.closest('.dc-thread') as HTMLElement;

    await user.click(within(thread).getAllByRole('button', { name: /Reply/ })[0]);
    await user.type(within(thread).getByRole('textbox', { name: 'Write a reply' }), 'Agreed, 10:30 it is');
    await user.click(within(thread.querySelector('.dc-cbox') as HTMLElement).getByRole('button', { name: 'Reply' }));
    expect(await within(thread).findByText('Agreed, 10:30 it is')).toBeInTheDocument();

    await user.click(within(thread).getByRole('button', { name: /Resolve/ }));
    await waitFor(() => expect(within(panel).queryByText('Agreed, 10:30 it is')).not.toBeInTheDocument());
    await user.click(within(panel).getByRole('tab', { name: 'Resolved (2)' }));
    expect(within(panel).getByText('Agreed, 10:30 it is')).toBeInTheDocument();

    const resolved = within(panel).getByText('Agreed, 10:30 it is').closest('.dc-thread') as HTMLElement;
    await user.click(within(resolved).getByRole('button', { name: /Reopen/ }));
    await waitFor(() => expect(within(panel).getByRole('tab', { name: 'Resolved (1)' })).toBeInTheDocument());
  });

  it('lets people change and remove their own comment', async () => {
    const user = userEvent.setup();
    const { panel } = await openPage('Billing redesign: what we agreed');
    await user.type(await within(panel).findByRole('textbox', { name: 'Add a comment' }), 'Frist draft');
    await user.click(within(panel).getByRole('button', { name: 'Comment' }));
    const thread = (await within(panel).findByText('Frist draft', { selector: '.dc-comment-text span' })).closest('.dc-thread') as HTMLElement;

    await user.click(within(thread).getByRole('button', { name: /Edit/ }));
    const edit = within(thread).getByRole('textbox', { name: 'Change your comment' });
    await user.clear(edit);
    await user.type(edit, 'First draft');
    await user.click(within(thread).getByRole('button', { name: 'Save' }));
    expect(await within(thread).findByText('First draft', { selector: '.dc-comment-text span' })).toBeInTheDocument();
    expect(within(thread).getByText('edited')).toBeInTheDocument();

    await user.click(within(thread).getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(within(panel).queryByText('First draft')).not.toBeInTheDocument());
    expect(within(panel).getByText('No open comments.')).toBeInTheDocument();
  });

  it('offers the selected text as what the comment is about', async () => {
    const user = userEvent.setup();
    const { panel } = await openPage('Billing redesign: what we agreed');
    await within(panel).findByRole('textbox', { name: 'Add a comment' });
    const title = document.querySelector('.dc-view-main .ProseMirror, .dc-view-main') as HTMLElement;
    const holder = document.createElement('p');
    holder.textContent = 'Tax is shown per line';
    title.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));

    const box = await within(panel).findByRole('textbox', { name: 'Comment on the selected text' });
    await user.type(box, 'Is this per item or per bill?');
    await user.click(within(panel).getByRole('button', { name: 'Comment' }));

    expect(await within(panel).findByRole('button', { name: /Tax is shown per line/ })).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Add a comment' })).toBeInTheDocument();
  });
});
