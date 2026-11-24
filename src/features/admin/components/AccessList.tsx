import { useMemo, useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import type { PermissionDto, RoleDto } from '../services/adminService';
import { areasOf, effectiveAccess, type Exception, type Grant } from '../accessAreas';

interface Props {
    catalog: PermissionDto[];
    roles: RoleDto[];
    roleIds: Set<string>;
    exceptions: Record<string, Exception>;
    onException: (key: string, value: Exception | null) => void;
    readOnly?: boolean;
}

const why = (g: Grant) => {
    if (g.exception === 'Deny') return 'Taken away just for this person';
    if (g.exception === 'Allow' && g.fromRoles.length === 0) return 'Added just for this person';
    return g.fromRoles.length > 0 ? `From ${g.fromRoles.join(', ')}` : 'Not in their roles';
};

/**
 * What a person can open, grouped by area, with where each permission comes from. Single
 * permissions can be added or taken away just for this person ("exceptions"); roles stay the
 * normal way to give access.
 */
export default function AccessList({ catalog, roles, roleIds, exceptions, onException, readOnly }: Props) {
    const [allOpen, setAllOpen] = useState(false);
    const access = useMemo(() => effectiveAccess(catalog, roles, roleIds, exceptions), [catalog, roles, roleIds, exceptions]);
    const areas = useMemo(() => areasOf(catalog), [catalog]);
    const count = Object.keys(exceptions).filter(k => access.has(k)).length;

    const shownAreas = areas
        .map(a => ({ ...a, permissions: a.permissions.filter(p => allOpen || access.get(p.key)?.has || exceptions[p.key]) }))
        .filter(a => a.permissions.length > 0);

    return (
        <div className="ua-access">
            {shownAreas.length === 0 && !allOpen && <p className="pf-hint">Nothing yet. Give them a role above.</p>}
            {shownAreas.map(a => (
                <div key={a.name} className="ua-area">
                    <h4>{a.name}</h4>
                    <ul>
                        {a.permissions.map(p => {
                            const g = access.get(p.key)!;
                            const Icon = g.has ? Check : g.exception === 'Deny' ? X : Minus;
                            return (
                                <li key={p.key} className={`${g.has ? 'is-has' : 'is-not'} ${g.exception ? 'is-exception' : ''}`}>
                                    <Icon size={15} aria-hidden="true" className="ua-access-icon" />
                                    <span className="ua-access-text">
                                        <span>{p.displayName}<span className="ua-visually-hidden">{g.has ? ': can open' : ': cannot open'}</span></span>
                                        <small>{why(g)}</small>
                                    </span>
                                    {allOpen && !readOnly && (
                                        <select
                                            aria-label={`${p.displayName}: just for this person`}
                                            value={exceptions[p.key] ?? ''}
                                            onChange={e => onException(p.key, (e.target.value || null) as Exception | null)}
                                        >
                                            <option value="">As their roles say</option>
                                            <option value="Allow">Always allow</option>
                                            <option value="Deny">Never allow</option>
                                        </select>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
            {!readOnly && (
                <button type="button" className="pf-btn pf-btn-quiet ua-exceptions-toggle" aria-expanded={allOpen} onClick={() => setAllOpen(o => !o)}>
                    {allOpen ? 'Done changing single permissions' : count > 0 ? `Change single permissions (${count} just for them)` : 'Change single permissions just for this person'}
                </button>
            )}
        </div>
    );
}
