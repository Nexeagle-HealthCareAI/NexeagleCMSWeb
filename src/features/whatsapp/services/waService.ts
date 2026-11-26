import { api } from '../../../services/api';
import { WA_MOCK } from '../access';
import type {
  ChatView, WaAgent, WaBroadcast, WaBroadcastPreview, WaBroadcastRequest, WaChat, WaContact, WaContactPage, WaContactQuery,
  WaImportCommon, WaImportResult, WaImportRow, WaMessage, WaMetaSpendDay, WaNote, WaNumber, WaProfile, WaRate, WaRecipient,
  WaSaveContact, WaSaveTemplate, WaSettings, WaSpend, WaTemplate, WaThread,
} from '../types';
import { mockWa } from './mockWa';

// WhatsApp marketing calls (CMS API: WhatsAppController). Every answer is { success, data, message }.
const enc = encodeURIComponent;
const d = <T,>(r: { data: { data: T } }) => r.data.data;

const real = {
  chats: async (q: { view?: ChatView; search?: string; before?: string }) => d<WaChat[]>(await api.get('/whatsapp/chats', { params: q })),
  thread: async (contactId: string) => d<WaThread>(await api.get(`/whatsapp/chats/${enc(contactId)}`)),
  threadSince: async (contactId: string, after: string) => d<WaThread>(await api.get(`/whatsapp/chats/${enc(contactId)}/since`, { params: { after } })),
  sendText: async (contactId: string, text: string) => d<WaMessage>(await api.post(`/whatsapp/chats/${enc(contactId)}/text`, { text })),
  sendMedia: async (contactId: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return d<WaMessage>(await api.post(`/whatsapp/chats/${enc(contactId)}/media`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 }));
  },
  sendTemplate: async (contactId: string, p: { templateId: string; values: Record<string, string>; headerMediaUrl?: string }) =>
    d<WaMessage>(await api.post(`/whatsapp/chats/${enc(contactId)}/template`, p)),
  addNote: async (contactId: string, text: string) => d<WaNote>(await api.post(`/whatsapp/chats/${enc(contactId)}/notes`, { text })),
  assign: async (contactId: string, userId: string | null) => d<WaChat>(await api.put(`/whatsapp/chats/${enc(contactId)}/assign`, { userId })),
  setStatus: async (contactId: string, status: 'Open' | 'Closed') => d<WaChat>(await api.put(`/whatsapp/chats/${enc(contactId)}/status`, { status })),
  /** A picture/video/document in a message, as a blob for showing or saving. */
  media: async (messageId: string) => (await api.get(`/whatsapp/messages/${enc(messageId)}/media`, { responseType: 'blob', timeout: 120_000 })).data as Blob,
  unread: async () => d<number>(await api.get('/whatsapp/unread')),
  agents: async () => d<WaAgent[]>(await api.get('/whatsapp/agents')),

  contacts: async (q: WaContactQuery) => d<WaContactPage>(await api.get('/whatsapp/contacts', { params: q })),
  contact: async (id: string) => d<WaContact>(await api.get(`/whatsapp/contacts/${enc(id)}`)),
  createContact: async (p: WaSaveContact) => d<WaContact>(await api.post('/whatsapp/contacts', p)),
  updateContact: async (id: string, p: WaSaveContact) => d<WaContact>(await api.put(`/whatsapp/contacts/${enc(id)}`, p)),
  importRows: async (rows: WaImportRow[], c: WaImportCommon) => d<WaImportResult>(await api.post('/whatsapp/contacts/import', { rows, ...c }, { timeout: 120_000 })),
  importLeads: async (stages: string[], c: WaImportCommon) => d<WaImportResult>(await api.post('/whatsapp/contacts/import-leads', { stages, ...c }, { timeout: 120_000 })),
  importDoctorDekho: async (from: string, to: string, c: WaImportCommon) =>
    d<WaImportResult>(await api.post('/whatsapp/contacts/import-doctor-dekho', { from, to, ...c }, { timeout: 120_000 })),

  templates: async (refresh = false) => d<WaTemplate[]>(await api.get('/whatsapp/templates', { params: refresh ? { refresh: true } : undefined, timeout: 60_000 })),
  createTemplate: async (t: WaSaveTemplate, sample?: File | null) => {
    const form = new FormData();
    form.append('template', JSON.stringify(t));
    if (sample) form.append('sample', sample);
    return d<WaTemplate>(await api.post('/whatsapp/templates', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 }));
  },
  deleteTemplate: async (id: string) => { await api.delete(`/whatsapp/templates/${enc(id)}`); },

  broadcasts: async () => d<WaBroadcast[]>(await api.get('/whatsapp/broadcasts')),
  broadcast: async (id: string) => d<WaBroadcast>(await api.get(`/whatsapp/broadcasts/${enc(id)}`)),
  recipients: async (id: string, status?: string) => d<WaRecipient[]>(await api.get(`/whatsapp/broadcasts/${enc(id)}/recipients`, { params: status ? { status } : undefined })),
  preview: async (r: WaBroadcastRequest) => d<WaBroadcastPreview>(await api.post('/whatsapp/broadcasts/preview', r)),
  createBroadcast: async (r: WaBroadcastRequest) => d<WaBroadcast>(await api.post('/whatsapp/broadcasts', r)),
  broadcastAction: async (id: string, action: 'approve' | 'pause' | 'resume' | 'cancel') => d<WaBroadcast>(await api.post(`/whatsapp/broadcasts/${enc(id)}/${action}`)),

  number: async () => d<WaNumber>(await api.get('/whatsapp/number')),
  profile: async () => d<WaProfile>(await api.get('/whatsapp/profile')),
  saveProfile: async (p: WaProfile, picture?: File | null) => {
    const form = new FormData();
    form.append('profile', JSON.stringify(p));
    if (picture) form.append('picture', picture);
    return d<WaProfile>(await api.put('/whatsapp/profile', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }));
  },
  settings: async () => d<WaSettings>(await api.get('/whatsapp/settings')),
  saveSettings: async (p: { monthlyBudget?: number | null; sendPerSecond?: number; rates?: WaRate[] }) => d<WaSettings>(await api.put('/whatsapp/settings', p)),
  spend: async (from: string, to: string) => d<WaSpend>(await api.get('/whatsapp/spend', { params: { from, to } })),
  metaSpend: async (from: string, to: string) => d<WaMetaSpendDay[]>(await api.get('/whatsapp/spend/meta', { params: { from, to }, timeout: 60_000 })),
};

export type WaApi = typeof real;
export const waService: WaApi = WA_MOCK ? mockWa : real;

/** The API's reason, in its own words. */
export function waError(err: unknown): string {
  const r = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (r?.data && typeof r.data === 'object' && r.data.message) return r.data.message;
  if (r?.status === 403) return 'You do not have permission for this.';
  if (err instanceof Error && err.message && !r) return err.message;
  return 'Something went wrong. Please try again.';
}
