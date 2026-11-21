import { api } from '../../../services/api';
import { WORK_MOCK } from '../access';
import type { Doc, DocBin, DocComment, DocDetail, DocFolder, DocLogEntry, DocNotification, SaveCommentPayload, SaveFolderPayload } from './types';
import { mockDocs } from './mockDocs';

// Docs tab calls (CMS API: DocsController). Every answer is { success, data, message }.
const enc = encodeURIComponent;

const real = {
  folders: async () => (await api.get('/docs/folders')).data.data as DocFolder[],
  createFolder: async (p: SaveFolderPayload) => (await api.post('/docs/folders', p)).data.data as DocFolder,
  updateFolder: async (id: string, p: SaveFolderPayload) => (await api.put(`/docs/folders/${enc(id)}`, p)).data.data as DocFolder,
  folderAccess: async (id: string) => (await api.get(`/docs/folders/${enc(id)}/access`)).data.data as string[],
  setFolderAccess: async (id: string, userIds: string[]) => (await api.put(`/docs/folders/${enc(id)}/access`, { userIds })).data.data as string[],
  deleteFolder: async (id: string) => { await api.delete(`/docs/folders/${enc(id)}`); },
  restoreFolder: async (id: string) => { await api.post(`/docs/folders/${enc(id)}/restore`); },

  /** One folder's documents (null: the top level), or a search across everything the reader may see. */
  list: async (folderId: string | null, search?: string) =>
    (await api.get('/docs', { params: search ? { search } : folderId ? { folderId } : undefined })).data.data as Doc[],
  get: async (id: string) => (await api.get(`/docs/${enc(id)}`)).data.data as DocDetail,
  createPage: async (name: string, folderId: string | null) => (await api.post('/docs/pages', { name, folderId })).data.data as DocDetail,
  savePage: async (id: string, content: string, contentText: string) =>
    (await api.put(`/docs/${enc(id)}/content`, { content, contentText })).data.data as DocDetail,
  update: async (id: string, p: { name: string; folderId: string | null; tags: string[] }) =>
    (await api.put(`/docs/${enc(id)}`, p)).data.data as DocDetail,
  upload: async (file: File, folderId: string | null) => {
    const body = new FormData();
    body.append('file', file);
    if (folderId) body.append('folderId', folderId);
    // A large file on a slow line needs longer than the usual 15 seconds.
    return (await api.post('/docs/upload', body, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 })).data.data as DocDetail;
  },
  /** The file's bytes. versionId gives an earlier version. */
  file: async (id: string, versionId?: string) =>
    (await api.get(`/docs/${enc(id)}/file`, { params: versionId ? { versionId } : undefined, responseType: 'blob', timeout: 180_000 })).data as Blob,
  remove: async (id: string) => { await api.delete(`/docs/${enc(id)}`); },
  restore: async (id: string) => { await api.post(`/docs/${enc(id)}/restore`); },
  bin: async () => (await api.get('/docs/bin')).data.data as DocBin,
  log: async (id: string) => (await api.get(`/docs/${enc(id)}/log`)).data.data as DocLogEntry[],

  // Comments (CMS API: DocCommentsController). Oldest first; a reply carries its thread's parentId.
  comments: async (documentId: string) => (await api.get(`/docs/${enc(documentId)}/comments`)).data.data as DocComment[],
  addComment: async (documentId: string, p: SaveCommentPayload) => (await api.post(`/docs/${enc(documentId)}/comments`, p)).data.data as DocComment,
  editComment: async (commentId: string, p: SaveCommentPayload) => (await api.put(`/docs/comments/${enc(commentId)}`, p)).data.data as DocComment,
  removeComment: async (commentId: string) => { await api.delete(`/docs/comments/${enc(commentId)}`); },
  resolveComment: async (commentId: string, isResolved: boolean) =>
    (await api.put(`/docs/comments/${enc(commentId)}/resolved`, { isResolved })).data.data as DocComment,
  commentNotifications: async () => (await api.get('/docs/notifications')).data.data as DocNotification[],
  /** No ids: every notification. */
  readCommentNotifications: async (notificationIds: string[] = []) => { await api.post('/docs/notifications/read', { notificationIds }); },

  itemDocuments: async (workItemId: string) => (await api.get(`/docs/items/${enc(workItemId)}`)).data.data as Doc[],
  link: async (workItemId: string, documentId: string) => { await api.post(`/docs/items/${enc(workItemId)}`, { documentId }); },
  unlink: async (workItemId: string, documentId: string) => { await api.delete(`/docs/items/${enc(workItemId)}/${enc(documentId)}`); },
};

export type DocsApi = typeof real;

export const docsService: DocsApi = WORK_MOCK ? mockDocs : real;
