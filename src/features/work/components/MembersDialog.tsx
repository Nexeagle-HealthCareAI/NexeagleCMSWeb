import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { AccessAction, WorkProject, WorkProjectAccess, WorkUser } from '../types';
import { errorMessage, workService } from '../services/workService';
import { Dialog } from './parts';

const LOG_TEXT: Record<AccessAction, (target: string) => string> = {
  MemberAdded: target => `added ${target}`,
  MemberRemoved: target => `removed ${target}`,
  Restricted: () => 'made the board members-only',
  Opened: () => 'opened the board to everyone',
};
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Props {
  project: WorkProject;
  users: WorkUser[];
  onClose: () => void;
  onSaved: (access: WorkProjectAccess) => void;
}

/** Who can open one board: the members-only switch, the members, and the record of changes. */
export default function MembersDialog({ project, users, onClose, onSaved }: Props) {
  const [access, setAccess] = useState<WorkProjectAccess | null>(null);
  const [restricted, setRestricted] = useState(project.isRestricted);
  const [members, setMembers] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    workService.projectAccess(project.projectId)
      .then(a => { if (!alive) return; setAccess(a); setRestricted(a.isRestricted); setMembers(a.memberUserIds); })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not load who has access. Close this and try again.')); });
    return () => { alive = false; };
  }, [project.projectId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? users.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
    // Members first, so it is plain who is in.
    return [...list].sort((a, b) => Number(members.includes(b.userId)) - Number(members.includes(a.userId)) || a.fullName.localeCompare(b.fullName));
  }, [users, query, members]);

  const toggle = (userId: string) => setMembers(prev => (prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await workService.saveProjectAccess(project.projectId, { isRestricted: restricted, memberUserIds: members });
      toast.success(saved.isRestricted ? `${project.key} is now open to its ${saved.memberUserIds.length} member${saved.memberUserIds.length === 1 ? '' : 's'} only` : `${project.key} is open to everyone on the work board`);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, 'Could not save. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Who can open ${project.name}`} onClose={onClose} wide>
      <form className="wk-form" onSubmit={submit} noValidate>
        {!access && !error ? <p className="wk-muted">Loading…</p> : access && (
          <>
            <label className="wk-check">
              <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} />
              <span><Lock size={15} aria-hidden="true" /> <strong>Members only</strong></span>
            </label>
            <p className="wk-hint">
              {restricted
                ? 'Only the people ticked below can open this board. For everyone else it does not appear, and its items cannot be opened even with a link.'
                : 'Everyone who can use the Daily Work Board can open this board. Turn this on to limit it to the people you tick.'}
            </p>

            <fieldset className="wk-members" disabled={!restricted}>
              <legend>Members ({members.length})</legend>
              <label className="wk-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" data-autofocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a person" aria-label="Find a person" />
              </label>
              <div className="wk-members-list">
                {shown.map(u => (
                  <label key={u.userId} className="wk-check">
                    <input type="checkbox" checked={members.includes(u.userId)} onChange={() => toggle(u.userId)} />
                    <span>{u.fullName} <small>{u.email}</small></span>
                  </label>
                ))}
                {shown.length === 0 && <p className="wk-muted">Nobody matches “{query}”.</p>}
              </div>
            </fieldset>
            <p className="wk-hint">People who manage board members can always open every board. Removing someone takes effect on their next click.</p>

            {access.log.length > 0 && (
              <details className="wk-members-log">
                <summary>Access changes ({access.log.length})</summary>
                <ul>
                  {access.log.map((l, i) => (
                    <li key={i}><strong>{l.actorName}</strong> {LOG_TEXT[l.action]?.(l.targetName || 'someone') ?? l.action} <time dateTime={l.createdAt}>{when(l.createdAt)}</time></li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={saving || !access}>{saving ? 'Saving…' : 'Save access'}</button>
        </div>
      </form>
    </Dialog>
  );
}
