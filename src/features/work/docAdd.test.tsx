import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('./access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canAuditWork: () => true, canExportWork: () => true,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from './pages/WorkBoardPage';
import { docsService } from './docs/docsService';
import { useAuthStore } from '../../store/useAuthStore';

useAuthStore.setState({ user: { id: 'u-1', name: 'Local reviewer', email: 'dev@localhost' } as never });
const STORY = 'Cashier adds lab tests to an OPD bill';
const pdf = (name: string, size = 1200) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });

/** Shows the current address, so a test can see where the app went. */
function Where() { return <output data-testid="where">{useLocation().search}</output>; }

async function openStory(user: ReturnType<typeof userEvent.setup>) {
  render(<MemoryRouter initialEntries={['/work']}><Routes><Route path="/work" element={<><WorkBoardPage /><Where /></>} /></Routes></MemoryRouter>);
  await user.click(within(await screen.findByRole('table', { name: 'Work items' })).getByText(STORY));
  return screen.findByRole('complementary', { name: new RegExp(STORY) });
}
const linkedList = (panel: HTMLElement) => within(panel).findByRole('list', { name: 'Linked documents' });

describe('Adding documents to a work item', () => {
  it('uploads files into a folder and links them to the item', async () => {
    const user = userEvent.setup();
    const linked = vi.spyOn(docsService, 'link');
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: /Add a document/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a document' });

    await user.upload(within(dialog).getByLabelText('Choose files to upload'), [pdf('Bill layout.pdf'), pdf('GST table.pdf')]);
    expect(within(within(dialog).getByRole('list', { name: 'Files to upload' })).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Upload and link 2 files' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a document' })).not.toBeInTheDocument());
    const list = await linkedList(panel);
    expect(within(list).getByText('Bill layout.pdf')).toBeInTheDocument();
    expect(within(list).getByText('GST table.pdf')).toBeInTheDocument();
    expect(linked).toHaveBeenCalledTimes(2);
    // They are ordinary documents: the Docs tab finds them too.
    expect((await docsService.list(null, 'GST table')).map(d => d.name)).toContain('GST table.pdf');
    linked.mockRestore();
  });

  it('makes a new page named after the item, links it and opens it to write', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: /Add a document/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a document' });
    await user.click(within(dialog).getByRole('tab', { name: /New page/ }));
    const name = within(dialog).getByRole('textbox', { name: 'Page name' });
    expect((name as HTMLInputElement).value).toMatch(new RegExp(`^HMS-\\d+ ${STORY}$`));
    await user.clear(name);
    await user.type(name, 'Lab test billing notes');
    await user.click(within(dialog).getByRole('button', { name: 'Make the page and link it' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/tab=docs&doc=/));
    const page = (await docsService.list(null, 'Lab test billing notes')).find(d => d.name === 'Lab test billing notes')!;
    expect((await docsService.get(page.documentId)).linkedItems).toHaveLength(1);
  });

  it('takes files dropped on the item, and leaves out ones that cannot be uploaded', async () => {
    const user = userEvent.setup();
    const panel = await openStory(user);
    const section = (await within(panel).findByRole('heading', { name: /Linked documents/ })).closest('section')!;
    fireEvent.drop(section, { dataTransfer: { files: [pdf('Scan.pdf'), new File(['x'], 'tool.exe')], types: ['Files'] } });
    const dialog = await screen.findByRole('dialog', { name: 'Add a document' });
    const files = within(dialog).getByRole('list', { name: 'Files to upload' });
    expect(within(files).getByText('tool.exe').closest('li')).toHaveClass('is-bad');
    await user.click(within(dialog).getByRole('button', { name: 'Upload and link' }));
    expect(await within(await linkedList(panel)).findByText('Scan.pdf')).toBeInTheDocument();
    expect(within(await linkedList(panel)).queryByText('tool.exe')).not.toBeInTheDocument();
  });

  it('keeps what failed so it can be tried again, without uploading the rest twice', async () => {
    const user = userEvent.setup();
    const real = docsService.upload;
    const upload = vi.spyOn(docsService, 'upload').mockImplementation(async (file, folder) => {
      if (file.name === 'Flaky.pdf') throw { response: { status: 500, data: { message: 'The file store is not answering.' } } };
      return real(file, folder);
    });
    const panel = await openStory(user);
    await user.click(within(panel).getByRole('button', { name: /Add a document/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a document' });
    await user.upload(within(dialog).getByLabelText('Choose files to upload'), [pdf('Fine.pdf'), pdf('Flaky.pdf')]);
    await user.click(within(dialog).getByRole('button', { name: 'Upload and link 2 files' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The file store is not answering.');
    const left = within(dialog).getByRole('list', { name: 'Files to upload' });
    expect(within(left).getAllByRole('listitem')).toHaveLength(1);
    expect(within(left).getByText('Flaky.pdf')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(within(await linkedList(panel)).getByText('Fine.pdf')).toBeInTheDocument();
    upload.mockRestore();
  });
});
