import type { ItemPriority, ItemType, StatusCategory, UpdateItemPayload, WorkItem, WorkItemDetail } from './types';

// Names, order and rules shared by the board's screens. The hierarchy rules repeat WorkRules in the
// CMS API, so a wrong choice is stopped in the form before the API has to refuse it.

export const ITEM_TYPES: ItemType[] = ['Epic', 'Feature', 'Story', 'Task', 'Bug', 'Subtask'];
export const PRIORITIES: ItemPriority[] = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export const CATEGORIES: StatusCategory[] = ['ToDo', 'InProgress', 'Done'];
export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  ToDo: 'Not started',
  InProgress: 'Under way',
  Done: 'Finished',
};
export const isDone = (item: Pick<WorkItem, 'statusCategory'>): boolean => item.statusCategory === 'Done';

export const TYPE_HINT: Record<ItemType, string> = {
  Epic: 'A large goal that takes several sprints',
  Feature: 'A piece of the product, inside an epic',
  Story: 'Something a user can do when it is finished',
  Task: 'A job for the team',
  Bug: 'Something that is broken',
  Subtask: 'One step of a story, task or bug',
};

/** Parent types a child type may sit under. Empty: no parent allowed. */
export function allowedParentTypes(child: ItemType): ItemType[] {
  switch (child) {
    case 'Epic': return [];
    case 'Feature': return ['Epic'];
    case 'Story':
    case 'Task':
    case 'Bug': return ['Feature', 'Epic'];
    case 'Subtask': return ['Story', 'Task', 'Bug'];
  }
}

export const parentRequired = (child: ItemType): boolean => child === 'Subtask';

/** Types that can be created under a parent of this type. */
export function childTypesFor(parent: ItemType): ItemType[] {
  return ITEM_TYPES.filter(t => allowedParentTypes(t).includes(parent));
}

/** Level in the hierarchy, 0 at the top. */
export function levelOf(type: ItemType): number {
  if (type === 'Epic') return 0;
  if (type === 'Feature') return 1;
  if (type === 'Subtask') return 3;
  return 2;
}

export interface TreeRow {
  item: WorkItem;
  depth: number;
  hasChildren: boolean;
}

/**
 * Rows for the list, parents above their children. `shown` is the set of items that passed the
 * filters; an item that did not pass still appears when something under it did, so a match is never
 * shown without its place in the hierarchy. Children of a collapsed item are left out.
 */
export function buildTree(all: WorkItem[], shown: Set<string>, collapsed: Set<string>): TreeRow[] {
  const byParent = new Map<string | null, WorkItem[]>();
  const ids = new Set(all.map(i => i.workItemId));
  for (const item of all) {
    // A parent that is missing (deleted, or in another project) leaves the item at the top.
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    const list = byParent.get(parent);
    if (list) list.push(item); else byParent.set(parent, [item]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.rank - b.rank || a.number - b.number);

  const keep = new Map<string, boolean>();
  const visible = (item: WorkItem): boolean => {
    const known = keep.get(item.workItemId);
    if (known !== undefined) return known;
    const result = shown.has(item.workItemId) || (byParent.get(item.workItemId) || []).some(visible);
    keep.set(item.workItemId, result);
    return result;
  };

  const rows: TreeRow[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const item of byParent.get(parent) || []) {
      if (!visible(item)) continue;
      const children = (byParent.get(item.workItemId) || []).filter(visible);
      rows.push({ item, depth, hasChildren: children.length > 0 });
      if (children.length > 0 && !collapsed.has(item.workItemId)) walk(item.workItemId, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

/** The editable fields of an item, as the API's update call wants them. */
export function toUpdatePayload(item: WorkItemDetail): UpdateItemPayload {
  return {
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    storyPoints: item.storyPoints,
    assigneeUserId: item.assigneeUserId,
    parentId: item.parentId,
    sprintId: item.sprintId,
    labels: item.labels,
    startDate: item.startDate,
    dueDate: item.dueDate,
    isBlocked: item.isBlocked,
    blockedReason: item.blockedReason,
  };
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "3 Dec" or "3 Dec 2027" when the year is not this one. */
export function formatDay(isoDay: string | null): string {
  if (!isoDay) return '';
  const d = new Date(isoDay.length === 10 ? `${isoDay}T00:00:00` : isoDay);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Past its due date and not finished. */
export function isOverdue(item: WorkItem, today: Date = new Date()): boolean {
  if (!item.dueDate || isDone(item)) return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(`${item.dueDate}T00:00:00`) < start;
}

const FIELD_LABEL: Record<string, string> = {
  title: 'the title', description: 'the description', status: 'the status', priority: 'the priority',
  storyPoints: 'the story points', assignee: 'the assignee', parent: 'the parent', sprint: 'the sprint',
  labels: 'the labels', startDate: 'the start date', dueDate: 'the due date', blocked: 'the blocked flag',
};

/** One history row as a sentence ending: "changed the status from To do to In progress". */
export function describeChange(field: string, oldValue: string | null, newValue: string | null): string {
  if (field === 'created') return `created this ${(newValue || 'item').toLowerCase()}`;
  if (field === 'deleted') return 'deleted this item';
  if (field === 'description') return 'changed the description';
  const name = FIELD_LABEL[field] || field;
  if (field === 'blocked') return newValue ? `marked this blocked: ${newValue}` : 'removed the blocked flag';
  if (oldValue && newValue) return `changed ${name} from ${oldValue} to ${newValue}`;
  if (newValue) return `set ${name} to ${newValue}`;
  return `cleared ${name}`;
}
