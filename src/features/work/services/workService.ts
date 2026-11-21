import { api } from '../../../services/api';
import { WORK_MOCK } from '../access';
import type { ChatChannel, ChatMessage, ChatState, SendMessagePayload, WorkNotification, ActivityQuery, GuardEvent, LastSeen, MyPresence, WorkActivity, WorkProjectAccess, CreateItemPayload, StatusCategory, UpdateItemPayload, WorkComment, WorkItem, WorkItemDetail, WorkProject, WorkStatus, WorkUser } from '../types';
import { mockWork } from './mockWork';

// Daily Work Board calls (CMS API: WorkController). Every answer is { success, data, message }.
const enc = encodeURIComponent;

const real = {
  projects: async () => (await api.get('/work/projects')).data.data as WorkProject[],
  createProject: async (p: { key: string; name: string; description?: string }) =>
    (await api.post('/work/projects', p)).data.data as WorkProject,
  // Who can open a board (work.members). Saving sends the whole state: the switch and every member.
  projectAccess: async (projectId: string) => (await api.get(`/work/projects/${enc(projectId)}/access`)).data.data as WorkProjectAccess,
  saveProjectAccess: async (projectId: string, p: { isRestricted: boolean; memberUserIds: string[] }) =>
    (await api.put(`/work/projects/${enc(projectId)}/access`, p)).data.data as WorkProjectAccess,
  // Called while the board is open (about once a minute). Answers with the caller's own sign-in details.
  touch: async (p: { opened?: boolean; event?: GuardEvent }) => (await api.post('/work/presence', p)).data.data as MyPresence,
  lastSeen: async () => (await api.get('/work/presence')).data.data as LastSeen[],
  /** The activity log, newest first (work.audit). */
  activity: async (q: ActivityQuery) => (await api.get('/work/activity', { params: q })).data.data as WorkActivity[],
  // Team chat (CMS API: WorkChatController). The open board asks chatState every few seconds.
  chatState: async (channelId?: string, after?: string) =>
    (await api.get('/work/chat/state', { params: channelId && after ? { channelId, after } : undefined })).data.data as ChatState,
  chatMessages: async (channelId: string, q: { before?: string; important?: boolean } = {}) =>
    (await api.get(`/work/chat/channels/${enc(channelId)}/messages`, { params: q })).data.data as ChatMessage[],
  sendMessage: async (channelId: string, p: SendMessagePayload) =>
    (await api.post(`/work/chat/channels/${enc(channelId)}/messages`, p)).data.data as ChatMessage,
  markChannelRead: async (channelId: string) => { await api.post(`/work/chat/channels/${enc(channelId)}/read`); },
  markImportant: async (messageId: string, isImportant: boolean) =>
    (await api.put(`/work/chat/messages/${enc(messageId)}/important`, { isImportant })).data.data as ChatMessage,
  deleteMessage: async (messageId: string) => { await api.delete(`/work/chat/messages/${enc(messageId)}`); },
  createGroup: async (p: { name: string; memberUserIds: string[] }) => (await api.post('/work/chat/groups', p)).data.data as ChatChannel,
  openDirect: async (userId: string) => (await api.post('/work/chat/direct', { userId })).data.data as ChatChannel,
  /** Posts in the item's board conversation, tags these people and notifies them. */
  escalateItem: async (workItemId: string, p: { userIds: string[]; note?: string }) =>
    (await api.post(`/work/items/${enc(workItemId)}/escalate`, p)).data.data as ChatMessage,
  notifications: async () => (await api.get('/work/notifications')).data.data as WorkNotification[],
  /** No ids: every notification. */
  readNotifications: async (notificationIds: string[] = []) => { await api.post('/work/notifications/read', { notificationIds }); },
  // Board columns. They come back with each project; these change them (work.manage).
  addStatus: async (projectId: string, p: { name: string; category: StatusCategory }) =>
    (await api.post(`/work/projects/${enc(projectId)}/statuses`, p)).data.data as WorkStatus,
  updateStatus: async (statusId: string, p: { name: string; category: StatusCategory }) =>
    (await api.put(`/work/statuses/${enc(statusId)}`, p)).data.data as WorkStatus,
  reorderStatuses: async (projectId: string, statusIds: string[]) =>
    (await api.put(`/work/projects/${enc(projectId)}/statuses/order`, { statusIds })).data.data as WorkStatus[],
  /** moveTo: key of the column that takes this column's items. */
  deleteStatus: async (statusId: string, moveTo?: string) => { await api.delete(`/work/statuses/${enc(statusId)}`, { params: moveTo ? { moveTo } : undefined }); },
  users: async () => (await api.get('/work/users')).data.data as WorkUser[],
  items: async (projectId: string) => (await api.get('/work/items', { params: { projectId } })).data.data as WorkItem[],
  item: async (id: string) => (await api.get(`/work/items/${enc(id)}`)).data.data as WorkItemDetail,
  createItem: async (p: CreateItemPayload) => (await api.post('/work/items', p)).data.data as WorkItemDetail,
  updateItem: async (id: string, p: UpdateItemPayload) => (await api.put(`/work/items/${enc(id)}`, p)).data.data as WorkItemDetail,
  deleteItem: async (id: string) => { await api.delete(`/work/items/${enc(id)}`); },
  addComment: async (id: string, body: string) => (await api.post(`/work/items/${enc(id)}/comments`, { body })).data.data as WorkComment,
  deleteComment: async (commentId: string) => { await api.delete(`/work/comments/${enc(commentId)}`); },
};

export type WorkApi = typeof real;

export const workService: WorkApi = WORK_MOCK ? mockWork : real;

/** The API's own message when it gave one, otherwise the fallback. */
export function errorMessage(e: unknown, fallback: string): string {
  const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
