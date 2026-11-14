import type { LucideIcon } from 'lucide-react';
import {
    Home, Building2, ScanLine, Stethoscope, Handshake, CreditCard, Tag, Gift, Filter, Share2, KeyRound,
    BarChart3, TrendingUp, MessageSquare, History, BookOpen, Siren, Bot, Route, FlaskConical, UploadCloud, Moon, Users, Settings,
} from 'lucide-react';
import { canUseHealthWiki } from '../../features/healthWiki/access';

/**
 * The CMS menu, grouped by job. One list drives the side menu, the phone menu
 * sheet and the Ctrl K search, so a page is added in exactly one place.
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
}

export interface NavGroup {
    key: string;
    label: string;
    items: NavItem[];
}

const has = (p: string) => (perms: string[]) => perms.includes(p);
const anyone = () => true;

export const NAV_GROUPS: NavGroup[] = [
    {
        key: 'today', label: '', items: [
            { key: 'today', label: 'Today', to: '/', icon: Home, allowed: anyone, badge: 'today', keywords: 'home dashboard overview' },
        ],
    },
    {
        key: 'customers', label: 'Customers', items: [
            { key: 'hospitals', label: 'Hospitals · 1HMS', short: 'Hospitals', to: '/onboarded-hospitals', icon: Building2, allowed: has('onboarded-hospitals.view'), keywords: 'onboarded hospitals easyhms customers', alsoActive: ['/hospital/'] },
            { key: 'centres', label: 'Diagnostic centres · 1Rad', short: 'Centres', to: '/rad-centers', icon: ScanLine, allowed: has('dashboard.view'), keywords: '1rad radiology centers centres' },
            { key: 'doctors', label: 'Doctors · Doctor Dekho', short: 'Doctors', to: '/doctors', icon: Stethoscope, allowed: anyone, keywords: 'doctor dekho listing featured' },
            { key: 'partners', label: 'Partners', to: '/partners', icon: Handshake, allowed: has('partners.manage'), keywords: 'partner network channel' },
        ],
    },
    {
        key: 'money', label: 'Money', items: [
            { key: 'approvals', label: 'Payment approvals', short: 'Approvals', to: '/approvals', icon: CreditCard, allowed: has('subscriptions.view'), badge: 'approvals', keywords: 'subscription payments verify approve', alsoActive: ['/subscriptions'] },
            { key: 'plans', label: 'Plans & prices', short: 'Plans', to: '/plans', icon: Tag, allowed: has('subscriptions.view'), keywords: 'subscription plans pricing manage plans' },
            { key: 'referral', label: 'Referral codes', short: 'Referral codes', to: '/referral-codes', icon: Gift, allowed: has('subscriptions.view'), keywords: 'discount coupon' },
        ],
    },
    {
        key: 'growth', label: 'Growth', items: [
            { key: 'leads', label: 'Leads & CRM', short: 'Leads', to: '/leads', icon: Filter, allowed: has('marketing.view'), keywords: 'marketing pipeline crm sales roi analytics', alsoActive: ['/marketing'] },
            { key: 'social', label: 'Social posts', short: 'Social', to: '/social', icon: Share2, allowed: has('marketing.view'), keywords: 'marketing social pilot campaigns' },
            { key: 'demo', label: 'Demo logins', short: 'Demo logins', to: '/demo-logins', icon: KeyRound, allowed: has('marketing.view'), keywords: 'marketing qr demo' },
            { key: 'growth', label: 'Platform growth', short: 'Growth', to: '/growth', icon: TrendingUp, allowed: has('dashboard.view'), keywords: 'dashboard charts hospitals doctors patients users onboarded totals' },
            { key: 'insights', label: 'Patient app insights', short: 'Insights', to: '/insights', icon: BarChart3, allowed: anyone, keywords: 'doctor dekho site visits logins funnel searches appointments' },
        ],
    },
    {
        key: 'support', label: 'Support', items: [
            { key: 'chat', label: 'Live chat', short: 'Chat', to: '/support', icon: MessageSquare, allowed: has('live-support.view'), badge: 'chat', keywords: 'live support help' },
            { key: 'history', label: 'Chat history', short: 'History', to: '/support/history', icon: History, allowed: has('live-support.view'), keywords: 'support transcripts' },
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
            { key: 'migration', label: 'Data migration', short: 'Migration', to: '/data-migration', icon: UploadCloud, allowed: has('data-migration.manage'), keywords: 'import upload excel' },
            { key: 'freetier', label: 'Free tier & night jobs', short: 'Free tier', to: '/free-tier', icon: Moon, allowed: has('onboarded-hospitals.view'), keywords: 'operations limits night jobs' },
            { key: 'users', label: 'Users & access', short: 'Users', to: '/users', icon: Users, allowed: has('user-management.view'), keywords: 'roles permissions staff' },
            { key: 'settings', label: 'Settings', to: '/settings', icon: Settings, allowed: has('settings.view'), keywords: 'profile account' },
        ],
    },
];

export const visibleGroups = (perms: string[]): NavGroup[] =>
    NAV_GROUPS
        .map(g => ({ ...g, items: g.items.filter(i => i.allowed(perms)) }))
        .filter(g => g.items.length > 0);

export const allItems = (perms: string[]): NavItem[] => visibleGroups(perms).flatMap(g => g.items.map(i => ({ ...i })));

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
