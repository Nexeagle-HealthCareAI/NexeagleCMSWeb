import type {
  CreateItemPayload, ItemType, UpdateItemPayload, WorkComment, WorkHistoryEntry, WorkItem, WorkItemDetail, WorkProject, WorkUser,
} from '../types';
import { allowedParentTypes, parentRequired } from '../workMeta';

// In-memory stand-in used when VITE_WORK_MOCK=true. Example data only; resets on reload.
// It applies the same rules as the CMS API's WorkService, so the screens behave the same way.

interface Stored extends WorkItem { description: string | null; deleted?: boolean }

const ME = 'u-1';
const users: WorkUser[] = [
  { userId: 'u-1', fullName: 'Local reviewer', email: 'dev@localhost' },
  { userId: 'u-2', fullName: 'Asha Rao', email: 'asha@example.com' },
  { userId: 'u-3', fullName: 'Bilal Khan', email: 'bilal@example.com' },
];
const projects: WorkProject[] = [
  { projectId: 'p-hms', key: 'HMS', name: '1HMS', description: 'Hospital management software and EMR', sprintDays: 11, isArchived: false },
  { projectId: 'p-rad', key: 'RAD', name: '1Rad', description: 'Cloud PACS and radiology reporting', sprintDays: 11, isArchived: false },
  { projectId: 'p-web', key: 'WEB', name: 'NexEagle website', description: 'nexeagle.com', sprintDays: 11, isArchived: false },
];
const nextNumber: Record<string, number> = { 'p-hms': 1, 'p-rad': 1, 'p-web': 1 };
const items: Stored[] = [];
const comments: Record<string, WorkComment[]> = {};
const history: Record<string, WorkHistoryEntry[]> = {};
let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;
const nameOf = (userId: string | null) => users.find(u => u.userId === userId)?.fullName ?? null;
const fail = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { success: false, message } } });
const wait = <T,>(value: T): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), 60));

function log(itemId: string, field: string, oldValue: string | null, newValue: string | null) {
  (history[itemId] ||= []).unshift({ historyId: id('h'), actorName: nameOf(ME) || 'Someone', field, oldValue, newValue, createdAt: new Date().toISOString() });
}

function add(projectId: string, itemType: ItemType, title: string, extra: Partial<Stored> = {}): Stored {
  const project = projects.find(p => p.projectId === projectId)!;
  const number = nextNumber[projectId]++;
  const now = new Date().toISOString();
  const item: Stored = {
    workItemId: id('w'), projectId, key: `${project.key}-${number}`, number, itemType, title,
    status: 'ToDo', priority: 'Medium', storyPoints: null,
    assigneeUserId: null, assigneeName: null, reporterUserId: ME, reporterName: nameOf(ME),
    parentId: null, parentKey: null, parentTitle: null, parentType: null, sprintId: null,
    labels: [], dueDate: null, isBlocked: false, blockedReason: null,
    rank: items.length * 1000, childCount: 0, doneChildCount: 0,
    createdAt: now, updatedAt: now, completedAt: null, description: null,
    ...extra,
  };
  items.push(item);
  log(item.workItemId, 'created', null, itemType);
  return item;
}

// Example data.
(() => {
  const epic = add('p-hms', 'Epic', 'Faster billing at the counter', { priority: 'High', assigneeUserId: 'u-2' });
  const feature = add('p-hms', 'Feature', 'One-screen bill', { parentId: epic.workItemId, assigneeUserId: 'u-2', status: 'InProgress' });
  const story = add('p-hms', 'Story', 'Cashier adds lab tests to an OPD bill', {
    parentId: feature.workItemId, assigneeUserId: 'u-3', status: 'InProgress', storyPoints: 5, labels: ['billing'],
    description: 'The cashier should add lab tests **without leaving the bill**.\n\n- Search tests by name\n- Show the price before adding',
  });
  add('p-hms', 'Subtask', 'Search box for tests', { parentId: story.workItemId, assigneeUserId: 'u-3', status: 'Done' });
  add('p-hms', 'Subtask', 'Show price and tax', { parentId: story.workItemId, assigneeUserId: 'u-3' });
  add('p-hms', 'Bug', 'Bill total is wrong when a discount is 100%', {
    parentId: feature.workItemId, priority: 'Highest', assigneeUserId: 'u-1', isBlocked: true, blockedReason: 'Waiting for the tax rule from finance', dueDate: '2026-11-18',
  });
  add('p-hms', 'Task', 'Update the pharmacy price list import', { assigneeUserId: 'u-1', status: 'InReview', storyPoints: 2 });
  const radEpic = add('p-rad', 'Epic', 'Report drafting with Vita', { assigneeUserId: 'u-2' });
  add('p-rad', 'Story', 'Radiologist signs a drafted chest X-ray report', { parentId: radEpic.workItemId, storyPoints: 8 });
  add('p-web', 'Task', 'Add customer stories to the customers page', { priority: 'Low' });
  comments[story.workItemId] = [{ commentId: id('c'), authorUserId: 'u-2', authorName: 'Asha Rao', body: 'Design is in the Docs tab.', createdAt: new Date().toISOString() }];
})();

const live = () => items.filter(i => !i.deleted);

function view(item: Stored): WorkItem {
  const parent = item.parentId ? live().find(i => i.workItemId === item.parentId) : undefined;
  const children = live().filter(i => i.parentId === item.workItemId);
  const { description: _description, deleted: _deleted, ...rest } = item;
  void _description; void _deleted;
  return {
    ...rest,
    assigneeName: nameOf(item.assigneeUserId),
    parentKey: parent?.key ?? null, parentTitle: parent?.title ?? null, parentType: parent?.itemType ?? null,
    childCount: children.length, doneChildCount: children.filter(c => c.status === 'Done').length,
  };
}

function detail(item: Stored): WorkItemDetail {
  return {
    ...view(item),
    description: item.description,
    children: live().filter(i => i.parentId === item.workItemId).map(view),
    comments: [...(comments[item.workItemId] || [])],
    history: [...(history[item.workItemId] || [])],
  };
}

function find(itemId: string): Stored {
  const item = live().find(i => i.workItemId === itemId);
  if (!item) throw fail(404, 'Work item not found.');
  return item;
}

function checkParent(type: ItemType, projectId: string, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) {
    if (parentRequired(type)) throw fail(400, 'A subtask needs a parent story, task or bug.');
    return;
  }
  if (parentId === selfId) throw fail(400, 'An item cannot be its own parent.');
  const parent = live().find(i => i.workItemId === parentId);
  if (!parent || parent.projectId !== projectId) throw fail(400, 'The parent item was not found in this project.');
  const allowed = allowedParentTypes(type);
  if (!allowed.includes(parent.itemType)) {
    throw fail(400, allowed.length === 0
      ? `This ${type.toLowerCase()} cannot have a parent.`
      : `This ${type.toLowerCase()} can only sit under: ${allowed.join(', ').toLowerCase()}.`);
  }
}

export const mockWork = {
  projects: async () => wait([...projects]),
  createProject: async (p: { key: string; name: string; description?: string }) => {
    const key = p.key.trim().toUpperCase();
    if (!/^[A-Z]{2,10}$/.test(key)) throw fail(400, 'The project key must be 2 to 10 letters, for example HMS.');
    if (projects.some(x => x.key === key)) throw fail(409, `A project with the key ${key} already exists.`);
    const project: WorkProject = { projectId: id('p'), key, name: p.name.trim(), description: p.description?.trim() || null, sprintDays: 11, isArchived: false };
    projects.push(project);
    nextNumber[project.projectId] = 1;
    return wait(project);
  },
  users: async () => wait([...users]),
  items: async (projectId: string) => wait(live().filter(i => i.projectId === projectId).map(view)),
  item: async (itemId: string) => wait(detail(find(itemId))),
  createItem: async (p: CreateItemPayload) => {
    if (!p.title.trim()) throw fail(400, 'Give the item a title.');
    checkParent(p.itemType, p.projectId, p.parentId);
    const item = add(p.projectId, p.itemType, p.title.trim(), {
      description: p.description || null, priority: p.priority || 'Medium', storyPoints: p.storyPoints ?? null,
      assigneeUserId: p.assigneeUserId ?? null, parentId: p.parentId ?? null, labels: p.labels || [], dueDate: p.dueDate ?? null,
    });
    return wait(detail(item));
  },
  updateItem: async (itemId: string, p: UpdateItemPayload) => {
    const item = find(itemId);
    if (!p.title.trim()) throw fail(400, 'Give the item a title.');
    if (p.isBlocked && !p.blockedReason?.trim()) throw fail(400, 'Say what is blocking this item.');
    if (p.parentId !== item.parentId) checkParent(item.itemType, item.projectId, p.parentId, itemId);

    const keyOf = (pid: string | null) => live().find(i => i.workItemId === pid)?.key ?? null;
    if (item.title !== p.title.trim()) log(itemId, 'title', item.title, p.title.trim());
    if ((item.description || '') !== (p.description || '')) log(itemId, 'description', null, null);
    if (item.status !== p.status) log(itemId, 'status', item.status, p.status);
    if (item.priority !== p.priority) log(itemId, 'priority', item.priority, p.priority);
    if (item.storyPoints !== p.storyPoints) log(itemId, 'storyPoints', item.storyPoints?.toString() ?? null, p.storyPoints?.toString() ?? null);
    if (item.assigneeUserId !== p.assigneeUserId) log(itemId, 'assignee', nameOf(item.assigneeUserId), nameOf(p.assigneeUserId));
    if (item.parentId !== p.parentId) log(itemId, 'parent', keyOf(item.parentId), keyOf(p.parentId));
    if (item.labels.join(',') !== p.labels.join(',')) log(itemId, 'labels', item.labels.join(',') || null, p.labels.join(',') || null);
    if (item.dueDate !== p.dueDate) log(itemId, 'dueDate', item.dueDate, p.dueDate);
    if (item.isBlocked !== p.isBlocked || (item.blockedReason || '') !== (p.isBlocked ? p.blockedReason || '' : '')) {
      log(itemId, 'blocked', item.isBlocked ? item.blockedReason : null, p.isBlocked ? p.blockedReason : null);
    }

    const now = new Date().toISOString();
    Object.assign(item, {
      title: p.title.trim(), description: p.description || null, priority: p.priority, storyPoints: p.storyPoints,
      assigneeUserId: p.assigneeUserId, parentId: p.parentId, sprintId: p.sprintId, labels: [...p.labels], dueDate: p.dueDate,
      isBlocked: p.isBlocked, blockedReason: p.isBlocked ? p.blockedReason : null, updatedAt: now,
      completedAt: p.status === 'Done' ? (item.status === 'Done' ? item.completedAt : now) : null, status: p.status,
    });
    return wait(detail(item));
  },
  deleteItem: async (itemId: string) => {
    const item = find(itemId);
    const children = live().filter(i => i.parentId === itemId).length;
    if (children > 0) {
      throw fail(409, children === 1
        ? 'This item has 1 item under it. Move or delete that first.'
        : `This item has ${children} items under it. Move or delete those first.`);
    }
    item.deleted = true;
    await wait(undefined);
  },
  addComment: async (itemId: string, body: string) => {
    find(itemId);
    if (!body.trim()) throw fail(400, 'Write a comment first.');
    const comment: WorkComment = { commentId: id('c'), authorUserId: ME, authorName: nameOf(ME) || 'Someone', body: body.trim(), createdAt: new Date().toISOString() };
    (comments[itemId] ||= []).push(comment);
    return wait(comment);
  },
  deleteComment: async (commentId: string) => {
    for (const key of Object.keys(comments)) comments[key] = comments[key].filter(c => c.commentId !== commentId);
    await wait(undefined);
  },
};
