import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { KeyRound, X } from 'lucide-react';
import PhotoControl from '../../profile/PhotoControl';
import { problem, profileService } from '../../profile/services/profileService';
import { adminService, type PermissionDto, type RoleDto, type UserDetail } from '../services/adminService';
import { temporaryPassword, whenText, type Exception } from '../accessAreas';
import AccessList from './AccessList';
import RolePicker from './RolePicker';

interface Props {
    userId: string;
    catalog: PermissionDto[];
    roles: RoleDto[];
    canManage: boolean;
    /** The signed-in person: they cannot switch off their own account. */
    meId?: string;
    onClose: () => void;
    /** After a save, so the list shows the new details. */
    onSaved: () => void;
}

interface Draft { fullName: string; email: string; phoneNumber: string; jobTitle: string; isActive: boolean }
const draftOf = (u: UserDetail): Draft => ({ fullName: u.fullName, email: u.email, phoneNumber: u.phoneNumber ?? '', jobTitle: u.jobTitle ?? '', isActive: u.isActive });
const exceptionsOf = (u: UserDetail) => Object.fromEntries(u.overrides.map(o => [o.key, o.effect])) as Record<string, Exception>;
const same = (a: Set<string>, b: string[]) => a.size === b.length && b.every(x => a.has(x));
const sameExceptions = (a: Record<string, Exception>, b: Record<string, Exception>) =>
    Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** One person: their details, photo, roles and what they can open. Everything saves together. */
export default function PersonPanel({ userId, catalog, roles, canManage, meId, onClose, onSaved }: Props) {
    const [person, setPerson] = useState<UserDetail | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
    const [exceptions, setExceptions] = useState<Record<string, Exception>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [password, setPassword] = useState<string | null>(null);

    const load = (u: UserDetail) => {
        setPerson(u);
        setDraft(draftOf(u));
        setRoleIds(new Set(u.roleIds));
        setExceptions(exceptionsOf(u));
    };

    useEffect(() => {
        let live = true;
        adminService.getUser(userId).then(u => { if (live) load(u); }).catch(e => { if (live) setError(problem(e, 'This person could not be loaded.')); });
        return () => { live = false; };
    }, [userId]);

    const dirty = useMemo(() => {
        if (!person || !draft) return false;
        const d = draftOf(person);
        return (Object.keys(d) as (keyof Draft)[]).some(k => (typeof d[k] === 'string' ? String(draft[k]).trim() !== d[k] : draft[k] !== d[k]))
            || !same(roleIds, person.roleIds)
            || !sameExceptions(exceptions, exceptionsOf(person));
    }, [person, draft, roleIds, exceptions]);

    const close = () => { if (dirty && canManage) setLeaving(true); else onClose(); };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.pf-backdrop')) close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const save = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!person || !draft) return;
        if (!draft.fullName.trim()) { setError('Full name is required.'); return; }
        if (!draft.email.trim()) { setError('Email is required.'); return; }
        setSaving(true);
        setError(null);
        try {
            const next = await adminService.updateUser(person.userId, {
                fullName: draft.fullName.trim(),
                email: draft.email.trim(),
                phoneNumber: draft.phoneNumber.trim(),
                jobTitle: draft.jobTitle.trim(),
                isActive: draft.isActive,
                roleIds: [...roleIds],
                overrides: Object.entries(exceptions).map(([key, effect]) => ({ key, effect })),
            });
            load(next);
            setLeaving(false);
            onSaved();
            toast.success(`${next.fullName} saved. Changes to access apply when they next sign in.`);
        } catch (err) {
            setError(problem(err, 'The changes could not be saved. Try again.'));
        } finally {
            setSaving(false);
        }
    };

    const resetPassword = async () => {
        if (!person || !password) return;
        try {
            await adminService.resetPassword(person.userId, password);
            toast.success(`Temporary password set. ${person.fullName} must choose a new one when they sign in.`);
            setPassword(null);
            onSaved();
        } catch (err) {
            toast.error(problem(err, 'The password could not be set. Try again.'));
        }
    };

    const set = (field: 'fullName' | 'email' | 'phoneNumber' | 'jobTitle') => (e: { target: { value: string } }) => setDraft(d => (d ? { ...d, [field]: e.target.value } : d));
    const self = person?.userId === meId;
    const readOnly = !canManage;

    return (
        <>
            <div className="ua-panel-backdrop" onMouseDown={close} aria-hidden="true" />
            <aside className="ua-panel" role="dialog" aria-modal="false" aria-label={person ? `${person.fullName}: details and access` : 'Person'}>
                <header className="ua-panel-head">
                    <div>
                        <h2>{person?.fullName ?? 'Loading…'}</h2>
                        {person && <p className="pf-hint">Last signed in: {whenText(person.lastLoginAt)}</p>}
                    </div>
                    <button type="button" className="pf-icon-btn" onClick={close} aria-label="Close"><X size={18} /></button>
                </header>

                {!person || !draft ? (
                    <div className="ua-panel-body">{error ? <p className="pf-error" role="alert">{error}</p> : <p className="pf-hint">Loading…</p>}</div>
                ) : (
                    <form className="ua-panel-body" onSubmit={save} noValidate>
                        {readOnly && <p className="ua-note">You can see people and their access. Only administrators can change them.</p>}

                        <section aria-labelledby="ua-p-details">
                            <h3 id="ua-p-details">Details</h3>
                            <PhotoControl
                                userId={person.userId} name={person.fullName} photoVersion={person.photoVersion} size={72} readOnly={readOnly}
                                title={`${person.fullName}'s photo`}
                                upload={photo => profileService.setPhotoFor(person.userId, photo)}
                                remove={() => profileService.removePhotoFor(person.userId)}
                                onChanged={photoVersion => { setPerson(p => (p ? { ...p, photoVersion } : p)); onSaved(); }}
                            />
                            <div className="pf-form">
                                <label className="pf-field"><span>Full name</span><input value={draft.fullName} onChange={set('fullName')} maxLength={150} readOnly={readOnly} required /></label>
                                <label className="pf-field"><span>Job title</span><input value={draft.jobTitle} onChange={set('jobTitle')} maxLength={100} readOnly={readOnly} placeholder="For example: Support lead" /></label>
                                <label className="pf-field">
                                    <span>Email</span>
                                    <input type="email" value={draft.email} onChange={set('email')} maxLength={256} readOnly={readOnly} required />
                                    {draft.email.trim() !== person.email && <small>They will sign in with the new email.</small>}
                                </label>
                                <label className="pf-field">
                                    <span>Phone number</span>
                                    <input value={draft.phoneNumber} onChange={set('phoneNumber')} maxLength={20} readOnly={readOnly} placeholder="+91 98765 43210" inputMode="tel" />
                                    <small>Also lets them sign in with a one-time code.</small>
                                </label>
                            </div>
                            <label className={`ua-switch ${self ? 'is-locked' : ''}`}>
                                <input type="checkbox" checked={draft.isActive} disabled={readOnly || self}
                                    onChange={e => setDraft(d => (d ? { ...d, isActive: e.target.checked } : d))} />
                                <span>
                                    <strong>{draft.isActive ? 'Can sign in' : 'Switched off: cannot sign in'}</strong>
                                    <small>{self ? "You can't switch off your own account." : 'Switching someone off keeps their work and history.'}</small>
                                </span>
                            </label>
                            {canManage && (
                                <div className="ua-password">
                                    {password === null ? (
                                        <button type="button" className="pf-btn" onClick={() => setPassword(temporaryPassword())}><KeyRound size={16} aria-hidden="true" /> Set a temporary password</button>
                                    ) : (
                                        <div className="ua-password-row">
                                            <label className="pf-field">
                                                <span>Temporary password</span>
                                                <input value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="off" spellCheck={false} />
                                                <small>Give it to them yourself. They must choose a new one when they sign in.</small>
                                            </label>
                                            <button type="button" className="pf-btn pf-btn-primary" disabled={password.length < 8} onClick={resetPassword}>Set password</button>
                                            <button type="button" className="pf-btn pf-btn-quiet" onClick={() => setPassword(null)}>Cancel</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <section aria-labelledby="ua-p-roles">
                            <h3 id="ua-p-roles">Roles</h3>
                            <p className="pf-hint">A role is a set of pages that go together. Most people need one.</p>
                            <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} readOnly={readOnly} label={`Roles of ${person.fullName}`} />
                        </section>

                        <section aria-labelledby="ua-p-access">
                            <h3 id="ua-p-access">What they can open</h3>
                            <AccessList
                                catalog={catalog} roles={roles} roleIds={roleIds} exceptions={exceptions} readOnly={readOnly}
                                onException={(key, value) => setExceptions(x => {
                                    const next = { ...x };
                                    if (value) next[key] = value; else delete next[key];
                                    return next;
                                })}
                            />
                        </section>

                        {canManage && (
                            <footer className="ua-panel-foot">
                                {error && <p className="pf-error" role="alert">{error}</p>}
                                {leaving ? (
                                    <>
                                        <span className="ua-leave">You have changes that are not saved.</span>
                                        <button type="button" className="pf-btn pf-btn-quiet" onClick={onClose}>Discard</button>
                                        <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" className="pf-btn" disabled={!dirty || saving} onClick={() => { load(person); setError(null); }}>Undo changes</button>
                                        <button type="submit" className="pf-btn pf-btn-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                                    </>
                                )}
                            </footer>
                        )}
                    </form>
                )}
            </aside>
        </>
    );
}
