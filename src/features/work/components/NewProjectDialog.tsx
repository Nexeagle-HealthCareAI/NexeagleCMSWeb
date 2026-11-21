import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { WorkProject } from '../types';
import { errorMessage, workService } from '../services/workService';
import { Dialog } from './parts';

export default function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (project: WorkProject) => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[A-Za-z]{2,10}$/.test(key.trim())) { setError('The key must be 2 to 10 letters, for example HMS.'); return; }
    if (!name.trim()) { setError('Give the project a name.'); return; }
    setSaving(true);
    setError('');
    try {
      const project = await workService.createProject({ key: key.trim().toUpperCase(), name: name.trim() });
      toast.success(`Project ${project.key} created`);
      onCreated(project);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the project. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title="New project" onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <label className="wk-field">
          <span>Name</span>
          <input data-autofocus value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="e.g. 1Lab" />
        </label>
        <label className="wk-field">
          <span>Key</span>
          <input value={key} onChange={e => setKey(e.target.value.toUpperCase())} maxLength={10} placeholder="e.g. LAB" />
        </label>
        <p className="wk-hint">The key starts every item's number, such as LAB-12. It cannot be changed later.</p>
        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={saving}>{saving ? 'Creating…' : 'Create project'}</button>
        </div>
      </form>
    </Dialog>
  );
}
