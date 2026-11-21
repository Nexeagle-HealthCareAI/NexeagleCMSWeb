import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Run on the in-memory example data, as VITE_WORK_MOCK=true does.
const can = vi.hoisted(() => ({ edit: true, remove: true }));
const allowExport = vi.hoisted(() => ({ value: true }));
vi.mock('../access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canExportWork: () => allowExport.value,
  canViewDocs: () => true, canEditDocs: () => can.edit, canDeleteDocs: () => can.remove, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from '../pages/WorkBoardPage';
import { buildFolderTree, formatSize, isInside, kindOf, uploadProblem } from './docsMeta';
import type { DocFolder } from './types';

const open = (path = '/work?tab=docs') => render(<MemoryRouter initialEntries={[path]}><WorkBoardPage /></MemoryRouter>);
const folder = (folderId: string, name: string, parentId: string | null = null): DocFolder =>
  ({ folderId, parentId, name, color: null, isRestricted: false, canManageAccess: true, documentCount: 0, updatedAt: '2026-11-01T00:00:00Z' });

describe('docs helpers', () => {
  const folders = [folder('a', 'Product'), folder('b', 'Specs', 'a'), folder('c', 'Notes')];

  it('builds the folder tree, and hides what is under a closed folder', () => {
    expect(buildFolderTree(folders, new Set()).map(n => [n.folder.name, n.depth])).toEqual([['Notes', 0], ['Product', 0], ['Specs', 1]]);
    expect(buildFolderTree(folders, new Set(['a'])).map(n => n.folder.name)).toEqual(['Notes', 'Product']);
  });

  it('knows when a folder is inside another', () => {
    expect(isInside(folders, 'b', 'a')).toBe(true);
    expect(isInside(folders, 'a', 'a')).toBe(true);
    expect(isInside(folders, 'c', 'a')).toBe(false);
  });

  it('names kinds and sizes', () => {
    expect(kindOf({ kind: 'File', name: 'Plan.PDF' })).toBe('pdf');
    expect(kindOf({ kind: 'File', name: 'sheet.xlsx' })).toBe('sheet');
    expect(kindOf({ kind: 'Page', name: 'Notes' })).toBe('page');
    expect(formatSize(900)).toBe('900 B');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('refuses programs, empty files and files over 25 MB before they are sent', () => {
    expect(uploadProblem(new File(['x'], 'setup.exe'))).toMatch(/cannot be uploaded/);
    expect(uploadProblem(new File([], 'empty.pdf'))).toMatch(/empty/);
    expect(uploadProblem(new File(['x'], 'plan.pdf'))).toBeNull();
  });
});

describe('Docs tab', () => {
  it('shows the folders and the top-level documents', async () => {
    open();
    const tree = await screen.findByRole('navigation', { name: 'Folders' });
    expect(await within(tree).findByText('Product')).toBeInTheDocument();
    expect(within(tree).getByText('HR and contracts')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(within(table).getByRole('button', { name: 'How we work' })).toBeInTheDocument();
  });

  it('opens a folder and uploads a file into it', async () => {
    const user = userEvent.setup();
    open();
    const tree = await screen.findByRole('navigation', { name: 'Folders' });
    await user.click(await within(tree).findByText('Product'));
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(await within(table).findByRole('button', { name: 'release-checklist.txt' })).toBeInTheDocument();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['hello'], 'roadmap.pdf', { type: 'application/pdf' }));

    expect(await within(screen.getByRole('table', { name: 'Documents' })).findByRole('button', { name: 'roadmap.pdf' })).toBeInTheDocument();
  });

  it('finds a page by words in its text, wherever it is', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Documents' });

    await user.type(screen.getByRole('searchbox', { name: 'Search documents' }), 'without leaving the bill');

    const results = await screen.findByRole('table', { name: 'Search results' });
    expect(await within(results).findByRole('button', { name: 'Billing redesign: what we agreed' })).toBeInTheDocument();
    expect(within(results).getByText('Product › Specs')).toBeInTheDocument();
  });

  it('creates a page and opens it in the editor', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('table', { name: 'Documents' });

    await user.click(screen.getByRole('button', { name: /New page/ }));

    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Untitled page');
    expect(await screen.findByRole('textbox', { name: 'Page text' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('moves a document to the bin and restores it', async () => {
    const user = userEvent.setup();
    open();
    const table = await screen.findByRole('table', { name: 'Documents' });
    await user.click(within(table).getByRole('button', { name: 'How we work' }));
    await user.click(await screen.findByRole('button', { name: 'Move to the bin' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to the bin' }));

    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Documents' })).queryByRole('button', { name: 'How we work' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bin' }));
    const bin = await screen.findByRole('table', { name: 'Bin' });
    expect(within(bin).getByText('How we work')).toBeInTheDocument();
    await user.click(within(bin).getByRole('button', { name: /Restore/ }));
    await waitFor(() => expect(screen.getByText('The bin is empty')).toBeInTheDocument());
  });

  it('hides the bin and the delete button from people without the delete permission', async () => {
    const user = userEvent.setup();
    can.remove = false;
    open();
    const table = await screen.findByRole('table', { name: 'Documents' });
    expect(screen.queryByRole('button', { name: 'Bin' })).not.toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'How we work' }));
    await screen.findByRole('textbox', { name: 'Name' });
    expect(screen.queryByRole('button', { name: 'Move to the bin' })).not.toBeInTheDocument();
    can.remove = true;
  });
});
