import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Lock, Plus, Trash2, X } from 'lucide-react';
import UserAvatar from '../../../components/UserAvatar';
import { problem } from '../../profile/services/profileService';
import { adminService, type PermissionDto, type RoleDto, type UserSummary } from '../services/adminService';
import { areasOf } from '../accessAreas';

/** The Administrator role always holds every permission (see CmsAdminService). */
export const ADMINISTRATOR_ROLE_ID = 'b0000001-0000-0000-0000-000000000001';
const isAdministrator = (r: { roleId: string }) => r.roleId.toLowerCase() === ADMINISTRATOR_ROLE_ID;

interface Props {
    roles: RoleDto[];
    catalog: PermissionDto[];
    users: UserSummary[];
    canManage: boolean;
    onChanged: () => void;
    onOpenPerson: (userId: string) => void;
}

/** The roles, what each holds and who has it; a role opens in an editor. */
export default function RolesView({ roles, catalog, users, canManage, onChanged, onOpenPerson }: Props) {
    const [open, setOpen] = useState<RoleDto | 'new' | null>(null);
    const peopleOf = (r: RoleDto) => users.filter(u => u.roles.includes(r.name));
    const shown = roles.filter(r => r.isActive || !r.isSystemDefined);
    const live = useMemo(() => new Set(areasOf(catalog).flatMap(a => a.permissions.map(p => p.key))), [catalog]);

    return (
        <section aria-label="Roles">
            <div className="ua-roles-head">
                <p className="pf-hint">Give people roles rather than single permissions: when a job changes, change the role once.</p>
                {canManage && <button type="button" className="pf-btn pf-btn-primary" onClick={() => setOpen('new')}><Plus size={16} aria-hidden="true" /> New role</button>}
            </div>
            <ul className="ua-role-cards">
                {shown.map(r => {
                    const people = peopleOf(r);
                    return (
                        <li key={r.roleId} className={r.isActive ? '' : 'is-off'}>
                            <button type="button" className="ua-role-card" onClick={() => setOpen(r)}>
                                <span className="ua-role-card-top">
                                    <strong>{r.name}</strong>
                                    {r.isSystemDefined && <span className="ua-tag" title="Comes with the CMS">Built in</span>}
                                    {!r.isActive && <span className="ua-tag">Switched off</span>}
                                </span>
                                {r.description && <span className="ua-role-desc">{r.description}</span>}
                                <span className="ua-role-meta">
                                    {r.permissionKeys.filter(k => live.has(k)).length} permissions · {people.length} {people.length === 1 ? 'person' : 'people'}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {open && (
                <RoleEditor
                    role={open === 'new' ? null : open}
                    catalog={catalog}
                    people={open === 'new' ? [] : peopleOf(open)}
                    canManage={canManage}
                    onClose={() => setOpen(null)}
                    onSaved={() => { setOpen(null); onChanged(); }}
                    onOpenPerson={id => { setOpen(null); onOpenPerson(id); }}
                />
            )}
        </section>
    );
}

interface EditorProps {
    role: RoleDto | null;
    catalog: PermissionDto[];
    people: UserSummary[];
    canManage: boolean;
    onClose: () => void;
    onSaved: () => void;
    onOpenPerson: (userId: string) => void;
}

function RoleEditor({ role, catalog, people, canManage, onClose, onSaved, onOpenPerson }: EditorProps) {
    const [name, setName] = useState(role?.name ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [keys, setKeys] = useState<Set<string>>(new Set(role?.permissionKeys ?? []));
    const [isActive, setIsActive] = useState(role?.isActive ?? true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const areas = useMemo(() => areasOf(catalog), [catalog]);
    const locked = !!role && isAdministrator(role);
    const readOnly = !canManage;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const flip = (list: string[], on: boolean) => setKeys(k => {
        const next = new Set(k);
        list.forEach(key => (on ? next.add(key) : next.delete(key)));
        return next;
    });

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError('Give the role a name.'); return; }
        setSaving(true);
        setError(null);
        // Keep grants of pages that were taken out of the CMS: they are not shown here.
        const permissionKeys = [...keys];
        try {
            if (role) {
                await adminService.updateRole(role.roleId, {
                    name: role.isSystemDefined ? undefined : name.trim(), description: description.trim(),
                    isActive: role.isSystemDefined ? undefined : isActive,
                    permissionKeys: locked ? undefined : permissionKeys,
                });
            } else {
                await adminService.createRole({ name: name.trim(), description: description.trim(), permissionKeys });
            }
            toast.success(role ? `${name.trim()} saved. People see the change when they next sign in.` : `${name.trim()} added`);
            onSaved();
        } catch (err) {
            setError(problem(err, 'The role could not be saved. Its name may already be taken.'));
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!role) return;
        setSaving(true);
        try {
            await adminService.deleteRole(role.roleId);
            toast.success(`${role.name} deleted`);
            onSaved();
        } catch (err) {
            setError(problem(err, 'The role could not be deleted.'));
            setSaving(false);
        }
    };

    return (
        <>
            <div className="ua-panel-backdrop" onMouseDown={onClose} aria-hidden="true" />
            <aside className="ua-panel" role="dialog" aria-label={role ? `Role: ${role.name}` : 'New role'}>
                <header className="ua-panel-head">
                    <h2>{role ? role.name : 'New role'}</h2>
                    <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </header>
                <form className="ua-panel-body" onSubmit={save} noValidate>
                    <section>
                        <div className="pf-form">
                            <label className="pf-field">
                                <span>Name</span>
                                <input value={name} onChange={e => setName(e.target.value)} maxLength={100} readOnly={readOnly || !!role?.isSystemDefined} required />
                                {role?.isSystemDefined && <small>Built-in roles keep their name.</small>}
                            </label>
                            <label className="pf-field">
                                <span>What it is for</span>
                                <input value={description} onChange={e => setDescription(e.target.value)} maxLength={300} readOnly={readOnly} placeholder="For example: Answers support chats" />
                            </label>
                        </div>
                        {role && !role.isSystemDefined && (
                            <label className="ua-switch">
                                <input type="checkbox" checked={isActive} disabled={readOnly} onChange={e => setIsActive(e.target.checked)} />
                                <span><strong>{isActive ? 'In use' : 'Switched off'}</strong><small>A switched-off role gives nobody anything.</small></span>
                            </label>
                        )}
                    </section>

                    <section aria-labelledby="ua-r-perms">
                        <h3 id="ua-r-perms">What it lets people do</h3>
                        {locked && <p className="ua-note"><Lock size={14} aria-hidden="true" /> Administrators can always do everything, so nobody is locked out.</p>}
                        {areas.map(a => {
                            const all = a.permissions.every(p => locked || keys.has(p.key));
                            const some = a.permissions.some(p => keys.has(p.key));
                            return (
                                <fieldset key={a.name} className="ua-area ua-area-edit" disabled={readOnly || locked}>
                                    <legend>
                                        <label className="ua-all">
                                            <input type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = !all && some; }}
                                                onChange={e => flip(a.permissions.map(p => p.key), e.target.checked)} />
                                            <strong>{a.name}</strong>
                                        </label>
                                    </legend>
                                    <ul>
                                        {a.permissions.map(p => (
                                            <li key={p.key}>
                                                <label className="ua-perm">
                                                    <input type="checkbox" role="switch" checked={locked || keys.has(p.key)} onChange={e => flip([p.key], e.target.checked)} />
                                                    <span>{p.displayName}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </fieldset>
                            );
                        })}
                    </section>

                    {role && (
                        <section aria-labelledby="ua-r-people">
                            <h3 id="ua-r-people">People with this role ({people.length})</h3>
                            {people.length === 0 ? <p className="pf-hint">Nobody yet. Give it to someone from their page under People.</p> : (
                                <ul className="ua-role-people">
                                    {people.map(u => (
                                        <li key={u.userId}>
                                            <button type="button" className="ua-person-link" onClick={() => onOpenPerson(u.userId)}>
                                                <UserAvatar userId={u.userId} name={u.fullName} photoVersion={u.photoVersion} size={28} /> {u.fullName}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {canManage && (
                        <footer className="ua-panel-foot">
                            {error && <p className="pf-error" role="alert">{error}</p>}
                            {role && !role.isSystemDefined && (deleting ? (
                                <span className="ua-leave">
                                    Delete {role.name}?{people.length > 0 && ` ${people.length} ${people.length === 1 ? 'person loses' : 'people lose'} what it gives.`}
                                    <button type="button" className="pf-btn pf-btn-danger" onClick={remove} disabled={saving}>Delete</button>
                                    <button type="button" className="pf-btn pf-btn-quiet" onClick={() => setDeleting(false)}>Keep</button>
                                </span>
                            ) : (
                                <button type="button" className="pf-btn pf-btn-quiet pf-btn-danger ua-delete" onClick={() => setDeleting(true)}><Trash2 size={16} aria-hidden="true" /> Delete role</button>
                            ))}
                            <button type="button" className="pf-btn" onClick={onClose} disabled={saving}>Cancel</button>
                            <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>{saving ? 'Saving…' : role ? 'Save role' : 'Add role'}</button>
                        </footer>
                    )}
                </form>
            </aside>
        </>
    );
}
