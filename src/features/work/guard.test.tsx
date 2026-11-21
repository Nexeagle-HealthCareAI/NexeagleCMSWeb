import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Example data; the export permission is what the tests flip.
const allowExport = vi.hoisted(() => ({ value: false }));
vi.mock('./access', () => ({
  WORK_MOCK: true,
  canViewWork: () => true, canEditWork: () => true, canManageWork: () => true, canDeleteWork: () => true,
  canManageMembers: () => true, canExportWork: () => allowExport.value,
  canViewDocs: () => true, canEditDocs: () => true, canDeleteDocs: () => true, canSeeSensitiveDocs: () => true,
}));

import WorkBoardPage from './pages/WorkBoardPage';
import { CLIPBOARD_NOTICE, forgetHeld, guardCopy, guardPaste, watermarkImage } from './guard';

/** A clipboard event carrying a small stand-in for the browser's clipboard. */
function clip(type: 'copy' | 'cut' | 'paste', start: Record<string, string> = {}) {
  const store: Record<string, string> = { ...start };
  const e = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', {
    value: {
      getData: (k: string) => store[k] || '',
      setData: (k: string, v: string) => { store[k] = v; },
      clearData: () => { Object.keys(store).forEach(k => delete store[k]); },
    },
  });
  return { e, store };
}

const open = () => render(<MemoryRouter initialEntries={['/work']}><WorkBoardPage /></MemoryRouter>);

afterEach(() => { forgetHeld(); allowExport.value = false; document.querySelectorAll('body > textarea').forEach(el => el.remove()); });

describe('protected screen: clipboard', () => {
  it('hands the clipboard a notice instead of the selected text', () => {
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    field.value = 'Patient billing plan';
    field.focus();
    field.setSelectionRange(0, 7);

    const { e, store } = clip('copy');
    expect(guardCopy(e)).toBe(true);

    expect(e.defaultPrevented).toBe(true);
    expect(store['text/plain']).toBe(CLIPBOARD_NOTICE);
    expect(JSON.stringify(store)).not.toContain('Patient');
  });

  it('replaces what an editor put on the clipboard itself', () => {
    const { e, store } = clip('copy', { 'text/plain': 'Secret roadmap', 'text/html': '<p>Secret roadmap</p>' });
    e.preventDefault();

    expect(guardCopy(e)).toBe(true);

    expect(store).toEqual({ 'text/plain': CLIPBOARD_NOTICE });
  });

  it('leaves an empty copy alone', () => {
    const { e, store } = clip('copy');
    expect(guardCopy(e)).toBe(false);
    expect(store).toEqual({});
  });

  it('takes over a paste of the notice, and leaves a paste from outside alone', () => {
    const copied = clip('copy', { 'text/plain': 'Inside text' });
    copied.e.preventDefault();
    guardCopy(copied.e);

    const inside = clip('paste', { 'text/plain': CLIPBOARD_NOTICE });
    document.body.dispatchEvent(inside.e);
    expect(guardPaste(inside.e)).toBe(true);
    expect(inside.e.defaultPrevented).toBe(true);

    const outside = clip('paste', { 'text/plain': 'From an email' });
    expect(guardPaste(outside.e)).toBe(false);
    expect(outside.e.defaultPrevented).toBe(false);
  });

  it('builds a watermark that cannot break out of its image', () => {
    const image = decodeURIComponent(watermarkImage('Asha <b>"Rao"</b> · asha@example.com'));
    expect(image).toContain('Asha bRao/b · asha@example.com');
  });
});

describe('protected screen: page', () => {
  it('is on without the export permission: badge, watermark, and a veil when the window is left', async () => {
    open();
    expect(await screen.findByText('Protected')).toBeInTheDocument();
    expect(document.querySelector('.wk-watermark')).not.toBeNull();
    expect(document.documentElement).toHaveClass('wk-guarded');

    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(screen.getByRole('status')).toHaveTextContent('Hidden while you are in another window');
    expect(document.documentElement).toHaveClass('wk-veiled');

    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is off for someone who holds the export permission', async () => {
    allowExport.value = true;
    open();
    await screen.findByRole('table', { name: 'Work items' });
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(document.querySelector('.wk-watermark')).toBeNull();
  });
});

describe('board members', () => {
  it('makes a board members-only, marks it, and records who was added', async () => {
    const user = userEvent.setup();
    allowExport.value = true;
    open();
    await screen.findByRole('table', { name: 'Work items' });

    await user.click(screen.getByRole('button', { name: /Members/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Who can open 1HMS' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /Members only/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Asha Rao/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save access' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(screen.getByRole('tab', { name: /HMS/ })).getByLabelText('Members only')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Members/ }));
    const again = await screen.findByRole('dialog', { name: 'Who can open 1HMS' });
    expect(await within(again).findByRole('checkbox', { name: /Asha Rao/ })).toBeChecked();
    await user.click(within(again).getByText(/Access changes/));
    expect(within(again).getByText(/added Asha Rao/)).toBeInTheDocument();
    expect(within(again).getByText(/made the board members-only/)).toBeInTheDocument();
  });
});
