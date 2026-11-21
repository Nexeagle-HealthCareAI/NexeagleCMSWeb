// The columns of the list view. "Work" (type, key and title) is always shown; people choose the rest.

export type ColumnKey = 'status' | 'assignee' | 'reporter' | 'priority' | 'startDate' | 'dueDate' | 'labels' | 'points' | 'parent' | 'created' | 'updated';

export const LIST_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'reporter', label: 'Reporter' },
  { key: 'priority', label: 'Priority' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'labels', label: 'Labels' },
  { key: 'points', label: 'Story points' },
  { key: 'parent', label: 'Parent' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
];

export const DEFAULT_COLUMNS: ColumnKey[] = ['status', 'assignee', 'priority', 'startDate', 'dueDate', 'labels'];

const STORE = 'wk.columns';

/** The person's saved choice, in the list's own order; the default when nothing valid is saved. */
export function loadColumns(): ColumnKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (Array.isArray(saved)) return LIST_COLUMNS.map(c => c.key).filter(k => saved.includes(k));
  } catch { /* unreadable or blocked storage: fall through */ }
  return DEFAULT_COLUMNS;
}

export function saveColumns(columns: ColumnKey[]): void {
  try { localStorage.setItem(STORE, JSON.stringify(columns)); } catch { /* nothing to keep */ }
}
