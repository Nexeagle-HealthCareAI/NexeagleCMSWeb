import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('./access', () => ({
  KEYWORDS_MOCK: true,
  canViewKeywords: () => true,
  keywordsCan: () => ({ view: true, edit: true, connect: true }),
}));
vi.mock('../admin/services/adminService', () => ({
  adminService: { getAssignees: () => Promise.resolve([{ userId: 'u-1', fullName: '[Writer]' }]) },
}));

import KeywordsPage from './KeywordsPage';
import { change, dueLabel, short, signed } from './keywordUtils';

const open = (path = '/keywords') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/keywords" element={<KeywordsPage />} />
        <Route path="/keywords/:tab" element={<KeywordsPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { localStorage.clear(); });

describe('Keywords rules on the screen', () => {
  it('writes big numbers the Indian way and changes as signed percentages', () => {
    expect(short(950)).toBe('950');
    expect(short(14_800)).toBe('14.8K');
    expect(short(120_000)).toBe('1.2L');
    expect(short(25_000_000)).toBe('2.5Cr');
    expect(change(120, 100)).toBe(20);
    expect(change(5, 0)).toBeNull();
    expect(signed(-12)).toBe('−12%');
    expect(dueLabel('2026-12-05')).toBe('5 Dec');
  });
});

describe('Keywords section', () => {
  it('opens on the overview with opportunities, languages and this morning’s collection', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Best opportunities today' })).toBeInTheDocument();
    expect(screen.getByText('Keywords tracked')).toBeInTheDocument();
    expect((await screen.findAllByText('Language gap')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Demand by language' })).toBeInTheDocument();
    expect(screen.getAllByText('Hinglish').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'This morning’s collection' })).toBeInTheDocument();
    expect(screen.getByText(/at least 5 different visitors/)).toBeInTheDocument();
    // Wikipedia and the other later sources are not listed as collected.
    expect(screen.queryByText('Wikipedia views')).not.toBeInTheDocument();
  });

  it('filters by website and language, and opens a keyword with its sources and other languages', async () => {
    open('/keywords/keywords');
    expect(await screen.findByRole('button', { name: 'dengue ke lakshan' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'nexeagle.com' }));
    expect(await screen.findByRole('button', { name: 'hospital management software' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'dengue ke lakshan' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Both' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hindi' }));
    const hindi = await screen.findByRole('button', { name: 'डेंगू के लक्षण' });
    expect(screen.queryByRole('button', { name: 'dengue symptoms' })).not.toBeInTheDocument();

    await userEvent.click(hindi);
    const pane = await screen.findByRole('complementary', { name: 'Keyword details' });
    expect(await within(pane).findByText('Keyword Planner')).toBeInTheDocument();
    expect(within(pane).getByText('Same topic in other languages')).toBeInTheDocument();
    expect(within(pane).getByText('dengue ke lakshan')).toBeInTheDocument();
    expect(within(pane).getByRole('link', { name: 'Add to content plan' })).toHaveAttribute('href', expect.stringContaining('/keywords/content?new=1&topic='));
  });

  it('shows topics with demand per language and why now, and the topic’s keywords and questions', async () => {
    open('/keywords/topics');
    const row = await screen.findByRole('button', { name: 'Dengue and platelets' });
    expect(screen.getAllByText('Close to page one').length).toBeGreaterThan(0);
    await userEvent.click(row);
    const pane = await screen.findByRole('complementary', { name: 'Topic details' });
    expect(await within(pane).findByText('Questions people ask')).toBeInTheDocument();
    expect(within(pane).getByText('dengue me platelets kitna hona chahiye', { selector: 'li' })).toBeInTheDocument();
    expect(within(pane).getByText(/68% of the demand/)).toBeInTheDocument();
    expect(within(pane).getByRole('link', { name: 'Plan content' })).toBeInTheDocument();
  });

  it('plans content from a topic, filling the main keyword in each language', async () => {
    open('/keywords/topics');
    await userEvent.click(await screen.findByRole('button', { name: 'Piles treatment' }));
    const pane = await screen.findByRole('complementary', { name: 'Topic details' });
    await userEvent.click(await within(pane).findByRole('link', { name: 'Plan content' }));

    const editor = await screen.findByRole('complementary', { name: 'New content' });
    expect(within(editor).getByLabelText('Title')).toHaveValue('Piles treatment');
    await userEvent.click(within(editor).getByLabelText('Hinglish'));
    expect(within(editor).getByLabelText('Main keyword, Hinglish')).toBeInTheDocument();
    expect(within(editor).getByText('Written or reviewed by a named doctor')).toBeInTheDocument();
    await userEvent.click(within(editor).getByRole('button', { name: 'Add to the plan' }));

    const saved = await screen.findByRole('complementary', { name: 'Content details' });
    expect(within(saved).getByLabelText('Main keyword, Hinglish')).toHaveValue('piles ka ilaj');
    expect(within(saved).getByLabelText('Page')).toHaveValue('/health/conditions/piles');
    expect(screen.getByRole('button', { name: /Idea 1/ })).toBeInTheDocument();
  });

  it('shows the numbers since publishing for published content', async () => {
    open('/keywords/content');
    await userEvent.click(await screen.findByRole('button', { name: /Choosing hospital software/ }));
    const pane = await screen.findByRole('complementary', { name: 'Content details' });
    expect(within(pane).getByText(/Since publishing/)).toBeInTheDocument();
  });

  it('lists sources in Setup and will not save a site-search threshold under 5', async () => {
    open('/keywords/setup');
    expect(await screen.findByRole('heading', { name: 'Sources' })).toBeInTheDocument();
    expect(screen.getByText('Google Trends')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Run now' }).length).toBe(4);
    const min = screen.getByLabelText(/this many different visitors/);
    await userEvent.clear(min);
    await userEvent.type(min, '3');
    expect(screen.getByRole('button', { name: 'Save Setup' })).toBeDisabled();
    await userEvent.clear(min);
    await userEvent.type(min, '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save Setup' }));
    expect(await screen.findByText('Saved. The next collection uses it.')).toBeInTheDocument();
  });
});
