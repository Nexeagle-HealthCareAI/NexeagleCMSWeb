import type {
  AccessAction, ChatChannel, ChatMessage, ChatState, SendMessagePayload, WorkNotification, ActivityQuery, GuardEvent, LastSeen, MyPresence, WorkActivity, WorkProjectAccess, CreateItemPayload, ItemType, StatusCategory, UpdateItemPayload, WorkComment, WorkHistoryEntry, WorkItem, WorkItemDetail, WorkProject, WorkStatus, WorkUser,
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
let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;
const startingStatuses = (): WorkStatus[] => [
  { statusId: id('s'), key: 'ToDo', name: 'To do', category: 'ToDo', sortOrder: 10 },
  { statusId: id('s'), key: 'InProgress', name: 'In progress', category: 'InProgress', sortOrder: 20 },
  { statusId: id('s'), key: 'InReview', name: 'In review', category: 'InProgress', sortOrder: 30 },
  { statusId: id('s'), key: 'Done', name: 'Done', category: 'Done', sortOrder: 40 },
];
const projects: WorkProject[] = [
  { projectId: 'p-hms', key: 'HMS', name: '1HMS', description: 'Hospital management software and EMR', sprintDays: 11, isArchived: false, isRestricted: false, statuses: startingStatuses() },
  { projectId: 'p-rad', key: 'RAD', name: '1Rad', description: 'Cloud PACS and radiology reporting', sprintDays: 11, isArchived: false, isRestricted: false, statuses: startingStatuses() },
  { projectId: 'p-web', key: 'WEB', name: 'NexEagle website', description: 'nexeagle.com', sprintDays: 11, isArchived: false, isRestricted: false, statuses: startingStatuses() },
];
const members: Record<string, string[]> = {};
const accessLog: Record<string, WorkProjectAccess['log']> = {};
// ── Team chat ──
interface StoredChannel { channelId: string; kind: ChatChannel['kind']; name: string; projectId: string | null; memberUserIds: string[] }
const channels: StoredChannel[] = [];
const messages: ChatMessage[] = [];
const readAt: Record<string, string> = {};
const notes: WorkNotification[] = [];
const boardChannel = (projectId: string): StoredChannel => {
  let c = channels.find(x => x.kind === 'Board' && x.projectId === projectId);
  if (!c) { c = { channelId: id('ch'), kind: 'Board', name: '', projectId, memberUserIds: [] }; channels.push(c); }
  return c;
};
/** Different every time, and always later than the one before, so "newer than" works within a millisecond. */
let lastStamp = 0;
const stamp = () => { lastStamp = Math.max(Date.now(), lastStamp + 1); return new Date(lastStamp).toISOString(); };
function post(channelId: string, authorUserId: string, p: SendMessagePayload, at = stamp()): ChatMessage {
  const item = p.workItemId ? items.find(i => i.workItemId === p.workItemId && !i.deleted) : undefined;
  const message: ChatMessage = {
    messageId: id('m'), channelId, authorUserId, authorName: nameOf(authorUserId) || 'Someone', body: p.body.trim(),
    isImportant: !!p.isImportant || !!p.isEscalation, isEscalation: !!p.isEscalation, isDeleted: false, mentionUserIds: p.mentionUserIds || [],
    workItemId: item?.workItemId ?? null, workItemKey: item?.key ?? null, workItemTitle: item?.title ?? null, createdAt: at,
  };
  messages.push(message);
  const channel = channels.find(c => c.channelId === channelId)!;
  const tell = (kind: WorkNotification['kind']) => notes.unshift({
    notificationId: id('n'), kind, channelId, channelName: channelView(channel).name, messageId: message.messageId,
    actorName: message.authorName, text: message.body.slice(0, 90), isRead: false, createdAt: at,
  });
  if (authorUserId !== ME) {
    if (message.mentionUserIds.includes(ME)) tell(message.isEscalation ? 'Escalation' : 'Mention');
    else if (channel.kind === 'Direct') tell('Direct');
  }
  return message;
}
function channelView(c: StoredChannel): ChatChannel {
  const project = c.projectId ? projects.find(p => p.projectId === c.projectId) : undefined;
  const other = c.kind === 'Direct' ? c.memberUserIds.find(u => u !== ME) ?? null : null;
  const own = messages.filter(m => m.channelId === c.channelId);
  const last = own[own.length - 1];
  const read = readAt[c.channelId];
  return {
    channelId: c.channelId, kind: c.kind, name: c.kind === 'Board' ? project?.name || 'Board' : c.kind === 'Direct' ? nameOf(other) || 'Direct message' : c.name,
    projectId: c.projectId, projectKey: project?.key ?? null, otherUserId: other, memberUserIds: [...c.memberUserIds],
    unread: own.filter(m => !m.isDeleted && m.authorUserId !== ME && (!read || m.createdAt > read)).length,
    lastMessageText: last ? (last.isDeleted ? 'Message removed' : last.body.slice(0, 90)) : null, lastMessageBy: last?.authorName ?? null, lastMessageAt: last?.createdAt ?? null,
  };
}
const visibleChannels = () => { projects.filter(p => !p.isArchived).forEach(p => boardChannel(p.projectId)); return channels; };
const channelOrder = (c: ChatChannel) => (c.kind === 'Board' ? 0 : c.kind === 'Group' ? 1 : 2);
const copyMessage = (m: ChatMessage): ChatMessage => (m.isDeleted
  ? { ...m, body: '', isImportant: false, isEscalation: false, mentionUserIds: [], workItemId: null, workItemKey: null, workItemTitle: null }
  : { ...m, mentionUserIds: [...m.mentionUserIds] });
/** The example teammate answers, so tagging and notifications can be tried without a second person. */
function teammateReplies(channelId: string, to: string) {
  setTimeout(() => { post(channelId, to, { body: `@${nameOf(ME)} got it, looking now.`, mentionUserIds: [ME] }); }, 1500);
}

const sessions: WorkActivity[] = [];
const visit: MyPresence = { openedAt: null, ip: '127.0.0.1', previousOpenedAt: new Date(Date.now() - 20 * 3600_000).toISOString(), previousIp: '127.0.0.1' };
const sessionRow = (action: string): WorkActivity => ({
  source: 'sessions', action, actorUserId: ME, actorName: nameOf(ME) || 'Someone', projectKey: null, workItemId: null, itemKey: null, itemTitle: null,
  documentId: null, documentName: null, oldValue: null, newValue: null, detail: '127.0.0.1 · this browser', createdAt: new Date().toISOString(),
});
const nextNumber: Record<string, number> = { 'p-hms': 1, 'p-rad': 1, 'p-web': 1 };
const items: Stored[] = [];
const comments: Record<string, WorkComment[]> = {};
const history: Record<string, WorkHistoryEntry[]> = {};
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
    status: 'ToDo', statusName: 'To do', statusCategory: 'ToDo', priority: 'Medium', storyPoints: null,
    assigneeUserId: null, assigneeName: null, reporterUserId: ME, reporterName: nameOf(ME),
    parentId: null, parentKey: null, parentTitle: null, parentType: null, sprintId: null,
    labels: [], startDate: null, dueDate: null, isBlocked: false, blockedReason: null,
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
    parentId: feature.workItemId, assigneeUserId: 'u-3', status: 'InProgress', storyPoints: 5, labels: ['billing'], startDate: '2026-11-16', dueDate: '2026-11-27',
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
const statusesOf = (projectId: string) => projects.find(p => p.projectId === projectId)?.statuses || [];
const statusOf = (item: Stored) => statusesOf(item.projectId).find(s => s.key === item.status);
const done = (item: Stored) => statusOf(item)?.category === 'Done';
const copy = (p: WorkProject): WorkProject => ({ ...p, statuses: [...p.statuses].sort((a, b) => a.sortOrder - b.sortOrder).map(s => ({ ...s })) });

function view(item: Stored): WorkItem {
  const parent = item.parentId ? live().find(i => i.workItemId === item.parentId) : undefined;
  const children = live().filter(i => i.parentId === item.workItemId);
  const { description: _description, deleted: _deleted, ...rest } = item;
  void _description; void _deleted;
  return {
    ...rest,
    assigneeName: nameOf(item.assigneeUserId),
    statusName: statusOf(item)?.name ?? item.status, statusCategory: statusOf(item)?.category ?? 'ToDo',
    parentKey: parent?.key ?? null, parentTitle: parent?.title ?? null, parentType: parent?.itemType ?? null,
    childCount: children.length, doneChildCount: children.filter(done).length,
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
  projects: async () => wait(projects.map(copy)),
  createProject: async (p: { key: string; name: string; description?: string }) => {
    const key = p.key.trim().toUpperCase();
    if (!/^[A-Z]{2,10}$/.test(key)) throw fail(400, 'The project key must be 2 to 10 letters, for example HMS.');
    if (projects.some(x => x.key === key)) throw fail(409, `A project with the key ${key} already exists.`);
    const project: WorkProject = { projectId: id('p'), key, name: p.name.trim(), description: p.description?.trim() || null, sprintDays: 11, isArchived: false, isRestricted: false, statuses: startingStatuses() };
    projects.push(project);
    nextNumber[project.projectId] = 1;
    return wait(copy(project));
  },
  chatState: async (channelId?: string, after?: string): Promise<ChatState> => wait({
    channels: visibleChannels().map(channelView).sort((x, y) => channelOrder(x) - channelOrder(y) || (x.projectKey || x.name).localeCompare(y.projectKey || y.name)),
    newMessages: channelId && after ? messages.filter(m => m.channelId === channelId && m.createdAt > after).map(copyMessage) : [],
    unreadNotifications: notes.filter(n => !n.isRead).length,
  }),
  chatMessages: async (channelId: string, q: { before?: string; important?: boolean } = {}): Promise<ChatMessage[]> => {
    if (!visibleChannels().some(c => c.channelId === channelId)) throw fail(404, 'Conversation not found.');
    const own = messages.filter(m => m.channelId === channelId && (!q.before || m.createdAt < q.before) && (!q.important || ((m.isImportant || m.isEscalation) && !m.isDeleted)));
    return wait(own.slice(-50).map(copyMessage));
  },
  sendMessage: async (channelId: string, p: SendMessagePayload): Promise<ChatMessage> => {
    const channel = visibleChannels().find(c => c.channelId === channelId);
    if (!channel) throw fail(404, 'Conversation not found.');
    if (!p.body.trim()) throw fail(400, 'Write a message first.');
    if (p.body.trim().length > 4000) throw fail(400, 'A message can be up to 4000 characters.');
    const tagged = (p.mentionUserIds || []).filter(u => u !== ME);
    if (p.isEscalation && tagged.length === 0) throw fail(400, 'Tag at least one person to escalate to.');
    if (channel.kind !== 'Board' && tagged.some(u => !channel.memberUserIds.includes(u))) throw fail(400, 'Someone you tagged is not in this conversation.');
    const message = post(channelId, ME, { ...p, mentionUserIds: tagged });
    readAt[channelId] = message.createdAt;
    if (p.isEscalation && message.workItemId) log(message.workItemId, 'escalated', null, tagged.map(nameOf).join(', '));
    const answerer = tagged[0] ?? (channel.kind === 'Direct' ? channel.memberUserIds.find(u => u !== ME) : undefined);
    if (answerer) teammateReplies(channelId, answerer);
    return wait(copyMessage(message));
  },
  markChannelRead: async (channelId: string) => {
    readAt[channelId] = stamp();
    notes.filter(n => n.channelId === channelId).forEach(n => { n.isRead = true; });
    await wait(null);
  },
  markImportant: async (messageId: string, isImportant: boolean): Promise<ChatMessage> => {
    const message = messages.find(m => m.messageId === messageId && !m.isDeleted);
    if (!message) throw fail(404, 'Message not found.');
    if (message.isEscalation && !isImportant) throw fail(400, 'An escalation always stays marked important.');
    message.isImportant = isImportant;
    return wait(copyMessage(message));
  },
  deleteMessage: async (messageId: string) => {
    const message = messages.find(m => m.messageId === messageId && !m.isDeleted);
    if (!message) throw fail(404, 'Message not found.');
    message.isDeleted = true;
    await wait(null);
  },
  createGroup: async (p: { name: string; memberUserIds: string[] }): Promise<ChatChannel> => {
    const others = p.memberUserIds.filter(u => u !== ME);
    if (!p.name.trim()) throw fail(400, 'Give the group a name.');
    if (others.length === 0) throw fail(400, 'Choose at least one other person.');
    const channel: StoredChannel = { channelId: id('ch'), kind: 'Group', name: p.name.trim(), projectId: null, memberUserIds: [ME, ...others] };
    channels.push(channel);
    return wait(channelView(channel));
  },
  openDirect: async (userId: string): Promise<ChatChannel> => {
    if (userId === ME) throw fail(400, 'Choose someone else to message.');
    let channel = channels.find(c => c.kind === 'Direct' && c.memberUserIds.includes(userId));
    if (!channel) { channel = { channelId: id('ch'), kind: 'Direct', name: '', projectId: null, memberUserIds: [ME, userId] }; channels.push(channel); }
    return wait(channelView(channel));
  },
  escalateItem: async (workItemId: string, p: { userIds: string[]; note?: string }): Promise<ChatMessage> => {
    const item = find(workItemId);
    return mockWork.sendMessage(boardChannel(item.projectId).channelId, { body: p.note?.trim() || 'This needs attention.', isEscalation: true, isImportant: true, mentionUserIds: p.userIds, workItemId });
  },
  notifications: async (): Promise<WorkNotification[]> => wait(notes.slice(0, 50).map(n => ({ ...n }))),
  readNotifications: async (notificationIds: string[] = []) => {
    notes.filter(n => notificationIds.length === 0 || notificationIds.includes(n.notificationId)).forEach(n => { n.isRead = true; });
    await wait(null);
  },
  touch: async (p: { opened?: boolean; event?: GuardEvent }): Promise<MyPresence> => {
    if (p.opened) { visit.openedAt = new Date().toISOString(); sessions.unshift(sessionRow('Opened')); }
    if (p.event) sessions.unshift(sessionRow(p.event));
    return wait({ ...visit });
  },
  lastSeen: async (): Promise<LastSeen[]> => wait([
    { userId: ME, lastSeenAt: new Date().toISOString(), isOnline: true },
    { userId: 'u-2', lastSeenAt: new Date(Date.now() - 40_000).toISOString(), isOnline: true },
    { userId: 'u-3', lastSeenAt: new Date(Date.now() - 26 * 3600_000).toISOString(), isOnline: false },
  ]),
  activity: async (q: ActivityQuery): Promise<WorkActivity[]> => {
    const rows: WorkActivity[] = [...sessions];
    const blank = { documentId: null, documentName: null, detail: null };
    for (const item of items) {
      const of = { projectKey: item.key.split('-')[0], workItemId: item.workItemId, itemKey: item.key, itemTitle: item.title };
      for (const h of history[item.workItemId] || []) {
        const actor = users.find(u => u.fullName === h.actorName);
        const quiet = h.field === 'description';
        rows.push({ source: 'items', action: h.field, actorUserId: actor?.userId ?? null, actorName: h.actorName, ...of, ...blank, oldValue: quiet ? null : h.oldValue, newValue: quiet ? null : h.newValue, createdAt: h.createdAt });
      }
      for (const c of comments[item.workItemId] || []) {
        rows.push({ source: 'comments', action: 'commented', actorUserId: c.authorUserId, actorName: c.authorName, ...of, ...blank, oldValue: null, newValue: null, createdAt: c.createdAt });
      }
    }
    for (const p of projects) {
      for (const l of accessLog[p.projectId] || []) {
        rows.push({ source: 'access', action: l.action, actorUserId: ME, actorName: l.actorName, projectKey: p.key, workItemId: null, itemKey: null, itemTitle: null, documentId: null, documentName: null, oldValue: null, newValue: null, detail: l.targetName, createdAt: l.createdAt });
      }
    }
    const projectKey = q.projectId ? projects.find(p => p.projectId === q.projectId)?.key : null;
    const kept = rows
      .filter(r => !q.userId || r.actorUserId === q.userId)
      .filter(r => !q.source || r.source === q.source)
      .filter(r => !q.projectId || r.projectKey === projectKey)
      .filter(r => !q.from || r.createdAt >= q.from)
      .filter(r => !q.before || r.createdAt < q.before)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return wait(kept.slice(0, q.take || 100));
  },
  projectAccess: async (projectId: string): Promise<WorkProjectAccess> => {
    const project = projects.find(x => x.projectId === projectId);
    if (!project) throw fail(404, 'Project not found.');
    return wait({ projectId, isRestricted: project.isRestricted, memberUserIds: [...(members[projectId] || [])], log: [...(accessLog[projectId] || [])] });
  },
  saveProjectAccess: async (projectId: string, p: { isRestricted: boolean; memberUserIds: string[] }): Promise<WorkProjectAccess> => {
    const project = projects.find(x => x.projectId === projectId);
    if (!project) throw fail(404, 'Project not found.');
    const before = members[projectId] || [];
    const entries = (accessLog[projectId] ||= []);
    const note = (action: AccessAction, userId: string | null) =>
      entries.unshift({ action, targetName: nameOf(userId), actorName: nameOf(ME) || 'Someone', createdAt: new Date().toISOString() });
    before.filter(u => !p.memberUserIds.includes(u)).forEach(u => note('MemberRemoved', u));
    p.memberUserIds.filter(u => !before.includes(u)).forEach(u => note('MemberAdded', u));
    if (project.isRestricted !== p.isRestricted) note(p.isRestricted ? 'Restricted' : 'Opened', null);
    members[projectId] = [...p.memberUserIds];
    project.isRestricted = p.isRestricted;
    return wait({ projectId, isRestricted: project.isRestricted, memberUserIds: [...members[projectId]], log: [...entries] });
  },
  addStatus: async (projectId: string, p: { name: string; category: StatusCategory }) => {
    const project = projects.find(x => x.projectId === projectId);
    if (!project) throw fail(404, 'Project not found.');
    const name = p.name.trim();
    if (!name) throw fail(400, 'Give the column a name.');
    if (project.statuses.some(s => s.name.toLowerCase() === name.toLowerCase())) throw fail(409, `There is already a column called ${name}.`);
    const base = name.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Column';
    let key = base;
    for (let n = 2; project.statuses.some(s => s.key.toLowerCase() === key.toLowerCase()); n++) key = `${base}${n}`;
    const status: WorkStatus = { statusId: id('s'), key, name, category: p.category, sortOrder: Math.max(0, ...project.statuses.map(s => s.sortOrder)) + 10 };
    project.statuses.push(status);
    return wait({ ...status });
  },
  updateStatus: async (statusId: string, p: { name: string; category: StatusCategory }) => {
    const project = projects.find(x => x.statuses.some(s => s.statusId === statusId));
    const status = project?.statuses.find(s => s.statusId === statusId);
    if (!project || !status) throw fail(404, 'Column not found.');
    const name = p.name.trim();
    if (!name) throw fail(400, 'Give the column a name.');
    if (project.statuses.some(s => s.statusId !== statusId && s.name.toLowerCase() === name.toLowerCase())) throw fail(409, `There is already a column called ${name}.`);
    if (status.category === 'Done' && p.category !== 'Done' && !project.statuses.some(s => s.statusId !== statusId && s.category === 'Done')) {
      throw fail(400, 'A board needs at least one column that means done.');
    }
    status.name = name;
    status.category = p.category;
    return wait({ ...status });
  },
  reorderStatuses: async (projectId: string, statusIds: string[]) => {
    const project = projects.find(x => x.projectId === projectId);
    if (!project) throw fail(404, 'Project not found.');
    statusIds.forEach((sid, i) => { const s = project.statuses.find(x => x.statusId === sid); if (s) s.sortOrder = (i + 1) * 10; });
    return wait(copy(project).statuses);
  },
  deleteStatus: async (statusId: string, moveTo?: string) => {
    const project = projects.find(x => x.statuses.some(s => s.statusId === statusId));
    const status = project?.statuses.find(s => s.statusId === statusId);
    if (!project || !status) throw fail(404, 'Column not found.');
    const others = project.statuses.filter(s => s.statusId !== statusId);
    if (others.length === 0) throw fail(400, 'A board needs at least one column.');
    if (status.category === 'Done' && !others.some(s => s.category === 'Done')) throw fail(400, 'A board needs at least one column that means done.');
    const inUse = live().filter(i => i.projectId === project.projectId && i.status === status.key);
    const target = others.find(s => s.key === moveTo);
    if (inUse.length > 0 && !target) throw fail(409, `${inUse.length} items are in this column. Choose a column to move them to.`);
    for (const i of items) if (i.projectId === project.projectId && i.status === status.key) i.status = (target ?? others[0]).key;
    project.statuses = others;
    await wait(undefined);
  },
  users: async () => wait([...users]),
  items: async (projectId: string) => wait(live().filter(i => i.projectId === projectId).map(view)),
  item: async (itemId: string) => wait(detail(find(itemId))),
  createItem: async (p: CreateItemPayload) => {
    if (!p.title.trim()) throw fail(400, 'Give the item a title.');
    checkParent(p.itemType, p.projectId, p.parentId);
    const item = add(p.projectId, p.itemType, p.title.trim(), {
      description: p.description || null, priority: p.priority || 'Medium', storyPoints: p.storyPoints ?? null,
      assigneeUserId: p.assigneeUserId ?? null, parentId: p.parentId ?? null, labels: p.labels || [], startDate: p.startDate ?? null, dueDate: p.dueDate ?? null,
      status: [...statusesOf(p.projectId)].sort((a, b) => a.sortOrder - b.sortOrder).find(s => s.category === 'ToDo')?.key ?? statusesOf(p.projectId)[0]?.key ?? 'ToDo',
    });
    return wait(detail(item));
  },
  updateItem: async (itemId: string, p: UpdateItemPayload) => {
    const item = find(itemId);
    if (!p.title.trim()) throw fail(400, 'Give the item a title.');
    if (p.isBlocked && !p.blockedReason?.trim()) throw fail(400, 'Say what is blocking this item.');
    if (p.parentId !== item.parentId) checkParent(item.itemType, item.projectId, p.parentId, itemId);
    const nextStatus = statusesOf(item.projectId).find(s => s.key === p.status);
    if (!nextStatus) throw fail(400, "Choose a status from the board's columns.");
    if (p.startDate && p.dueDate && p.startDate > p.dueDate) throw fail(400, 'The start date must be on or before the due date.');

    const keyOf = (pid: string | null) => live().find(i => i.workItemId === pid)?.key ?? null;
    if (item.title !== p.title.trim()) log(itemId, 'title', item.title, p.title.trim());
    if ((item.description || '') !== (p.description || '')) log(itemId, 'description', null, null);
    if (item.status !== p.status) log(itemId, 'status', statusOf(item)?.name ?? item.status, nextStatus.name);
    if (item.priority !== p.priority) log(itemId, 'priority', item.priority, p.priority);
    if (item.storyPoints !== p.storyPoints) log(itemId, 'storyPoints', item.storyPoints?.toString() ?? null, p.storyPoints?.toString() ?? null);
    if (item.assigneeUserId !== p.assigneeUserId) log(itemId, 'assignee', nameOf(item.assigneeUserId), nameOf(p.assigneeUserId));
    if (item.parentId !== p.parentId) log(itemId, 'parent', keyOf(item.parentId), keyOf(p.parentId));
    if (item.labels.join(',') !== p.labels.join(',')) log(itemId, 'labels', item.labels.join(',') || null, p.labels.join(',') || null);
    if (item.startDate !== p.startDate) log(itemId, 'startDate', item.startDate, p.startDate);
    if (item.dueDate !== p.dueDate) log(itemId, 'dueDate', item.dueDate, p.dueDate);
    if (item.isBlocked !== p.isBlocked || (item.blockedReason || '') !== (p.isBlocked ? p.blockedReason || '' : '')) {
      log(itemId, 'blocked', item.isBlocked ? item.blockedReason : null, p.isBlocked ? p.blockedReason : null);
    }

    const now = new Date().toISOString();
    Object.assign(item, {
      title: p.title.trim(), description: p.description || null, priority: p.priority, storyPoints: p.storyPoints,
      assigneeUserId: p.assigneeUserId, parentId: p.parentId, sprintId: p.sprintId, labels: [...p.labels], startDate: p.startDate, dueDate: p.dueDate,
      isBlocked: p.isBlocked, blockedReason: p.isBlocked ? p.blockedReason : null, updatedAt: now,
      completedAt: nextStatus.category === 'Done' ? (done(item) ? item.completedAt : now) : null, status: p.status,
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

// Example conversation, so the Chat tab is not empty on first open.
{
  const hms = boardChannel('p-hms').channelId;
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const story = items.find(i => i.itemType === 'Story');
  post(hms, 'u-2', { body: 'Morning all. The billing demo is on Friday at 3 pm.', isImportant: true }, ago(180));
  post(hms, 'u-3', { body: 'Noted. I will have the tax line fixed by Thursday.' }, ago(170));
  post(hms, 'u-2', { body: `@${nameOf(ME)} can you look at this one before stand-up?`, mentionUserIds: [ME], workItemId: story?.workItemId }, ago(12));
}
