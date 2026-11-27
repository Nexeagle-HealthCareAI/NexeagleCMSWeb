import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/useAuthStore';
import { allItems, NAV_GROUPS } from './nav/navConfig';

const EVERYTHING = [
  'work.view', 'onboarded-hospitals.view', 'dashboard.view', 'subscriptions.view', 'marketing.view', 'live-support.view',
  'health-wiki.manage', 'emergency.manage', 'vita.view', 'user-management.view', 'data-migration.manage', 'settings.view', 'partners.manage', 'whatsapp.view', 'social.view',
];
const open = (path = '/') =>
  render(<MemoryRouter initialEntries={[path]}><Sidebar collapsed={false} onToggle={() => undefined} /></MemoryRouter>);

describe('side menu', () => {
  beforeEach(() => { localStorage.clear(); useAuthStore.setState({ permissions: EVERYTHING }); });

  it('no longer has Partners, Leads & CRM or Referral codes, anywhere', () => {
    const labels = allItems(EVERYTHING).map(i => i.label).join(' | ');
    expect(labels).not.toMatch(/Partner|Lead|CRM|Social posts|Referral/i);
    for (const to of ['/partners', '/leads', '/referral-codes']) expect(allItems(EVERYTHING).map(i => i.to)).not.toContain(to);
  });

  it('has Social (Facebook and Instagram) under Marketing, for people with social.view', () => {
    const marketing = NAV_GROUPS.find(g => g.key === 'marketing')!;
    expect(marketing.items.map(i => i.label)).toEqual(['WhatsApp', 'Social']);
    expect(allItems(EVERYTHING).find(i => i.key === 'social')?.to).toBe('/social');
    expect(allItems(EVERYTHING.filter(p => p !== 'social.view')).some(i => i.key === 'social')).toBe(false);
  });

  it('groups pages by the job they do', () => {
    expect(NAV_GROUPS.map(g => g.label)).toEqual(['', 'Customers', 'Billing', 'Marketing', 'Support', 'Reports', 'Content', 'AI agents', 'Admin']);
    open();
    for (const name of ['Customers', 'Billing', 'Marketing', 'Support', 'Reports', 'Content', 'AI agents', 'Admin']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('starts with the less used groups folded, and unfolds one on a click', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('link', { name: /Payment approvals/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Users & access' })).not.toBeInTheDocument();

    const admin = screen.getByRole('button', { name: 'Admin' });
    expect(admin).toHaveAttribute('aria-expanded', 'false');
    await user.click(admin);

    expect(admin).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Users & access' })).toBeVisible();
  });

  it('remembers what was folded', async () => {
    const user = userEvent.setup();
    const first = open();
    await user.click(screen.getByRole('button', { name: 'Billing' }));
    expect(screen.queryByRole('link', { name: /Payment approvals/ })).not.toBeInTheDocument();
    first.unmount();

    open();
    expect(screen.getByRole('button', { name: 'Billing' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('always shows the group of the page you are on', () => {
    open('/users');
    const admin = screen.getByRole('button', { name: 'Admin' });
    expect(admin).toHaveAttribute('aria-expanded', 'true');
    expect(admin).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Users & access' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not fold anything for someone with only a few pages', () => {
    useAuthStore.setState({ permissions: ['health-wiki.manage'] });
    open();
    expect(screen.queryByRole('button', { name: 'Content' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Health Wiki/ })).toBeVisible();
  });

  it('shows every page as an icon in the narrow menu', () => {
    render(<MemoryRouter><Sidebar collapsed onToggle={() => undefined} /></MemoryRouter>);
    const menu = screen.getByRole('navigation');
    expect(within(menu).getAllByRole('link')).toHaveLength(allItems(EVERYTHING).filter(i => !i.searchOnly).length);
  });
});

describe('my profile', () => {
  it('opens from my name at the foot of the menu, for everyone, and is found by search', () => {
    render(<MemoryRouter><Sidebar collapsed={false} onToggle={() => undefined} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /^My profile/ })).toHaveAttribute('href', '/profile');
    expect(allItems([]).map(i => i.to)).toContain('/profile');
    expect(within(screen.getByRole('navigation')).queryByRole('link', { name: /My profile/ })).not.toBeInTheDocument();
  });
});
