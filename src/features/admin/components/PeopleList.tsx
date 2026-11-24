import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import UserAvatar from '../../../components/UserAvatar';
import type { RoleDto, UserSummary } from '../services/adminService';
import { whenText } from '../accessAreas';

interface Props {
    users: UserSummary[];
    roles: RoleDto[];
    selectedId?: string | null;
    onOpen: (userId: string) => void;
}

const NO_ROLE = '__none';

/** Everyone who can sign in to the CMS, with search and filters. */
export default function PeopleList({ users, roles, selectedId, onOpen }: Props) {
    const [query, setQuery] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState<'all' | 'active' | 'off'>('all');

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users
            .filter(u => !q || [u.fullName, u.email, u.phoneNumber ?? '', u.jobTitle ?? ''].some(v => v.toLowerCase().includes(q)))
            .filter(u => !role || (role === NO_ROLE ? u.roles.length === 0 : u.roles.includes(role)))
            .filter(u => status === 'all' || (status === 'active') === u.isActive)
            .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));
    }, [users, query, role, status]);

    const activeRoles = roles.filter(r => r.isActive);
    const off = users.filter(u => !u.isActive).length;

    return (
        <section className="ua-people" aria-label="People">
            <div className="ua-filters">
                <label className="ua-search">
                    <Search size={16} aria-hidden="true" />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email, phone or job title" aria-label="Search people" />
                </label>
                <select value={role} onChange={e => setRole(e.target.value)} aria-label="Filter by role">
                    <option value="">All roles</option>
                    {activeRoles.map(r => <option key={r.roleId} value={r.name}>{r.name}</option>)}
                    <option value={NO_ROLE}>No role</option>
                </select>
                <select value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
                    <option value="all">Everyone ({users.length})</option>
                    <option value="active">Can sign in ({users.length - off})</option>
                    <option value="off">Switched off ({off})</option>
                </select>
            </div>

            {shown.length === 0 ? (
                <p className="ua-empty">{users.length === 0 ? 'Nobody has been added yet.' : 'Nobody matches. Try another search or filter.'}</p>
            ) : (
                <table className="ua-table">
                    <thead>
                        <tr><th scope="col">Person</th><th scope="col">Contact</th><th scope="col">Roles</th><th scope="col">Last signed in</th><th scope="col">Status</th></tr>
                    </thead>
                    <tbody>
                        {shown.map(u => (
                            <tr key={u.userId} className={`${u.userId === selectedId ? 'is-open' : ''} ${u.isActive ? '' : 'is-off'}`} onClick={() => onOpen(u.userId)}>
                                <td data-label="Person">
                                    <div className="ua-person">
                                        <UserAvatar userId={u.userId} name={u.fullName} photoVersion={u.photoVersion} size={36} />
                                        <span>
                                            <button type="button" className="ua-name" onClick={e => { e.stopPropagation(); onOpen(u.userId); }}>{u.fullName}</button>
                                            {u.jobTitle && <span className="ua-sub">{u.jobTitle}</span>}
                                        </span>
                                    </div>
                                </td>
                                <td data-label="Contact">
                                    <span className="ua-contact">{u.email}</span>
                                    {u.phoneNumber && <span className="ua-sub">{u.phoneNumber}</span>}
                                </td>
                                <td data-label="Roles">
                                    {u.roles.length > 0
                                        ? <span className="ua-chips">{u.roles.map(r => <span key={r} className="pf-chip">{r}</span>)}</span>
                                        : <span className="ua-sub">No role</span>}
                                </td>
                                <td data-label="Last signed in">{whenText(u.lastLoginAt)}</td>
                                <td data-label="Status">
                                    <span className={`ua-status ${u.isActive ? 'is-on' : 'is-off'}`}>{u.isActive ? (u.mustChangePassword ? 'New password due' : 'Can sign in') : 'Switched off'}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
