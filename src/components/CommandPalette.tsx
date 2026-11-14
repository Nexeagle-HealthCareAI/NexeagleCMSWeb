import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, ScanLine, Zap, CornerDownLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { allItems } from './nav/navConfig';
import { getHospitals } from '../features/dashboard/services/hospitalService';
import { getRadHospitals } from '../features/radCenters/services/radHospitalsService';
import './CommandPalette.css';

interface Hit {
    id: string;
    group: 'Customers' | 'Pages' | 'Actions';
    title: string;
    sub: string;
    to: string;
    icon: LucideIcon;
    tone: 'blue' | 'violet' | 'grey' | 'amber';
}

interface Customer { id: string; name: string; sub: string; to: string; kind: '1hms' | '1rad' }

// Loaded once per session the first time the palette opens; small lists (one row per customer).
// Keyed by the user's permissions so a different sign-in never sees another user's list.
let customerCache: Customer[] | null = null;
let customerLoad: Promise<Customer[]> | null = null;
let cacheKey = '';
const loadCustomers = (perms: string[]): Promise<Customer[]> => {
    const key = perms.join('|');
    if (key !== cacheKey) { cacheKey = key; customerCache = null; customerLoad = null; }
    if (customerCache) return Promise.resolve(customerCache);
    if (customerLoad) return customerLoad;
    const jobs: Promise<Customer[]>[] = [];
    if (perms.includes('onboarded-hospitals.view')) {
        jobs.push(getHospitals(1, 500).then(r => (r.data || []).map(h => ({
            id: h.id, kind: '1hms' as const, name: h.name,
            sub: ['1HMS', h.city, h.subscriptionPlanName || h.subscriptionStatus].filter(Boolean).join(' · '),
            to: `/hospital/${h.id}`,
        }))).catch(() => []));
    }
    if (perms.includes('dashboard.view')) {
        jobs.push(getRadHospitals().then(list => (list || []).map(h => ({
            id: h.hospitalId, kind: '1rad' as const, name: h.hospitalName,
            sub: ['1Rad', h.hospitalAddress, h.subscriptionStatus].filter(Boolean).join(' · '),
            to: `/rad-centers/${h.hospitalId}`,
        }))).catch(() => []));
    }
    customerLoad = Promise.all(jobs).then(parts => (customerCache = parts.flat()));
    return customerLoad;
};

const ACTIONS: { title: string; sub: string; to: string; allowed: (p: string[]) => boolean }[] = [
    { title: 'Approve payments', sub: 'Open the waiting payments', to: '/approvals', allowed: p => p.includes('subscriptions.view') },
    { title: 'Start a data import', sub: 'Upload a hospital\'s Excel or CSV file', to: '/data-migration/new', allowed: p => p.includes('data-migration.manage') },
    { title: 'Write a Health Wiki article', sub: 'Opens a new draft', to: '/health-wiki/new', allowed: p => p.includes('health-wiki.manage') },
    { title: 'Add a user or role', sub: 'Users & access', to: '/users', allowed: p => p.includes('user-management.view') },
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ');

/** Ctrl K: find a customer, open any page, or start a common job. */
const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const navigate = useNavigate();
    const rawPerms = useAuthStore((s) => s.permissions);
    const permissions = React.useMemo(() => rawPerms || [], [rawPerms]);
    const [query, setQuery] = React.useState('');
    const [active, setActive] = React.useState(0);
    const [customers, setCustomers] = React.useState<Customer[]>([]);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const restoreRef = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
        if (!open) return;
        restoreRef.current = document.activeElement as HTMLElement | null;
        const id = window.setTimeout(() => inputRef.current?.focus(), 0);
        let alive = true;
        loadCustomers(permissions).then(c => { if (alive) setCustomers(c); });
        return () => {
            alive = false;
            window.clearTimeout(id);
            restoreRef.current?.focus?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const hits = React.useMemo<Hit[]>(() => {
        const raw = query.trim();
        const actionsOnly = raw.startsWith('>');
        const q = norm(raw.replace(/^>\s*/, '')).trim();
        const words = q.split(/\s+/).filter(Boolean);
        const matches = (text: string) => words.every(w => norm(text).includes(w));
        const out: Hit[] = [];
        if (!actionsOnly && words.length) {
            customers.filter(c => matches(`${c.name} ${c.sub}`)).slice(0, 6).forEach(c => out.push({
                id: `c-${c.kind}-${c.id}`, group: 'Customers', title: c.name, sub: c.sub, to: c.to,
                icon: c.kind === '1rad' ? ScanLine : Building2, tone: c.kind === '1rad' ? 'violet' : 'blue',
            }));
        }
        if (!actionsOnly) {
            allItems(permissions)
                .filter(i => !words.length || matches(`${i.label} ${i.keywords || ''}`))
                .slice(0, words.length ? 6 : 8)
                .forEach(i => out.push({ id: `p-${i.key}`, group: 'Pages', title: i.label, sub: i.to === '/' ? 'Home' : 'Page', to: i.to, icon: i.icon, tone: 'grey' }));
        }
        ACTIONS.filter(a => a.allowed(permissions) && (!words.length || matches(`${a.title} ${a.sub}`)))
            .forEach(a => out.push({ id: `a-${a.to}`, group: 'Actions', title: a.title, sub: a.sub, to: a.to, icon: Zap, tone: 'amber' }));
        return out;
    }, [query, customers, permissions]);

    const safeActive = hits.length ? Math.min(active, hits.length - 1) : 0;

    React.useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-idx="${safeActive}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [safeActive]);

    if (!open) return null;

    const go = (h: Hit | undefined) => {
        if (!h) return;
        onClose();
        setQuery('');
        setActive(0);
        navigate(h.to);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(safeActive + 1, hits.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(safeActive - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); go(hits[safeActive]); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    let lastGroup = '';
    return (
        <div className="ne-pal-backdrop" onMouseDown={onClose}>
            <div className="ne-pal" role="dialog" aria-modal="true" aria-label="Search and jump" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
                <label className="ne-pal-input">
                    <Search size={20} aria-hidden="true" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                        placeholder="Type a customer, page or action"
                        aria-label="Search"
                        aria-controls="ne-pal-list"
                        aria-activedescendant={hits[safeActive] ? `ne-pal-${hits[safeActive].id}` : undefined}
                        role="combobox"
                        aria-expanded="true"
                        autoComplete="off"
                    />
                    <kbd>Esc</kbd>
                </label>
                <div className="ne-pal-list" id="ne-pal-list" role="listbox" ref={listRef}>
                    {hits.length === 0 && (
                        <p className="ne-pal-empty">Nothing matches “{query}”. Try a town, a plan or a page name.</p>
                    )}
                    {hits.map((h, idx) => {
                        const head = h.group !== lastGroup ? h.group : null;
                        lastGroup = h.group;
                        const Icon = h.icon;
                        return (
                            <React.Fragment key={h.id}>
                                {head && <div className="ne-pal-group" role="presentation">{head}</div>}
                                <div
                                    id={`ne-pal-${h.id}`}
                                    role="option"
                                    aria-selected={idx === safeActive}
                                    data-idx={idx}
                                    className={`ne-pal-hit ${idx === safeActive ? 'is-active' : ''}`}
                                    onMouseMove={() => { if (idx !== safeActive) setActive(idx); }}
                                    onClick={() => go(h)}
                                >
                                    <span className={`ne-pal-ico tone-${h.tone}`}><Icon size={16} aria-hidden="true" /></span>
                                    <span className="ne-pal-text"><span className="ne-pal-title">{h.title}</span><span className="ne-pal-sub">{h.sub}</span></span>
                                    {idx === safeActive && <CornerDownLeft size={15} className="ne-pal-enter" aria-hidden="true" />}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="ne-pal-foot">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
                    <span><kbd>Enter</kbd> open</span>
                    <span>Start with <strong>&gt;</strong> for actions only</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
