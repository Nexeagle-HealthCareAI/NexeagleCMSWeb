import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSupportStore } from '../store/useSupportStore';
import { visibleGroups, isItemActive, FOLDED_BY_DEFAULT, FOLDING_STARTS_AT } from './nav/navConfig';
import { useBadgeCounts } from './nav/navHelpers';
import UserAvatar from './UserAvatar';
import './Sidebar.css';

/** Which groups this person folded or unfolded themselves; everything else follows the defaults. */
const FOLDS_KEY = 'ne.nav.folds';
function readFolds(): Record<string, boolean> {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(FOLDS_KEY) || '{}');
        return saved && typeof saved === 'object' ? (saved as Record<string, boolean>) : {};
    } catch {
        return {};
    }
}

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

/**
 * Side menu grouped by job. Collapses to a column of icons (the choice is
 * remembered per person by Layout); waiting counts become a dot when collapsed.
 */
const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const logout = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);
    const permissions = useAuthStore((s) => s.permissions) || [];
    const resetUnread = useSupportStore((s) => s.resetUnread);
    const badges = useBadgeCounts();
    const groups = visibleGroups(permissions);

    // Groups fold to keep the menu to one screen. Not in the narrow icon-only menu, and not for
    // someone whose whole menu is a handful of pages.
    const [folds, setFolds] = useState(readFolds);
    const canFold = !collapsed && groups.reduce((n, g) => n + g.items.length, 0) >= FOLDING_STARTS_AT;
    const isFolded = (key: string) => folds[key] ?? FOLDED_BY_DEFAULT.includes(key);
    const toggleFold = (key: string) => {
        const next = { ...folds, [key]: !isFolded(key) };
        setFolds(next);
        try { localStorage.setItem(FOLDS_KEY, JSON.stringify(next)); } catch { /* private mode: lasts for this visit */ }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className={`ne-side ${collapsed ? 'is-collapsed' : ''}`} aria-label="Main menu">
            <div className="ne-side-head">
                <img src="/Logo.png" alt="" className="ne-side-logo" />
                {!collapsed && (
                    <span className="ne-side-brand">
                        <strong>NexEagle</strong>
                        <span>Control centre</span>
                    </span>
                )}
                <button
                    type="button"
                    className="ne-side-toggle"
                    onClick={onToggle}
                    aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
                    aria-expanded={!collapsed}
                    title={collapsed ? 'Expand menu  [' : 'Collapse menu  ['}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            <nav className="ne-side-nav">
                {groups.map(g => {
                    const foldable = canFold && !!g.label;
                    const hasCurrent = g.items.some(i => isItemActive(i, pathname));
                    // The group of the page on screen is always open, whatever was folded.
                    const open = !foldable || hasCurrent || !isFolded(g.key);
                    const waiting = g.items.reduce((n, i) => n + (i.badge ? badges[i.badge] : 0), 0);
                    return (
                    <div className="ne-side-group" key={g.key}>
                        {g.label && (collapsed
                            ? <span className="ne-side-rule" aria-hidden="true" />
                            : foldable
                                ? (
                                    <button
                                        type="button"
                                        className={`ne-side-label is-button ${open ? 'is-open' : ''}`}
                                        aria-expanded={open}
                                        aria-controls={`ne-side-group-${g.key}`}
                                        onClick={() => toggleFold(g.key)}
                                        // Folding the group of the current page would hide where you are.
                                        disabled={hasCurrent}
                                    >
                                        <span>{g.label}</span>
                                        {!open && waiting > 0 && <span className="ne-side-count" aria-label={`${waiting} waiting`}>{waiting > 99 ? '99+' : waiting}</span>}
                                        <ChevronDown size={14} aria-hidden="true" className="ne-side-chevron" />
                                    </button>
                                )
                                : <span className="ne-side-label">{g.label}</span>)}
                        <div id={`ne-side-group-${g.key}`} className="ne-side-items" hidden={!open}>
                        {g.items.map(item => {
                            const Icon = item.icon;
                            const count = item.badge ? badges[item.badge] : 0;
                            const active = isItemActive(item, pathname);
                            return (
                                <NavLink
                                    key={item.key}
                                    to={item.to}
                                    end
                                    className={`ne-side-item ${active ? 'is-active' : ''}`}
                                    aria-current={active ? 'page' : undefined}
                                    aria-label={count ? `${item.label}, ${count} waiting` : item.label}
                                    title={collapsed ? (count ? `${item.label} · ${count}` : item.label) : undefined}
                                    onClick={item.key === 'chat' ? resetUnread : undefined}
                                >
                                    <span className="ne-side-icon">
                                        <Icon size={19} strokeWidth={2} aria-hidden="true" />
                                        {collapsed && count > 0 && <span className="ne-side-dot" aria-hidden="true" />}
                                    </span>
                                    {!collapsed && <span className="ne-side-text">{item.label}</span>}
                                    {!collapsed && count > 0 && <span className="ne-side-count">{count > 99 ? '99+' : count}</span>}
                                </NavLink>
                            );
                        })}
                        </div>
                    </div>
                    );
                })}
            </nav>

            <div className="ne-side-foot">
                <NavLink to="/profile" className="ne-side-me" aria-label={`My profile: ${user?.name || 'you'}`} title={collapsed ? `${user?.name || ''} · My profile` : 'My profile'}>
                    <UserAvatar userId={user?.id} name={user?.name} photoVersion={user?.photoVersion} size={32} className="ne-side-avatar" />
                    {!collapsed && (
                        <span className="ne-side-who">
                            <span className="ne-side-name">{user?.name || 'Signed in'}</span>
                            <span className="ne-side-role">{user?.jobTitle || user?.role || ''}</span>
                        </span>
                    )}
                </NavLink>
                <button type="button" className="ne-side-out" onClick={handleLogout} aria-label="Sign out" title="Sign out">
                    <LogOut size={17} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
