import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const allowed = vi.hoisted(() => ({ exportWork: true }));
vi.mock('./access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canAuditWork: () => true, canExportWork: () => allowed.exportWork,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from './pages/WorkBoardPage';
import { itemLink, shareText } from './shareLink';
import { returnPath } from '../login/returnPath';
import { useAuthStore } from '../../store/useAuthStore';

const STORY = 'Cashier adds lab tests to an OPD bill';
useAuthStore.setState({ user: { id: 'u-1', name: 'Local reviewer', email: 'dev@localhost' } as never });

async function openShare() {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/work']}><WorkBoardPage /></MemoryRouter>);
  await user.click(within(await screen.findByRole('table', { name: 'Work items' })).getByText(STORY));
  const item = await screen.findByRole('complementary', { name: new RegExp(STORY) });
  await user.click(within(item).getByRole('button', { name: 'Share' }));
  return { user, menu: within(item).getByRole('menu', { name: /^Share / }) };
}

afterEach(() => { allowed.exportWork = true; vi.restoreAllMocks(); });

describe('Sharing a work item', () => {
  it('copies a link that opens the item', async () => {
    const { user, menu } = await openShare();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(menu).getByRole('menuitem', { name: 'Copy link' }));
    await waitFor(() => expect(copied).toHaveBeenCalledWith(expect.stringMatching(/\/work\?item=[^&]+$/)));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sends the key, title and link on WhatsApp', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user, menu } = await openShare();
    await user.click(within(menu).getByRole('menuitem', { name: 'WhatsApp' }));
    const [url, target] = opened.mock.calls[0];
    expect(target).toBe('_blank');
    const text = new URL(String(url)).searchParams.get('text')!;
    expect(String(url)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(text).toMatch(new RegExp(`^HMS-\\d+: ${STORY}\\n.*/work\\?item=`));
  });

  it("keeps the title out of the message for people who can't take board content out", async () => {
    allowed.exportWork = false;
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user, menu } = await openShare();
    await user.click(within(menu).getByRole('menuitem', { name: 'Email' }));
    const url = String(opened.mock.calls[0][0]);
    expect(url.startsWith('mailto:?subject=')).toBe(true);
    expect(decodeURIComponent(url)).not.toContain(STORY);
    expect(decodeURIComponent(url)).toMatch(/HMS-\d+ on the Daily Work Board/);
  });

  it('builds links and messages', () => {
    const link = itemLink('a b', 'https://cms.example.com');
    expect(link).toBe('https://cms.example.com/work?item=a%20b');
    expect(shareText('HMS-7', 'Fix GST', true, link)).toBe(`HMS-7: Fix GST\n${link}`);
    expect(shareText('HMS-7', 'Fix GST', false, link)).toBe(`HMS-7 on the Daily Work Board\n${link}`);
  });
});

describe('Opening a shared link before signing in', () => {
  it('goes back to the page after signing in, never to another site', () => {
    expect(returnPath('/work?item=abc')).toBe('/work?item=abc');
    expect(returnPath('//evil.example.com')).toBe('/');
    expect(returnPath('https://evil.example.com')).toBe('/');
    expect(returnPath('/\\evil.example.com')).toBe('/');
    expect(returnPath('/login')).toBe('/');
    expect(returnPath(undefined)).toBe('/');
  });
});
