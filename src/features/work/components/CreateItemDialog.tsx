import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { ItemPriority, ItemType, WorkItem, WorkItemDetail, WorkProject, WorkUser } from '../types';
import { allowedParentTypes, childTypesFor, ITEM_TYPES, parentRequired, PRIORITIES, TYPE_HINT } from '../workMeta';
import { errorMessage, workService } from '../services/workService';
import { Dialog } from './parts';

interface Props {
  project: WorkProject;
  items: WorkItem[];
  users: WorkUser[];
  /** When set, the new item goes under this one and only the types that fit are offered. */
  parent?: WorkItem | null;
  onClose: () => void;
  onCreated: (item: WorkItemDetail) => void;
}

export default function CreateItemDialog({ project, items, users, parent, onClose, onCreated }: Props) {
  const types = useMemo(() => (parent ? childTypesFor(parent.itemType) : ITEM_TYPES.filter(t => !parentRequired(t))), [parent]);
  const [itemType, setItemType] = useState<ItemType>(types.includes('Task') ? 'Task' : types[0]);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState(parent?.workItemId ?? '');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<ItemPriority>('Medium');
  const [points, setPoints] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parentTypes = allowedParentTypes(itemType);
  const parentChoices = useMemo(
    () => items.filter(i => parentTypes.includes(i.itemType)).sort((a, b) => a.number - b.number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, itemType],
  );

  const chooseType = (t: ItemType) => {
    setItemType(t);
    // Keep the chosen parent only while it still fits the new type.
    const current = items.find(i => i.workItemId === parentId);
    if (!current || !allowedParentTypes(t).includes(current.itemType)) setParentId('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Give the item a title.'); return; }
    if (parentRequired(itemType) && !parentId) { setError('Choose the story, task or bug this subtask belongs to.'); return; }
    const storyPoints = points.trim() === '' ? null : Number(points);
    if (storyPoints !== null && (Number.isNaN(storyPoints) || storyPoints < 0 || storyPoints > 999)) { setError('Story points must be a number from 0 to 999.'); return; }

    if (startDate && dueDate && startDate > dueDate) { setError('The start date must be on or before the due date.'); return; }

    setSaving(true);
    setError('');
    try {
      const created = await workService.createItem({
        projectId: project.projectId, itemType, title: title.trim(), priority, storyPoints,
        assigneeUserId: assignee || null, parentId: parentId || null, startDate: startDate || null, dueDate: dueDate || null,
      });
      toast.success(`${created.key} created`);
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the item. Try again.'));
      setSaving(false);
    }
  };

  return (
    <Dialog title={parent ? `New item under ${parent.key}` : `New item in ${project.name}`} onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <fieldset className="wk-typepick">
          <legend>Type</legend>
          <div className="wk-typepick-row">
            {types.map(t => (
              <label key={t} className={`wk-typepick-item ${itemType === t ? 'is-on' : ''}`}>
                <input type="radio" name="wk-type" value={t} checked={itemType === t} onChange={() => chooseType(t)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
          <p className="wk-hint">{TYPE_HINT[itemType]}</p>
        </fieldset>

        <label className="wk-field">
          <span>Title</span>
          <input data-autofocus value={title} onChange={e => setTitle(e.target.value)} maxLength={300} placeholder="What needs to be done?" />
        </label>

        {parentTypes.length > 0 && (
          <label className="wk-field">
            <span>Parent{parentRequired(itemType) ? '' : ' (optional)'}</span>
            <select value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">{parentRequired(itemType) ? 'Choose a parent' : 'No parent'}</option>
              {parentChoices.map(i => <option key={i.workItemId} value={i.workItemId}>{i.key} · {i.title}</option>)}
            </select>
          </label>
        )}

        <div className="wk-form-row">
          <label className="wk-field">
            <span>Assignee</span>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Priority</span>
            <select value={priority} onChange={e => setPriority(e.target.value as ItemPriority)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        <div className="wk-form-row">
          <label className="wk-field">
            <span>Start date (optional)</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Due date (optional)</span>
            <input type="date" value={dueDate} min={startDate || undefined} onChange={e => setDueDate(e.target.value)} />
          </label>
        </div>

        <label className="wk-field">
          <span>Story points (optional)</span>
          <input inputMode="decimal" value={points} onChange={e => setPoints(e.target.value)} placeholder="e.g. 3" />
        </label>

        {error && <p className="wk-error" role="alert">{error}</p>}

        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Dialog>
  );
}
