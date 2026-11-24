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
import { useAuthStore } from '../../store/useAuthStore';

useAuthStore.setState({ user: { id: 'u-1', name: 'Local reviewer', email: 'dev@localhost' } as never });
const STORY = 'Cashier adds lab tests to an OPD bill';

async function openStory(user: ReturnType<typeof userEvent.setup>) {
  render(<MemoryRouter initialEntries={['/work']}><WorkBoardPage /></MemoryRouter>);
  const table = await screen.findByRole('table', { name: 'Work items' });
  await user.click(within(table).getByText(STORY));
  return screen.findByRole('complementary', { name: new RegExp(STORY) });
}

describe('An item in a large window', () => {
  it('opens over the board with the details on the side, and can sit beside the list instead', async () => {
    localStorage.removeItem('wk.itemView');
    const user = userEvent.setup();
    const panel = await openStory(user);
    expect(panel).toHaveClass('is-window');
    expect(panel.closest('.wk-window-backdrop')).not.toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Details' })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Show beside the list' }));
    const beside = await screen.findByRole('complementary', { name: new RegExp(STORY) });
    expect(beside).not.toHaveClass('is-window');
    expect(localStorage.getItem('wk.itemView')).toBe('panel');
    await user.click(within(beside).getByRole('button', { name: 'Open in a large window' }));
    expect(localStorage.getItem('wk.itemView')).toBe('window');
  });

  it('steps to the next item and back without closing', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: 'Next item' }));
    const next = await screen.findByRole('complementary', { name: /Search box for tests/ });
    await user.click(within(next).getByRole('button', { name: 'Previous item' }));
    expect(await screen.findByRole('complementary', { name: new RegExp(STORY) })).toBeInTheDocument();
  });

  it('takes the item with one click', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: 'Assign to me' }));
    await waitFor(() => expect(within(panel).getByRole('combobox', { name: 'Assignee' })).toHaveValue('u-1'));
    expect(within(panel).queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument();
  });

  it('closes on a click outside, but not while a comment is being written', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    const backdrop = panel.closest('.wk-window-backdrop') as HTMLElement;
    await user.type(within(panel).getByRole('textbox', { name: 'Add a comment' }), 'half a thought');
    await user.pointer({ keys: '[MouseLeft]', target: backdrop });
    expect(screen.getByRole('complementary', { name: new RegExp(STORY) })).toBeInTheDocument();
    await user.clear(within(panel).getByRole('textbox', { name: 'Add a comment' }));
    await user.pointer({ keys: '[MouseLeft]', target: backdrop });
    await waitFor(() => expect(screen.queryByRole('complementary', { name: new RegExp(STORY) })).not.toBeInTheDocument());
  });

  it('links a document from a search that fits its dialog', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: /Link a document/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Link a document' });
    expect(within(dialog).getByRole('searchbox', { name: 'Search documents' })).toBeInTheDocument();
    await user.click(await within(dialog).findByRole('button', { name: /How we work/ }));
    expect(await within(panel).findByRole('button', { name: /How we work/ })).toBeInTheDocument();
  });
});
