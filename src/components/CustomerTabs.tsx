import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { visibleGroups } from './nav/navConfig';

/**
 * The tab strip on top of every Customers page (1HMS hospitals, 1Rad centres,
 * doctors, partners), so moving between products is one tap and the four lists
 * read as one place. Tabs follow the same permissions as the menu.
 */
const CustomerTabs: React.FC = () => {
    const permissions = useAuthStore(s => s.permissions) || [];
    const items = visibleGroups(permissions).find(g => g.key === 'customers')?.items || [];
    if (items.length < 2) return null;
    return (
        <nav className="ne-tabsbar" aria-label="Customers">
            {items.map(i => (
                <NavLink key={i.key} to={i.to} end className={({ isActive }) => `ne-tabsbar-item ${isActive ? 'is-on' : ''}`}>
                    {i.label}
                </NavLink>
            ))}
        </nav>
    );
};

export default CustomerTabs;
