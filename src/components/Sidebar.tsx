import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSupportStore } from '../store/useSupportStore';
import { visibleGroups, isItemActive } from './nav/navConfig';
import { useBadgeCounts, initialsOf } from './nav/navHelpers';
import './Sidebar.css';

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
                {groups.map(g => (
                    <div className="ne-side-group" key={g.key}>
                        {g.label && (collapsed
                            ? <span className="ne-side-rule" aria-hidden="true" />
                            : <span className="ne-side-label">{g.label}</span>)}
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
                ))}
            </nav>

            <div className="ne-side-foot">
                <span className="ne-side-avatar" title={collapsed ? `${user?.name || ''} · ${user?.role || ''}` : undefined}>{initialsOf(user?.name)}</span>
                {!collapsed && (
                    <span className="ne-side-who">
                        <span className="ne-side-name">{user?.name || 'Signed in'}</span>
                        <span className="ne-side-role">{user?.role || ''}</span>
                    </span>
                )}
                <button type="button" className="ne-side-out" onClick={handleLogout} aria-label="Sign out" title="Sign out">
                    <LogOut size={17} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
