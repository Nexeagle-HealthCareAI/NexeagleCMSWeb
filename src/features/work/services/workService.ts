import { api } from '../../../services/api';
import { WORK_MOCK } from '../access';
import type { CreateItemPayload, UpdateItemPayload, WorkComment, WorkItem, WorkItemDetail, WorkProject, WorkUser } from '../types';
import { mockWork } from './mockWork';

// Daily Work Board calls (CMS API: WorkController). Every answer is { success, data, message }.
const enc = encodeURIComponent;

const real = {
  projects: async () => (await api.get('/work/projects')).data.data as WorkProject[],
  createProject: async (p: { key: string; name: string; description?: string }) =>
    (await api.post('/work/projects', p)).data.data as WorkProject,
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
