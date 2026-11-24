import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { problem } from '../../profile/services/profileService';
import { adminService, type RoleDto, type UserDetail } from '../services/adminService';
import { temporaryPassword } from '../accessAreas';
import RolePicker from './RolePicker';

interface Props {
    roles: RoleDto[];
    onCancel: () => void;
    onCreated: (person: UserDetail, password: string) => void;
}

/** Adding someone: who they are, a temporary password and their roles. */
export default function NewPersonDialog({ roles, onCancel, onCreated }: Props) {
    const [form, setForm] = useState({ fullName: '', email: '', jobTitle: '', phoneNumber: '', password: temporaryPassword() });
    const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, saving]);

    const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [field]: e.target.value }));

    const create = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.fullName.trim() || !form.email.trim()) { setError('Full name and email are required.'); return; }
        if (form.password.length < 8) { setError('The temporary password needs at least 8 characters.'); return; }
        if (roleIds.size === 0) { setError('Choose at least one role, so they can open something.'); return; }
        setSaving(true);
        setError(null);
        try {
            const person = await adminService.createUser({
                fullName: form.fullName.trim(), email: form.email.trim(), jobTitle: form.jobTitle.trim(), phoneNumber: form.phoneNumber.trim(),
                password: form.password, roleIds: [...roleIds],
            });
            onCreated(person, form.password);
        } catch (err) {
            setError(problem(err, 'They could not be added. Try again.'));
            setSaving(false);
        }
    };

    return (
        <div className="pf-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onCancel(); }}>
            <form className="pf-dialog ua-new" role="dialog" aria-modal="true" aria-labelledby="ua-new-title" onSubmit={create} noValidate>
                <header className="pf-dialog-head">
                    <h2 id="ua-new-title">Add a person</h2>
                    <button type="button" className="pf-icon-btn" onClick={onCancel} aria-label="Close"><X size={18} /></button>
                </header>
                <div className="pf-form">
                    <label className="pf-field"><span>Full name</span><input value={form.fullName} onChange={set('fullName')} maxLength={150} required autoFocus /></label>
                    <label className="pf-field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} maxLength={256} required /></label>
                    <label className="pf-field"><span>Job title <em>(optional)</em></span><input value={form.jobTitle} onChange={set('jobTitle')} maxLength={100} /></label>
                    <label className="pf-field"><span>Phone number <em>(optional)</em></span><input value={form.phoneNumber} onChange={set('phoneNumber')} maxLength={20} inputMode="tel" placeholder="+91 98765 43210" /></label>
                    <label className="pf-field ua-wide">
                        <span>Temporary password</span>
                        <span className="ua-inline">
                            <input value={form.password} onChange={set('password')} minLength={8} autoComplete="off" spellCheck={false} />
                            <button type="button" className="pf-btn" onClick={() => setForm(f => ({ ...f, password: temporaryPassword() }))}>New one</button>
                        </span>
                        <small>Give it to them yourself. They choose their own password when they first sign in.</small>
                    </label>
                </div>
                <div>
                    <h3 className="pf-subhead">Roles</h3>
                    <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} label="Roles for the new person" />
                </div>
                {error && <p className="pf-error" role="alert">{error}</p>}
                <footer className="pf-dialog-foot">
                    <button type="button" className="pf-btn" onClick={onCancel} disabled={saving}>Cancel</button>
                    <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add person'}</button>
                </footer>
            </form>
        </div>
    );
}
