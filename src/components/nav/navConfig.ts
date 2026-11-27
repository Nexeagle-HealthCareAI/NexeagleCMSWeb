import type { LucideIcon } from 'lucide-react';
import {
    Home, Building2, ScanLine, Stethoscope, CreditCard, Tag, KeyRound,
    BarChart3, TrendingUp, MessageSquare, History, BookOpen, Siren, Bot, Route, FlaskConical, UploadCloud, Moon, Users, UserCircle, ListChecks, MessageCircle, Share2,
} from 'lucide-react';
import { canUseHealthWiki } from '../../features/healthWiki/access';
import { canViewWork } from '../../features/work/access';
import { canViewWhatsApp } from '../../features/whatsapp/access';
import { canViewSocial } from '../../features/social/access';

/**
 * The CMS menu, grouped by job. One list drives the side menu, the phone menu
 * sheet and the Ctrl K search, so a page is added in exactly one place.
 *
 * Partners, Leads & CRM, the old Social posts page and Referral codes were taken out of the CMS in
 * November 2026: no menu item, and /partners, /leads and /referral-codes go to Today (see App.tsx). /social is now the Facebook and
 * Instagram section (Marketing → Social).
 *
 * `allowed` mirrors the route gates in App.tsx (RequirePermission) — the menu
 * only hides what the route would refuse anyway.
 */
export type BadgeKey = 'today' | 'approvals' | 'chat';

export interface NavItem {
    key: string;
    label: string;
    /** Shorter label for the collapsed menu tooltip and the phone tab bar. */
    short?: string;
    to: string;
    icon: LucideIcon;
    /** Extra words the search box should match ("subscription", "payments"). */
    keywords?: string;
    allowed: (perms: string[]) => boolean;
    badge?: BadgeKey;
    /** Paths that also count as "this page" (old URLs, detail pages). */
    alsoActive?: string[];
    /** Found by the Ctrl K search but not listed in the menu (My profile opens from the name at the foot of the menu). */
    searchOnly?: boolean;
}

export interface NavGroup {
    key: string;
    label: string;
    items: NavItem[];
}

const has = (p: string) => (perms: string[]) => perms.includes(p);
const anyone = () => true;

export const NAV_GROUPS: NavGroup[] = [
    // Groups follow the job being done, in the order they are used most. The keys 'customers',
    // 'money' and 'support' are also used by the phone tab bar (Layout) and CustomerTabs.
    {
        // Where the day starts: no heading, always in view.
        key: 'today', label: '', items: [
            { key: 'today', label: 'Today', to: '/', icon: Home, allowed: anyone, badge: 'today', keywords: 'home dashboard overview' },
            { key: 'work', label: 'Daily Work Board', short: 'Work', to: '/work', icon: ListChecks, allowed: canViewWork, keywords: 'team tasks epics stories bugs sprint backlog jira agile docs documents chat activity' },
        ],
    },
    {
        // Every item here is also a tab on top of the customer pages (CustomerTabs).
        key: 'customers', label: 'Customers', items: [
            { key: 'hospitals', label: 'Hospitals · 1HMS', short: 'Hospitals', to: '/onboarded-hospitals', icon: Building2, allowed: has('onboarded-hospitals.view'), keywords: 'onboarded hospitals easyhms customers', alsoActive: ['/hospital/'] },
            { key: 'centres', label: 'Diagnostic centres · 1Rad', short: 'Centres', to: '/rad-centers', icon: ScanLine, allowed: has('dashboard.view'), keywords: '1rad radiology centers centres' },
            { key: 'doctors', label: 'Doctors · Doctor Dekho', short: 'Doctors', to: '/doctors', icon: Stethoscope, allowed: anyone, keywords: 'doctor dekho listing featured' },
        ],
    },
    {
        key: 'money', label: 'Billing', items: [
            { key: 'approvals', label: 'Payment approvals', short: 'Approvals', to: '/approvals', icon: CreditCard, allowed: has('subscriptions.view'), badge: 'approvals', keywords: 'subscription payments verify approve money', alsoActive: ['/subscriptions'] },
            { key: 'plans', label: 'Plans & prices', short: 'Plans', to: '/plans', icon: Tag, allowed: has('subscriptions.view'), keywords: 'subscription plans pricing manage plans' },
        ],
    },
    {
        // The CMS's own WhatsApp marketing number (not the Doctor Dekho bot's), and the Facebook Page + Instagram.
        key: 'marketing', label: 'Marketing', items: [
            { key: 'whatsapp', label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle, allowed: canViewWhatsApp, keywords: 'whatsapp marketing broadcast templates inbox chats messages contacts opt-in campaign billing spend profile' },
            { key: 'social', label: 'Social', to: '/social', icon: Share2, allowed: canViewSocial, keywords: 'facebook instagram meta page posts reels stories schedule calendar comments messenger dm inbox lead ads cost per lead' },
        ],
    },
    {
        key: 'support', label: 'Support', items: [
            { key: 'chat', label: 'Live chat', short: 'Chat', to: '/support', icon: MessageSquare, allowed: has('live-support.view'), badge: 'chat', keywords: 'live support help' },
            { key: 'history', label: 'Chat history', short: 'History', to: '/support/history', icon: History, allowed: has('live-support.view'), keywords: 'support transcripts' },
        ],
    },
    {
        key: 'reports', label: 'Reports', items: [
            { key: 'growth', label: 'Platform growth', short: 'Growth', to: '/growth', icon: TrendingUp, allowed: has('dashboard.view'), keywords: 'dashboard charts hospitals doctors patients users onboarded totals analytics' },
            { key: 'insights', label: 'Patient app insights', short: 'Insights', to: '/insights', icon: BarChart3, allowed: anyone, keywords: 'doctor dekho site visits logins funnel searches appointments analytics' },
            { key: 'demo', label: 'Demo logins', short: 'Demo logins', to: '/demo-logins', icon: KeyRound, allowed: has('marketing.view'), keywords: 'marketing qr demo', alsoActive: ['/marketing'] },
        ],
    },
    {
        key: 'content', label: 'Content', items: [
            { key: 'wiki', label: 'Health Wiki', to: '/health-wiki', icon: BookOpen, allowed: canUseHealthWiki, keywords: 'articles topics contributors' },
            { key: 'emergency', label: 'Emergency places', short: 'Emergency', to: '/emergency', icon: Siren, allowed: has('emergency.manage'), keywords: 'ambulance emergency takeover' },
        ],
    },
    {
        key: 'ai', label: 'AI agents', items: [
            { key: 'vita', label: 'Vita · 1HMS assistant', short: 'Vita', to: '/vita-agents', icon: Bot, allowed: has('dashboard.view'), keywords: 'vita agents assistant conversations knowledge jev' },
            { key: 'router', label: 'Symptom router', short: 'Router', to: '/symptom-router', icon: Route, allowed: anyone, keywords: 'nlp router agents models decisions' },
            { key: 'test', label: 'Test agent', to: '/vita', icon: FlaskConical, allowed: has('vita.view'), keywords: 'vita test agent runs cases coverage' },
        ],
    },
    {
        key: 'admin', label: 'Admin', items: [
            { key: 'users', label: 'Users & access', short: 'Users', to: '/users', icon: Users, allowed: has('user-management.view'), keywords: 'roles permissions staff' },
            { key: 'migration', label: 'Data migration', short: 'Migration', to: '/data-migration', icon: UploadCloud, allowed: has('data-migration.manage'), keywords: 'import upload excel' },
            { key: 'freetier', label: 'Free tier & night jobs', short: 'Free tier', to: '/free-tier', icon: Moon, allowed: has('onboarded-hospitals.view'), keywords: 'operations limits night jobs' },
            { key: 'profile', label: 'My profile', short: 'Profile', to: '/profile', icon: UserCircle, allowed: anyone, searchOnly: true, alsoActive: ['/settings'], keywords: 'settings account photo picture phone password' },
        ],
    },
];

/**
 * Groups that start folded in the side menu, to keep it to one screen. A group is always open
 * while one of its pages is on screen, and people can fold or unfold any group themselves.
 */
export const FOLDED_BY_DEFAULT = ['reports', 'content', 'ai', 'admin'];
/** With this few pages in someone's menu there is nothing to fold. */
export const FOLDING_STARTS_AT = 9;

const allowedGroups = (perms: string[]): NavGroup[] =>
    NAV_GROUPS
        .map(g => ({ ...g, items: g.items.filter(i => i.allowed(perms)) }))
        .filter(g => g.items.length > 0);

/** The menu: groups with the pages this person may open (search-only pages left out). */
export const visibleGroups = (perms: string[]): NavGroup[] =>
    allowedGroups(perms)
        .map(g => ({ ...g, items: g.items.filter(i => !i.searchOnly) }))
        .filter(g => g.items.length > 0);

/** Every page this person may open, for the search. */
export const allItems = (perms: string[]): NavItem[] => allowedGroups(perms).flatMap(g => g.items.map(i => ({ ...i })));

/** Is this menu item the page we are on? Today matches only "/". */
export const isItemActive = (item: NavItem, pathname: string): boolean => {
    if (item.to === '/') return pathname === '/';
    if (pathname === item.to) return true;
    if (item.to !== '/support' && pathname.startsWith(item.to + '/')) return true;
    return (item.alsoActive || []).some(p => pathname === p || pathname.startsWith(p));
};

/** Which group a path belongs to (for the phone tab bar). */
export const groupOfPath = (pathname: string, perms: string[]): string | null => {
    for (const g of visibleGroups(perms)) if (g.items.some(i => isItemActive(i, pathname))) return g.key;
    return null;
};
