import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../access', () => ({ HEALTH_WIKI_MOCK: true, canUseHealthWiki: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import HealthWikiPage from './HealthWikiPage';
import ArticleEditorPage from './ArticleEditorPage';
import ContributorsPage from './ContributorsPage';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/health-wiki" element={<HealthWikiPage />} />
        <Route path="/health-wiki/contributors" element={<ContributorsPage />} />
        <Route path="/health-wiki/new" element={<ArticleEditorPage />} />
        <Route path="/health-wiki/:slug" element={<ArticleEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Articles list', () => {
  it('shows articles with their type and filters by tab and type', async () => {
    renderAt('/health-wiki');
    expect(await screen.findByText('Understanding Type 2 Diabetes')).toBeInTheDocument();
    expect(screen.getByText('How ABDM Is Changing Hospital Records')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Drafts/ }));
    expect(screen.getByText('Thyroid Basics')).toBeInTheDocument();
    expect(screen.queryByText('Understanding Type 2 Diabetes')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /All/ }));
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'SECTOR_UPDATE');
    expect(screen.getByText('How ABDM Is Changing Hospital Records')).toBeInTheDocument();
    expect(screen.queryByText('Thyroid Basics')).not.toBeInTheDocument();
  });

  it('shows how many contributors wait for verification', async () => {
    renderAt('/health-wiki');
    expect(await screen.findByTitle('Waiting for verification or approval')).toHaveTextContent('2');
  });
});

describe('Article editor', () => {
  it('builds a slug from the title and blocks submit without content, author and reviewer', async () => {
    renderAt('/health-wiki/new');
    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, 'Healthy Heart Tips');
    expect(screen.getByLabelText('Slug')).toHaveValue('healthy-heart-tips');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Content cannot be empty.')).toBeInTheDocument();
    expect(screen.getByText('Pick a reviewer to submit.')).toBeInTheDocument();
    expect(screen.getByText('Pick an author to submit.')).toBeInTheDocument();
  });

  it('hides the reviewer and condition for a Sector update', async () => {
    renderAt('/health-wiki/new');
    await screen.findByLabelText('Title');
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Article type'), 'SECTOR_UPDATE');
    expect(screen.queryByText('Reviewer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Related condition')).not.toBeInTheDocument();
    expect(screen.getByText(/never the reviewer badge/)).toBeInTheDocument();
  });

  it('offers only verified doctors as reviewer', async () => {
    renderAt('/health-wiki/new');
    await screen.findByLabelText('Title');
    const reviewer = screen.getByText('Reviewer').closest('.hw-picker') as HTMLElement;
    await userEvent.click(within(reviewer).getByRole('button', { name: /Choose a person/ }));
    expect(screen.getByRole('option', { name: /Dr. Meera Nair/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dr. Imran Qureshi/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Dr. Kavita Rao/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Rohan Mehta/ })).not.toBeInTheDocument();
  });

  it('locks a published article', async () => {
    renderAt('/health-wiki/diabetes-type-2');
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeDisabled());
    expect(screen.getByText(/Published and visible on Doctor Dekho/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
  });

  it('renders saved markdown as formatted text in the editor', async () => {
    renderAt('/health-wiki/diabetes-type-2');
    expect(await screen.findByRole('heading', { name: 'What is Type 2 Diabetes?' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the comment on a draft sent back', async () => {
    renderAt('/health-wiki/thyroid-basics');
    expect(await screen.findByText(/Please add when to see a doctor/)).toBeInTheDocument();
  });

  it('lets an editor approve a Sector update in review, which publishes it', async () => {
    renderAt('/health-wiki/abdm-and-hospital-records');
    const approve = await screen.findByRole('button', { name: 'Approve and publish' });
    await userEvent.click(approve);
    expect(await screen.findByText(/Published and visible on Doctor Dekho/)).toBeInTheDocument();
  });

  it('needs a reason to return an article to draft', async () => {
    renderAt('/health-wiki/high-blood-pressure');
    await userEvent.click(await screen.findByRole('button', { name: 'Return to draft' }));
    expect(await screen.findByText(/Add a reason/)).toBeInTheDocument();
  });

  it('offers to send the WhatsApp link only for an independent doctor', async () => {
    renderAt('/health-wiki/new');
    await screen.findByLabelText('Title');
    const reviewer = screen.getByText('Reviewer').closest('.hw-picker') as HTMLElement;
    await userEvent.click(within(reviewer).getByRole('button', { name: /Choose a person/ }));
    await userEvent.click(within(screen.getByRole('option', { name: /Dr. Imran Qureshi/ })).getByRole('button'));
    expect(await screen.findByText(/is an independent doctor/)).toBeInTheDocument();
    expect(screen.getByText(/Save the draft first/)).toBeInTheDocument();
  });
});

describe('Contributors', () => {
  it('lists people with status and filters by role and status', async () => {
    renderAt('/health-wiki/contributors');
    expect(await screen.findByText('Dr. Kavita Rao')).toBeInTheDocument();
    expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'PENDING');
    expect(screen.getByText('Dr. Kavita Rao')).toBeInTheDocument();
    expect(screen.getByText('Neha Iyer')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Meera Nair')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter by role'), 'WRITER');
    expect(screen.queryByText('Dr. Kavita Rao')).not.toBeInTheDocument();
  });

  it('verifies a doctor after checking the registration', async () => {
    renderAt('/health-wiki/contributors');
    const row = (await screen.findByText('Dr. Kavita Rao')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Verify' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('52871')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open the register' })).toHaveAttribute('href', expect.stringContaining('nmc.org.in'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as verified' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(row).getByText('Verified')).toBeInTheDocument();
  });

  it('needs a reason to reject, and approves a writer without a registration check', async () => {
    renderAt('/health-wiki/contributors');
    const row = (await screen.findByText('Neha Iyer')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('link', { name: 'Open the register' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(within(dialog).getByText(/Add a reason/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('If rejecting, say why'), 'Profile has no organisation');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(within(row).getByText('Rejected')).toBeInTheDocument());
  });

  it('invites a contributor and validates the mobile number', async () => {
    renderAt('/health-wiki/contributors');
    await screen.findByText('Dr. Kavita Rao');
    await userEvent.click(screen.getByRole('button', { name: /Invite contributor/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Dr. Priya Menon');
    await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '12345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send WhatsApp link' }));
    expect(within(dialog).getByText('Enter a 10-digit mobile number.')).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('WhatsApp number'));
    await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '9876512345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send WhatsApp link' }));
    expect(await screen.findByText('Dr. Priya Menon')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
