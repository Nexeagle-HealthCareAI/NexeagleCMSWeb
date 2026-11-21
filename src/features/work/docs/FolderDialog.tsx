import { useEffect, useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkUser } from '../types';
import { Dialog } from '../components/parts';
import { errorMessage } from '../services/workService';
import { docsService } from './docsService';
import { FOLDER_COLORS, type DocFolder, type FolderColor } from './types';

interface Props {
  /** The folder to change, or null to make a new one. */
  folder: DocFolder | null;
  /** Where a new folder goes. */
  parentId: string | null;
  users: WorkUser[];
  /** May lock any folder (docs.sensitive). The maker of a folder may lock their own. */
  canLockAny: boolean;
  onClose: () => void;
  onSaved: (folder: DocFolder) => void;
}

/** Make or change a folder: name, colour, and whether it is locked to named people. */
export default function FolderDialog({ folder, parentId, users, canLockAny, onClose, onSaved }: Props) {
  const [name, setName] = useState(folder?.name ?? '');
  const [color, setColor] = useState<FolderColor | null>(folder?.color ?? null);
  const [restricted, setRestricted] = useState(folder?.isRestricted ?? false);
  const [people, setPeople] = useState<string[] | null>(folder?.isRestricted ? null : []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mayLock = folder ? folder.canManageAccess : true;

  // Who is already let into a locked folder.
  useEffect(() => {
    if (!folder?.isRestricted || !folder.canManageAccess) return;
    let alive = true;
    docsService.folderAccess(folder.folderId)
      .then(ids => { if (alive) setPeople(ids); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [folder]);

  const togglePerson = (userId: string) => setPeople(prev => {
    const list = prev || [];
    return list.includes(userId) ? list.filter(u => u !== userId) : [...list, userId];
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the folder a name.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), parentId: folder ? folder.parentId : parentId, color, isRestricted: restricted };
      const saved = folder ? await docsService.updateFolder(folder.folderId, payload) : await docsService.createFolder(payload);
      if (restricted && mayLock && people) await docsService.setFolderAccess(saved.folderId, people);
      toast.success(folder ? 'Folder saved' : `Folder “${saved.name}” created`);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the folder. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={folder ? `Folder “${folder.name}”` : 'New folder'} onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <label className="wk-field">
          <span>Name</span>
          <input data-autofocus value={name} maxLength={150} onChange={e => setName(e.target.value)} placeholder="e.g. Meeting notes" />
        </label>

        <fieldset className="wk-typepick">
          <legend>Colour</legend>
          <div className="wk-typepick-row">
            <label className={`dc-colour ${color === null ? 'is-on' : ''}`}>
              <input type="radio" name="dc-colour" checked={color === null} onChange={() => setColor(null)} /><span>None</span>
            </label>
            {FOLDER_COLORS.map(c => (
              <label key={c} className={`dc-colour dc-colour-${c} ${color === c ? 'is-on' : ''}`}>
                <input type="radio" name="dc-colour" checked={color === c} onChange={() => setColor(c)} /><span>{c[0].toUpperCase() + c.slice(1)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {(mayLock || canLockAny) && (
          <div className="dc-lock">
            <label className="dc-check">
              <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} />
              <span><Lock size={15} aria-hidden="true" /> <strong>Sensitive folder</strong></span>
            </label>
            <p className="wk-hint">Only the people you tick can see this folder and everything in it. For everyone else it does not appear at all, not even in search.</p>
            {restricted && (
              people === null ? <p className="wk-muted">Loading who has access…</p> : (
                <fieldset className="dc-people">
                  <legend>Who can open it</legend>
                  {users.map(u => (
                    <label key={u.userId} className="dc-check">
                      <input type="checkbox" checked={people.includes(u.userId)} onChange={() => togglePerson(u.userId)} />
                      <span>{u.fullName}</span>
                    </label>
                  ))}
                  <p className="wk-hint">You, and anyone who manages sensitive documents, can always open it.</p>
                </fieldset>
              )
            )}
          </div>
        )}

        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={saving}>{saving ? 'Saving…' : folder ? 'Save' : 'Create folder'}</button>
        </div>
      </form>
    </Dialog>
  );
}
