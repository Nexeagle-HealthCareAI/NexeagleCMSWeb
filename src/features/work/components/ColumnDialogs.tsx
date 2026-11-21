import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { StatusCategory, WorkProject, WorkStatus } from '../types';
import { CATEGORIES, CATEGORY_LABEL } from '../workMeta';
import { errorMessage, workService } from '../services/workService';
import { Dialog } from './parts';

/** Add a board column, or rename one and change what it means. */
export function ColumnDialog({ project, status, onClose, onSaved }: { project: WorkProject; status: WorkStatus | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(status?.name ?? '');
  const [category, setCategory] = useState<StatusCategory>(status?.category ?? 'InProgress');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the column a name.'); return; }
    setSaving(true);
    setError('');
    try {
      if (status) await workService.updateStatus(status.statusId, { name: name.trim(), category });
      else await workService.addStatus(project.projectId, { name: name.trim(), category });
      toast.success(status ? 'Column saved' : `Column “${name.trim()}” added`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the column. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={status ? `Edit column “${status.name}”` : `New column in ${project.name}`} onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <label className="wk-field">
          <span>Name</span>
          <input data-autofocus value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="e.g. Ready for QA" />
        </label>
        <label className="wk-field">
          <span>Items in this column are</span>
          <select value={category} onChange={e => setCategory(e.target.value as StatusCategory)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <p className="wk-hint">This tells the board what counts as finished, whatever the column is called.</p>
        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={saving}>{saving ? 'Saving…' : status ? 'Save' : 'Add column'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Remove a column. When it still holds items, they must go to another column first. */
export function RemoveColumnDialog({ project, status, count, onClose, onRemoved }: { project: WorkProject; status: WorkStatus; count: number; onClose: () => void; onRemoved: () => void }) {
  const others = project.statuses.filter(s => s.statusId !== status.statusId);
  const [moveTo, setMoveTo] = useState(others[0]?.key ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      await workService.deleteStatus(status.statusId, count > 0 ? moveTo : undefined);
      toast.success(`Column “${status.name}” removed`);
      onRemoved();
    } catch (err) {
      setError(errorMessage(err, 'Could not remove the column. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Remove column “${status.name}”?`} onClose={onClose}>
      {count > 0 ? (
        <label className="wk-field">
          <span>{count === 1 ? 'Move its 1 item to' : `Move its ${count} items to`}</span>
          <select data-autofocus value={moveTo} onChange={e => setMoveTo(e.target.value)}>
            {others.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
      ) : <p className="wk-dialog-text">The column is empty, so nothing else changes.</p>}
      {error && <p className="wk-error" role="alert">{error}</p>}
      <div className="wk-form-actions">
        <button type="button" className="wk-btn" onClick={onClose}>Keep it</button>
        <button type="button" className="wk-btn is-danger" disabled={saving || (count > 0 && !moveTo)} onClick={() => void remove()}>Remove column</button>
      </div>
    </Dialog>
  );
}
