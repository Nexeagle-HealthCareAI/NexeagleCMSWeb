import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { WorkItem, WorkUser } from '../types';
import { errorMessage, workService } from '../services/workService';
import { Dialog } from './parts';

/** Escalate a work item: choose who, say why. It is posted in the board's chat and those people are notified. */
export default function EscalateDialog({ item, users, currentUserId, onClose, onDone }: {
  item: WorkItem; users: WorkUser[]; currentUserId: string | null; onClose: () => void; onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (picked.length === 0) { setError('Choose who to escalate to.'); return; }
    setBusy(true);
    setError('');
    try {
      await workService.escalateItem(item.workItemId, { userIds: picked, note: note.trim() || undefined });
      toast.success(`${item.key} escalated to ${picked.length} ${picked.length === 1 ? 'person' : 'people'}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Could not escalate. Try again.'));
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Escalate ${item.key}`} onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <p className="wk-hint">This posts in the board's chat, marks it as an escalation and notifies the people you choose. It is also written in the item's history.</p>
        <fieldset className="wk-members">
          <legend>Escalate to ({picked.length})</legend>
          <div className="wk-members-list">
            {users.filter(u => u.userId !== currentUserId).map(u => (
              <label key={u.userId} className="wk-check">
                <input type="checkbox" checked={picked.includes(u.userId)} onChange={() => setPicked(prev => (prev.includes(u.userId) ? prev.filter(x => x !== u.userId) : [...prev, u.userId]))} />
                <span>{u.fullName}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="wk-field">
          <span>What is needed</span>
          <textarea data-autofocus value={note} maxLength={1000} rows={3} onChange={e => setNote(e.target.value)} placeholder="e.g. Customer is blocked, we need a decision today" />
        </label>
        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-danger" disabled={busy}>{busy ? 'Escalating…' : 'Escalate'}</button>
        </div>
      </form>
    </Dialog>
  );
}
