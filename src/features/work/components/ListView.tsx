import { useEffect, useRef, useState } from 'react';
import { Ban, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import type { UpdateItemPayload, WorkItem, WorkStatus, WorkUser } from '../types';
import { DEFAULT_COLUMNS, LIST_COLUMNS, type ColumnKey } from '../listColumns';
import { formatDay, isDone, isOverdue, type TreeRow } from '../workMeta';
import { Avatar, PriorityMark, StatusPill, TypeIcon } from './parts';

interface Props {
  rows: TreeRow[];
  /** Items that passed the filters; the rest are only there as parents of a match. */
  shown: Set<string>;
  filtering: boolean;
  collapsed: Set<string>;
  columns: ColumnKey[];
  statuses: WorkStatus[];
  users: WorkUser[];
  openId: string | null;
  canEdit: boolean;
  onToggle: (itemId: string) => void;
  onOpen: (itemId: string) => void;
  /** Change fields of an item straight from the list. */
  onPatch: (item: WorkItem, patch: Partial<UpdateItemPayload>) => void;
}

const day = (iso: string) => formatDay(iso.slice(0, 10));

/** The list: one row per item, nested under its parent, with the columns the person chose. */
export default function ListView({ rows, shown, filtering, collapsed, columns, statuses, users, openId, canEdit, onToggle, onOpen, onPatch }: Props) {
  const has = (key: ColumnKey) => columns.includes(key);

  const cell = (key: ColumnKey, item: WorkItem) => {
    switch (key) {
      case 'status':
        return canEdit ? (
          <select className={`wk-status-select wk-status-${item.statusCategory.toLowerCase()}`} value={item.status} aria-label={`Status of ${item.key}`} onChange={e => onPatch(item, { status: e.target.value })}>
            {statuses.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            {!statuses.some(s => s.key === item.status) && <option value={item.status}>{item.statusName}</option>}
          </select>
        ) : <StatusPill name={item.statusName} category={item.statusCategory} />;
      case 'assignee':
        return (
          <span className="wk-person">
            <Avatar name={item.assigneeName} />
            {canEdit ? (
              <select className="wk-cell-select" value={item.assigneeUserId || ''} aria-label={`Assignee of ${item.key}`} onChange={e => onPatch(item, { assigneeUserId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                {item.assigneeUserId && !users.some(u => u.userId === item.assigneeUserId) && <option value={item.assigneeUserId}>{item.assigneeName || 'Former staff'}</option>}
              </select>
            ) : <span>{item.assigneeName || 'Unassigned'}</span>}
          </span>
        );
      case 'reporter':
        return item.reporterName ? <span className="wk-person"><Avatar name={item.reporterName} /><span>{item.reporterName}</span></span> : <span className="wk-none">–</span>;
      case 'priority':
        return <PriorityMark priority={item.priority} withLabel />;
      case 'startDate':
        return item.startDate ? formatDay(item.startDate) : <span className="wk-none">–</span>;
      case 'dueDate':
        if (!item.dueDate) return <span className="wk-none">–</span>;
        return isOverdue(item) ? <span className="wk-late" title="Past its due date">{formatDay(item.dueDate)}</span> : formatDay(item.dueDate);
      case 'labels':
        return item.labels.length > 0 ? <span className="wk-labels">{item.labels.map(l => <span key={l} className="wk-tag">{l}</span>)}</span> : <span className="wk-none">–</span>;
      case 'points':
        return item.storyPoints !== null ? <span className="wk-points">{item.storyPoints}</span> : <span className="wk-none">–</span>;
      case 'parent':
        return item.parentId && item.parentKey
          ? <button type="button" className="wk-link wk-parent-link" onClick={() => onOpen(item.parentId!)} title={item.parentTitle || undefined}>{item.parentKey}</button>
          : <span className="wk-none">–</span>;
      case 'created':
        return day(item.createdAt);
      case 'updated':
        return day(item.updatedAt);
    }
  };

  return (
    <div className="wk-table-wrap">
      <table className="wk-table" aria-label="Work items">
        <thead>
          <tr>
            <th scope="col" className="wk-th-work">Work</th>
            {LIST_COLUMNS.filter(c => has(c.key)).map(c => <th key={c.key} scope="col" className={`wk-col-${c.key}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, depth, hasChildren }) => {
            const closed = collapsed.has(item.workItemId) && !filtering;
            const dimmed = filtering && !shown.has(item.workItemId);
            return (
              <tr key={item.workItemId} className={`${openId === item.workItemId ? 'is-open' : ''} ${dimmed ? 'is-dim' : ''} ${isDone(item) ? 'is-done' : ''}`}>
                <th scope="row" className="wk-td-work">
                  <span className="wk-work" style={{ paddingLeft: depth * 22 }}>
                    {hasChildren ? (
                      <button type="button" className="wk-caret" onClick={() => onToggle(item.workItemId)} aria-expanded={!closed} aria-label={`${closed ? 'Show' : 'Hide'} items under ${item.key}`} disabled={filtering}>
                        {closed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                    ) : <span className="wk-caret" aria-hidden="true" />}
                    <TypeIcon type={item.itemType} />
                    <button type="button" className="wk-row-main" onClick={() => onOpen(item.workItemId)}>
                      <span className="wk-key">{item.key}</span>
                      <span className="wk-row-title">{item.title}</span>
                    </button>
                    {item.isBlocked && !isDone(item) && <span className="wk-tag is-blocked" title={item.blockedReason || 'Blocked'}><Ban size={12} aria-hidden="true" /> Blocked</span>}
                    {item.childCount > 0 && <span className="wk-tag" title="Items under this that are done">{item.doneChildCount}/{item.childCount}</span>}
                  </span>
                </th>
                {LIST_COLUMNS.filter(c => has(c.key)).map(c => <td key={c.key} className={`wk-col-${c.key}`}>{cell(c.key, item)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Columns" button: tick the columns the list should show. The choice is kept in this browser. */
export function ColumnPicker({ columns, onChange }: { columns: ColumnKey[]; onChange: (next: ColumnKey[]) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = (key: ColumnKey) => {
    const next = columns.includes(key) ? columns.filter(k => k !== key) : [...columns, key];
    onChange(LIST_COLUMNS.map(c => c.key).filter(k => next.includes(k)));
  };

  return (
    <div className="wk-menu" ref={box}>
      <button type="button" className="wk-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <Settings2 size={16} aria-hidden="true" /> Columns
      </button>
      {open && (
        <div className="wk-menu-list is-checks" role="group" aria-label="Columns to show">
          {LIST_COLUMNS.map(c => (
            <label key={c.key}>
              <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggle(c.key)} /> {c.label}
            </label>
          ))}
          <button type="button" className="wk-link" onClick={() => onChange(DEFAULT_COLUMNS)}>Reset to the usual columns</button>
        </div>
      )}
    </div>
  );
}
