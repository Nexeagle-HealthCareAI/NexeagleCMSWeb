import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw, LogOut, Download, X, Search, Menu as MenuIcon, Home, Building2, CreditCard, MessageSquare } from 'lucide-react';
import Sidebar from './Sidebar';
import { useBadgeCounts, initialsOf } from './nav/navHelpers';
import CommandPalette from './CommandPalette';
import { visibleGroups, isItemActive, groupOfPath, allItems } from './nav/navConfig';
import { useSupportStore } from '../store/useSupportStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCountsStore } from '../store/useCountsStore';
import { Toaster, toast } from 'sonner';
import { syncManager } from '../utils/syncManager';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { CRM_HUB_URL } from '../services/api';
import type { SalesLeadDetail } from '../features/marketing/services/salesLeadService';
import './Layout.css';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

const PHONE_MAX = 768;      // below this: phone header + bottom tabs, no side menu
const NARROW_MAX = 1100;    // below this the side menu starts folded to icons
const MENU_PREF_KEY = 'ne_menu_pref';

const readMenuPref = (): 'collapsed' | 'expanded' | null => {
    try {
        const v = localStorage.getItem(MENU_PREF_KEY);
        return v === 'collapsed' || v === 'expanded' ? v : null;
    } catch { return null; }
};

const isTyping = (el: EventTarget | null) => {
    const t = el as HTMLElement | null;
    return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
};

const Layout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);
    const permissions = useAuthStore((s) => s.permissions) || [];
    const [width, setWidth] = useState(window.innerWidth);
    const [menuPref, setMenuPref] = useState(readMenuPref);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(() => syncManager.getQueue().length);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing'>('idle');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [isProfileOpen, setProfileOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const badges = useBadgeCounts();

    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const isStandalone = React.useMemo(() => window.matchMedia('(display-mode: standalone)').matches, []);

    const isPhone = width <= PHONE_MAX;
    const collapsed = menuPref ? menuPref === 'collapsed' : width <= NARROW_MAX;

    const toggleMenu = useCallback(() => {
        const next = collapsed ? 'expanded' : 'collapsed';
        setMenuPref(next);
        try { localStorage.setItem(MENU_PREF_KEY, next); } catch { /* private window */ }
    }, [collapsed]);

    // Close the profile dropdown on any outside click.
    useEffect(() => {
        if (!isProfileOpen) return;
        const close = () => setProfileOpen(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isProfileOpen]);

    // Ctrl/Cmd+K opens search anywhere; "[" folds the side menu when not typing.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(true);
            } else if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && !isPhone) {
                toggleMenu();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleMenu, isPhone]);

    // PWA install prompt.
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowInstallPrompt(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        // Replaying the offline queue is owned by syncManager's own 'online' listener; calling
        // sync() here too used to replay every queued mutation twice on a slow reconnect.
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        const handleQueueUpdate = (e: Event) => setPendingCount((e as CustomEvent).detail.count);
        const handleSyncStatus = (e: Event) => setSyncStatus((e as CustomEvent).detail.status);

        window.addEventListener('resize', handleResize);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('sync-queue-updated', handleQueueUpdate);
        window.addEventListener('sync-status', handleSyncStatus);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('sync-queue-updated', handleQueueUpdate);
            window.removeEventListener('sync-status', handleSyncStatus);
        };
    }, []);

    // Live support: only agents (live-support.view) connect; the hub refuses everyone else. The
    // connection is closed again on logout or if the permission is removed.
    const initSupport = useSupportStore(state => state.initConnection);
    const stopSupport = useSupportStore(state => state.disconnect);
    const resetUnread = useSupportStore(state => state.resetUnread);
    const isSupportAgent = permissions.includes('live-support.view');
    useEffect(() => {
        if (!isSupportAgent) return;
        initSupport();
        return () => stopSupport();
    }, [isSupportAgent, initSupport, stopSupport]);

    // Waiting payment approvals for the menu badge: on load, then every minute.
    const canSeeMoney = permissions.includes('subscriptions.view');
    const refreshApprovals = useCountsStore(s => s.refreshApprovals);
    useEffect(() => {
        if (!canSeeMoney) return;
        void refreshApprovals();
        const id = window.setInterval(() => { void refreshApprovals(); }, 60_000);
        return () => window.clearInterval(id);
    }, [canSeeMoney, refreshApprovals]);

    // Refresh the current user's permissions on app load so route/menu gating stays current.
    useEffect(() => { void useAuthStore.getState().fetchMe(); }, []);

    // SignalR for CRM alerts. The hub requires a JWT with marketing.view (it pushes lead phone
    // numbers), so only connect for users who have it. Event names must match CrmHub.cs.
    const canSeeMarketing = permissions.includes('marketing.view');
    useEffect(() => {
        if (!canSeeMarketing) return;
        const playBeep = () => {
            try {
                const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                const ctx = new Ctx();
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } catch (e) {
                console.error('Audio beep failed', e);
            }
        };
        const connection = new HubConnectionBuilder()
            .withUrl(CRM_HUB_URL, { accessTokenFactory: () => useAuthStore.getState().token ?? '' })
            .configureLogging(LogLevel.Warning)
            .withAutomaticReconnect()
            .build();
        connection.on('crm-hot-lead-received', (lead: SalesLeadDetail) => {
            playBeep();
            toast.success(`Hot lead: ${lead.hospitalName} (${lead.aiIntentScore}/100)`, {
                description: `Phone: ${lead.mobile ?? '-'} | City: ${lead.city ?? '-'}`,
                duration: 10000,
            });
            window.dispatchEvent(new CustomEvent('crm-hot-lead-received', { detail: lead }));
        });
        connection.on('crm-inbound-whatsapp', (msg: { leadId: string; message: string }) => {
            window.dispatchEvent(new CustomEvent('crm-inbound-whatsapp', { detail: msg }));
        });
        connection.start().catch(err => console.error('SignalR CRM connection failed:', err));
        return () => { connection.stop(); };
    }, [canSeeMarketing]);

    const groups = visibleGroups(permissions);
    const items = allItems(permissions);
    const current = items.find(i => isItemActive(i, location.pathname));
    const currentGroup = groupOfPath(location.pathname, permissions);

    // Phone tab bar: Today, the first customer list, payments, chat — each only if allowed — then Menu.
    const firstCustomers = groups.find(g => g.key === 'customers')?.items[0];
    const tabs = [
        { key: 'today', label: 'Today', to: '/', icon: Home, count: badges.today, on: location.pathname === '/' },
        firstCustomers && { key: 'customers', label: 'Customers', to: firstCustomers.to, icon: Building2, count: 0, on: currentGroup === 'customers' },
        canSeeMoney && { key: 'money', label: 'Money', to: '/approvals', icon: CreditCard, count: badges.approvals, on: currentGroup === 'money' },
        isSupportAgent && { key: 'chat', label: 'Chat', to: '/support', icon: MessageSquare, count: badges.chat, on: currentGroup === 'support' },
    ].filter(Boolean) as { key: string; label: string; to: string; icon: typeof Home; count: number; on: boolean }[];
    const menuTabOn = sheetOpen || (!tabs.some(t => t.on));

    return (
        <div className={`app-layout ${isPhone ? 'is-phone' : ''}`}>
            <Toaster position="top-right" richColors />
            {!isPhone && <Sidebar collapsed={collapsed} onToggle={toggleMenu} />}

            <div className="content-wrapper">
                {!isPhone ? (
                    <header className="ne-topbar">
                        <button type="button" className="ne-search" onClick={() => setPaletteOpen(true)} aria-label="Search or jump to anything (Ctrl K)">
                            <Search size={18} aria-hidden="true" />
                            <span className="ne-search-text">Search or jump to anything</span>
                            <kbd>Ctrl K</kbd>
                        </button>
                    </header>
                ) : (
                    <header className="ne-phonebar">
                        <img src="/Logo.png" alt="NexEagle" className="ne-phonebar-logo" />
                        <span className="ne-phonebar-title">{current?.label || 'NexEagle'}</span>
                        <button type="button" className="ne-iconbtn" onClick={() => setPaletteOpen(true)} aria-label="Search">
                            <Search size={18} />
                        </button>
                        <div className="ne-phonebar-profile" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="ne-avatarbtn" onClick={() => setProfileOpen(!isProfileOpen)} aria-label="Account" aria-expanded={isProfileOpen}>
                                {initialsOf(user?.name)}
                            </button>
                            {isProfileOpen && (
                                <div className="ne-profile-pop" role="menu">
                                    <div className="ne-profile-who">
                                        <strong>{user?.name || 'Signed in'}</strong>
                                        <span>{user?.email}</span>
                                        {user?.role && <span className="ne-profile-role">{user.role}</span>}
                                    </div>
                                    <button type="button" role="menuitem" className="ne-profile-out" onClick={() => { setProfileOpen(false); logout(); navigate('/login'); }}>
                                        <LogOut size={16} /> Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>
                )}

                {!isOnline && (
                    <div className="network-status-banner offline" role="status">
                        <WifiOff size={16} />
                        <span>Offline · {pendingCount > 0 ? `${pendingCount} changes will be sent when you are back online` : 'showing saved data'}</span>
                    </div>
                )}
                {isOnline && syncStatus === 'syncing' && (
                    <div className="network-status-banner syncing" role="status">
                        <RefreshCw size={16} className="spin" />
                        <span>Sending your saved changes…</span>
                    </div>
                )}

                <main className="main-content">
                    <Outlet />
                </main>

                {isPhone && showInstallPrompt && !isStandalone && (
                    <div className="pwa-install-banner">
                        <div className="pwa-install-info">
                            <div className="pwa-install-logo"><Download size={16} /></div>
                            <div className="pwa-install-text">
                                <h5>Add NexEagle CMS</h5>
                                <p>Install to your home screen for quick access</p>
                            </div>
                        </div>
                        <div className="pwa-install-actions">
                            <button className="pwa-install-btn" onClick={handleInstallClick}>Add</button>
                            <button className="pwa-close-btn" onClick={() => setShowInstallPrompt(false)} aria-label="Dismiss"><X size={16} /></button>
                        </div>
                    </div>
                )}

                {isPhone && sheetOpen && (
                    <div className="ne-sheet-backdrop" onClick={() => setSheetOpen(false)}>
                        <div className="ne-sheet" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
                            <div className="ne-sheet-handle" aria-hidden="true" />
                            <div className="ne-sheet-body">
                                {groups.map(g => (
                                    <section key={g.key} className="ne-sheet-group" aria-label={g.label || 'Home'}>
                                        {g.label && <h2>{g.label}</h2>}
                                        <div className="ne-sheet-grid">
                                            {g.items.map(item => {
                                                const Icon = item.icon;
                                                const count = item.badge ? badges[item.badge] : 0;
                                                return (
                                                    <Link key={item.key} to={item.to} className={`ne-sheet-item ${isItemActive(item, location.pathname) ? 'is-active' : ''}`}
                                                        onClick={() => { if (item.key === 'chat') resetUnread(); setSheetOpen(false); }}>
                                                        <Icon size={20} aria-hidden="true" />
                                                        <span>{item.short || item.label}</span>
                                                        {count > 0 && <span className="ne-sheet-count">{count}</span>}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {isPhone && (
                    <nav className="ne-tabs" aria-label="Main">
                        {tabs.map(t => {
                            const Icon = t.icon;
                            return (
                                <Link key={t.key} to={t.to} className={`ne-tab ${t.on && !sheetOpen ? 'is-on' : ''}`} aria-current={t.on ? 'page' : undefined}
                                    onClick={() => { if (t.key === 'chat') resetUnread(); setSheetOpen(false); }}>
                                    <span className="ne-tab-ico"><Icon size={21} aria-hidden="true" />{t.count > 0 && <span className="ne-tab-count">{t.count > 99 ? '99+' : t.count}</span>}</span>
                                    <span>{t.label}</span>
                                </Link>
                            );
                        })}
                        <button type="button" className={`ne-tab ${menuTabOn ? 'is-on' : ''}`} onClick={() => setSheetOpen(o => !o)} aria-expanded={sheetOpen}>
                            <span className="ne-tab-ico"><MenuIcon size={21} aria-hidden="true" /></span>
                            <span>Menu</span>
                        </button>
                    </nav>
                )}
            </div>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </div>
    );
};

export default Layout;
