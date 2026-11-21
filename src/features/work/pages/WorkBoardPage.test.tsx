import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Run on the in-memory example data, as VITE_WORK_MOCK=true does.
vi.mock('../access', () => ({
  WORK_MOCK: true, WORK_VIEW: 'work.view', WORK_EDIT: 'work.edit', WORK_MANAGE: 'work.manage',
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true,
}));

import WorkBoardPage from './WorkBoardPage';

const open = (path = '/work') => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);

describe('Daily Work Board', () => {
  it('shows the two tabs and the items of the first project, nested', async () => {
    open();
    expect(screen.getByRole('tab', { name: /Work management/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Docs/ })).toBeInTheDocument();

    const list = await screen.findByRole('list', { name: 'Work items' });
    expect(within(list).getByText('Faster billing at the counter')).toBeInTheDocument();
    expect(within(list).getByText('Search box for tests')).toBeInTheDocument();
  });

  it('filters by words and keeps the parents of a match', async () => {
    const user = userEvent.setup();
    open();
    const list = await screen.findByRole('list', { name: 'Work items' });

    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'price and tax');

    await waitFor(() => expect(within(list).queryByText('Update the pharmacy price list import')).not.toBeInTheDocument());
    expect(within(list).getByText('Show price and tax')).toBeInTheDocument();
    expect(within(list).getByText('Cashier adds lab tests to an OPD bill')).toBeInTheDocument();
    expect(screen.getByText(/1 of \d+ items match/)).toBeInTheDocument();
  });

  it('creates a task and opens it', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('list', { name: 'Work items' });

    await user.click(screen.getByRole('button', { name: /New item/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Write the release note');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    const panel = await screen.findByRole('complementary', { name: /Write the release note/ });
    expect(within(panel).getByLabelText('Title')).toHaveValue('Write the release note');
    expect(within(screen.getByRole('list', { name: 'Work items' })).getByText('Write the release note')).toBeInTheDocument();
  });

  it('refuses a subtask without a parent in the form', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('list', { name: 'Work items' });
    await user.click(screen.getByRole('button', { name: /New item/ }));
    // Subtask is only offered from a parent item, never from the top button.
    expect(within(screen.getByRole('dialog')).queryByRole('radio', { name: 'Subtask' })).not.toBeInTheDocument();
  });

  it('shows what is coming on the Docs tab', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('tab', { name: /Docs/ }));
    expect(screen.getByRole('heading', { name: 'Docs is being built next' })).toBeInTheDocument();
  });
});
