import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { adminService, type PermissionDto } from '../../admin/services/adminService';
import { openAreas } from '../../admin/accessAreas';
import PhotoControl from '../PhotoControl';
import { problem, profileService, type Profile } from '../services/profileService';
import '../profile.css';

interface Draft { fullName: string; jobTitle: string; phoneNumber: string }
const draftOf = (p: Profile): Draft => ({ fullName: p.fullName, jobTitle: p.jobTitle ?? '', phoneNumber: p.phoneNumber ?? '' });

/** My profile: everyone's own name, job title, phone number and photo, and what they can open. */
export default function MyProfile() {
    const permissions = useAuthStore(s => s.permissions);
    const patchUser = useAuthStore(s => s.patchUser);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [catalog, setCatalog] = useState<PermissionDto[]>([]);
    const [failed, setFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        profileService.get()
            .then(p => { setProfile(p); setDraft(draftOf(p)); })
            .catch(() => setFailed(true));
        adminService.getPermissions().then(setCatalog).catch(() => setCatalog([]));
    }, []);

    const areas = useMemo(() => openAreas(catalog, permissions), [catalog, permissions]);

    if (failed) return <div className="pf-page"><p className="pf-error" role="alert">Your profile could not be loaded. Refresh the page to try again.</p></div>;
    if (!profile || !draft) return <div className="pf-page"><p className="pf-hint">Loading your profile…</p></div>;

    const changed = draft.fullName.trim() !== profile.fullName
        || draft.jobTitle.trim() !== (profile.jobTitle ?? '')
        || draft.phoneNumber.trim() !== (profile.phoneNumber ?? '');

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!draft.fullName.trim()) { setError('Your name is required.'); return; }
        setSaving(true);
        setError(null);
        try {
            const next = await profileService.update({ fullName: draft.fullName.trim(), jobTitle: draft.jobTitle.trim(), phoneNumber: draft.phoneNumber.trim() });
            setProfile(next);
            setDraft(draftOf(next));
            patchUser({ name: next.fullName, jobTitle: next.jobTitle });
            toast.success('Profile saved');
        } catch (err) {
            setError(problem(err, 'Your profile could not be saved. Try again.'));
        } finally {
            setSaving(false);
        }
    };

    const photoChanged = (photoVersion: string | null) => {
        setProfile(p => (p ? { ...p, photoVersion } : p));
        patchUser({ photoVersion });
    };

    const set = (field: keyof Draft) => (e: { target: { value: string } }) => setDraft(d => (d ? { ...d, [field]: e.target.value } : d));

    return (
        <div className="pf-page">
            <header className="pf-head">
                <h1>My profile</h1>
                <p>How you appear to the team across the CMS: beside tasks, comments and chats.</p>
            </header>

            <section className="pf-card" aria-labelledby="pf-about">
                <h2 id="pf-about">About you</h2>
                <PhotoControl
                    userId={profile.userId} name={profile.fullName} photoVersion={profile.photoVersion} title="Your photo"
                    upload={profileService.setPhoto} remove={profileService.removePhoto} onChanged={photoChanged}
                />
                <form className="pf-form" onSubmit={save} noValidate>
                    <label className="pf-field">
                        <span>Full name</span>
                        <input value={draft.fullName} onChange={set('fullName')} maxLength={150} autoComplete="name" required />
                    </label>
                    <label className="pf-field">
                        <span>Job title</span>
                        <input value={draft.jobTitle} onChange={set('jobTitle')} maxLength={100} placeholder="For example: Support lead" autoComplete="organization-title" />
                    </label>
                    <label className="pf-field">
                        <span>Phone number</span>
                        <input value={draft.phoneNumber} onChange={set('phoneNumber')} maxLength={20} placeholder="+91 98765 43210" inputMode="tel" autoComplete="tel" />
                        <small>You can also sign in with a one-time code sent to this number.</small>
                    </label>
                    <div className="pf-field">
                        <span>Email</span>
                        <output className="pf-readonly">{profile.email}</output>
                        <small>You sign in with this. Ask an administrator to change it.</small>
                    </div>
                    {error && <p className="pf-error" role="alert">{error}</p>}
                    <div className="pf-form-foot">
                        <button type="button" className="pf-btn" disabled={!changed || saving} onClick={() => { setDraft(draftOf(profile)); setError(null); }}>Undo changes</button>
                        <button type="submit" className="pf-btn pf-btn-primary" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                    </div>
                </form>
            </section>

            <section className="pf-card" aria-labelledby="pf-access">
                <h2 id="pf-access"><ShieldCheck size={18} aria-hidden="true" /> Your access</h2>
                <div className="pf-roles" aria-label="Your roles">
                    {profile.roles.length > 0
                        ? profile.roles.map(r => <span key={r} className="pf-chip">{r}</span>)
                        : <span className="pf-hint">You have no role yet. Ask an administrator to give you one.</span>}
                </div>
                {areas.length > 0 && (
                    <>
                        <h3 className="pf-subhead">What you can open</h3>
                        <ul className="pf-areas">
                            {areas.map(a => (
                                <li key={a.name}>
                                    <strong>{a.name}</strong>
                                    <span>{a.permissions.map(p => p.displayName).join(' · ')}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <p className="pf-hint">Need something else? Ask an administrator in Users &amp; access.</p>
            </section>

            <section className="pf-card" aria-labelledby="pf-security">
                <h2 id="pf-security"><KeyRound size={18} aria-hidden="true" /> Password</h2>
                <p className="pf-hint">Change the password you sign in with.</p>
                <Link className="pf-btn" to="/change-password">Change password</Link>
            </section>
        </div>
    );
}
