import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Run on the in-memory example data, as VITE_WORK_MOCK=true does.
const allowExport = vi.hoisted(() => ({ value: true }));
vi.mock('../access', () => ({
  WORK_MOCK: true, WORK_VIEW: 'work.view', WORK_EDIT: 'work.edit', WORK_MANAGE: 'work.manage',
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true,
  // Deleting is a separate permission; the tests flip it.
  canDeleteWork: () => allowDelete.value,
  canManageMembers: () => true, canAuditWork: () => true, canExportWork: () => allowExport.value,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));
const allowDelete = vi.hoisted(() => ({ value: true }));

import WorkBoardPage from './WorkBoardPage';

const open = (path = '/work') => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);

describe('Daily Work Board', () => {
  it('shows the two tabs and the items of the first project, nested', async () => {
    open();
    expect(screen.getByRole('tab', { name: /Work management/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Docs/ })).toBeInTheDocument();

    const list = await screen.findByRole('table', { name: 'Work items' });
    expect(within(list).getByText('Faster billing at the counter')).toBeInTheDocument();
    expect(within(list).getByText('Search box for tests')).toBeInTheDocument();
  });

  it('filters by words and keeps the parents of a match', async () => {
    const user = userEvent.setup();
    open();
    const list = await screen.findByRole('table', { name: 'Work items' });

    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'price and tax');

    await waitFor(() => expect(within(list).queryByText('Update the pharmacy price list import')).not.toBeInTheDocument());
    expect(within(list).getByText('Show price and tax')).toBeInTheDocument();
    expect(within(list).getByText('Cashier adds lab tests to an OPD bill')).toBeInTheDocument();
    expect(screen.getByText(/1 of \d+ items match/)).toBeInTheDocument();
  });

  it('creates a task and opens it', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Work items' });

    await user.click(screen.getByRole('button', { name: /New item/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Write the release note');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    const panel = await screen.findByRole('complementary', { name: /Write the release note/ });
    expect(within(panel).getByLabelText('Title')).toHaveValue('Write the release note');
    expect(within(screen.getByRole('table', { name: 'Work items' })).getByText('Write the release note')).toBeInTheDocument();
  });

  it('refuses a subtask without a parent in the form', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Work items' });
    await user.click(screen.getByRole('button', { name: /New item/ }));
    // Subtask is only offered from a parent item, never from the top button.
    expect(within(screen.getByRole('dialog')).queryByRole('radio', { name: 'Subtask' })).not.toBeInTheDocument();
  });

  it('switches to the board: one column per status, without epics and features', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Work items' });

    await user.click(screen.getByRole('button', { name: /Board/ }));

    const done = screen.getByRole('region', { name: /^Done, 1 items/ });
    expect(within(done).getByText('Search box for tests')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^In review/ })).toBeInTheDocument();
    expect(screen.queryByText('Faster billing at the counter')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /List/ }));
    expect(await screen.findByText('Faster billing at the counter')).toBeInTheDocument();
  });

  it('lets the list show the columns the person picks', async () => {
    const user = userEvent.setup();
    localStorage.removeItem('wk.columns');
    open();
    const table = await screen.findByRole('table', { name: 'Work items' });
    expect(within(table).getByRole('columnheader', { name: 'Assignee' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Start date' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Reporter' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Columns/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Reporter' }));
    await user.click(screen.getByRole('checkbox', { name: 'Labels' }));

    expect(within(table).getByRole('columnheader', { name: 'Reporter' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Labels' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('wk.columns') || '[]')).toContain('reporter');
    localStorage.removeItem('wk.columns');
  });

  it('adds a custom column to the board', async () => {
    const user = userEvent.setup();
    localStorage.setItem('wk.view', 'board');
    open();
    await screen.findByRole('region', { name: /^To do/ });

    await user.click(screen.getByRole('button', { name: /Add column/ }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Ready for QA');
    await user.click(within(dialog).getByRole('button', { name: 'Add column' }));

    expect(await screen.findByRole('region', { name: /^Ready for QA, 0 items/ })).toBeInTheDocument();
    localStorage.removeItem('wk.view');
  });

  it('hides delete from people without the delete permission', async () => {
    const user = userEvent.setup();
    allowDelete.value = false;
    open();
    const table = await screen.findByRole('table', { name: 'Work items' });
    await user.click(within(table).getByText('Update the pharmacy price list import'));
    const panel = await screen.findByRole('complementary', { name: /Update the pharmacy/ });
    expect(within(panel).queryByRole('button', { name: 'Delete item' })).not.toBeInTheDocument();
    allowDelete.value = true;
  });

  it('asks the person to type the item key before it deletes', async () => {
    const user = userEvent.setup();
    open();
    const table = await screen.findByRole('table', { name: 'Work items' });
    await user.click(within(table).getByText('Update the pharmacy price list import'));
    const panel = await screen.findByRole('complementary', { name: /Update the pharmacy/ });

    await user.click(within(panel).getByRole('button', { name: 'Delete item' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'hms-7');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Work items' })).queryByText('Update the pharmacy price list import')).not.toBeInTheDocument());
  });

  it('links a document to a work item from the item panel', async () => {
    const user = userEvent.setup();
    open();
    const table = await screen.findByRole('table', { name: 'Work items' });
    await user.click(within(table).getByText('One-screen bill'));
    const panel = await screen.findByRole('complementary', { name: /One-screen bill/ });

    await user.click(within(panel).getByRole('button', { name: /Link a document/ }));
    const dialog = screen.getByRole('dialog', { name: 'Link a document' });
    await user.type(within(dialog).getByRole('searchbox'), 'billing');
    await user.click(await within(dialog).findByRole('button', { name: /Billing redesign/ }));

    // The picker closes, and the document is listed on the item.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(panel).getByRole('button', { name: /^Page Billing redesign: what we agreed/ })).toBeInTheDocument();
  });
});
