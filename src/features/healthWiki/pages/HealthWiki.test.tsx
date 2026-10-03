import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../access', () => ({ HEALTH_WIKI_MOCK: true, canUseHealthWiki: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import HealthWikiPage from './HealthWikiPage';
import ArticleEditorPage from './ArticleEditorPage';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/health-wiki" element={<HealthWikiPage />} />
        <Route path="/health-wiki/new" element={<ArticleEditorPage />} />
        <Route path="/health-wiki/:slug" element={<ArticleEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Health Wiki list', () => {
  it('shows articles with status counts and filters by tab', async () => {
    renderAt('/health-wiki');
    expect(await screen.findByText('Understanding Type 2 Diabetes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Drafts/ }));
    expect(screen.getByText('Thyroid Basics')).toBeInTheDocument();
    expect(screen.queryByText('Understanding Type 2 Diabetes')).not.toBeInTheDocument();
  });
});

describe('Article editor', () => {
  it('builds a slug from the title and blocks submit without a reviewer', async () => {
    renderAt('/health-wiki/new');
    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, 'Healthy Heart Tips');
    expect(screen.getByLabelText('Slug')).toHaveValue('healthy-heart-tips');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Content cannot be empty.')).toBeInTheDocument();
    expect(screen.getByText('Pick a reviewer to submit.')).toBeInTheDocument();
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

  it('shows the reviewer comment on a draft sent back', async () => {
    renderAt('/health-wiki/thyroid-basics');
    expect(await screen.findByText(/Please add when to see a doctor/)).toBeInTheDocument();
  });
});
