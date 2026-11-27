import { api } from '../../../services/api';
import { SOCIAL_MOCK } from '../access';
import type {
  AdLevel, InboxChannel, InboxView, MetaAssets, SocialAccount, SocialAds, SocialCalendarItem, SocialChecks, SocialComment,
  SocialConversation, SocialDraft, SocialDraftSave, SocialKeysSave, SocialLead, SocialLeadForm, SocialLeadPage, SocialLeadQuery,
  SocialMakeLead, SocialMediaRef, SocialMessage, SocialNote, SocialPerson, SocialPostDetail, SocialPostPage, SocialPostQuery,
  SocialSetup, SocialSlot, SocialThread,
} from '../types';
import { mockSocial } from './mockSocial';

// Social calls (CMS API: SocialController, /api/v1/social). Every answer is { success, data, message }.
const enc = encodeURIComponent;
const d = <T,>(r: { data: { data: T } }) => r.data.data;
const S = '/social';

const real = {
  accounts: async () => d<SocialAccount[]>(await api.get(`${S}/accounts`)),
  createAccount: async (name: string) => d<SocialSetup>(await api.post(`${S}/accounts`, { name })),
  setup: async (accountId: string) => d<SocialSetup>(await api.get(`${S}/accounts/${enc(accountId)}/setup`)),
  saveKeys: async (accountId: string, p: SocialKeysSave) => d<SocialSetup>(await api.put(`${S}/accounts/${enc(accountId)}/keys`, p, { timeout: 60_000 })),
  discover: async (accountId: string) => d<MetaAssets>(await api.get(`${S}/accounts/${enc(accountId)}/discover`, { timeout: 60_000 })),
  chooseAssets: async (accountId: string, p: { pageId?: string | null; adAccountId?: string | null }) =>
    d<SocialSetup>(await api.put(`${S}/accounts/${enc(accountId)}/assets`, p, { timeout: 60_000 })),
  checks: async (accountId: string) => d<SocialChecks>(await api.get(`${S}/accounts/${enc(accountId)}/checks`, { timeout: 60_000 })),
  connectWebhooks: async (accountId: string, url: string, replace = false) =>
    d<SocialChecks>(await api.post(`${S}/accounts/${enc(accountId)}/webhooks`, { url, replace }, { timeout: 90_000 })),
  sync: async (accountId: string, full = false) => (await api.post(`${S}/accounts/${enc(accountId)}/sync`, undefined, { params: full ? { full: true } : undefined })).data as { message?: string },

  posts: async (q: SocialPostQuery) => d<SocialPostPage>(await api.get(`${S}/posts`, { params: q })),
  post: async (postId: string) => d<SocialPostDetail>(await api.get(`${S}/posts/${enc(postId)}`)),

  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return d<SocialMediaRef>(await api.post(`${S}/media`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600_000 }));
  },
  /** A picture or video of a post, as a blob for previews. */
  media: async (key: string) => (await api.get(`${S}/media`, { params: { key }, responseType: 'blob', timeout: 120_000 })).data as Blob,
  drafts: async (accountId: string, status?: string) => d<SocialDraft[]>(await api.get(`${S}/drafts`, { params: { accountId, status } })),
  draft: async (draftId: string) => d<SocialDraft>(await api.get(`${S}/drafts/${enc(draftId)}`)),
  saveDraft: async (draftId: string | null, p: SocialDraftSave) =>
    d<SocialDraft>(draftId ? await api.put(`${S}/drafts/${enc(draftId)}`, p) : await api.post(`${S}/drafts`, p)),
  draftAction: async (draftId: string, action: 'submit' | 'approve' | 'cancel' | 'retry') =>
    (await api.post(`${S}/drafts/${enc(draftId)}/${action}`)).data as { data: SocialDraft; message?: string },
  sendBack: async (draftId: string, note: string) => d<SocialDraft>(await api.post(`${S}/drafts/${enc(draftId)}/send-back`, { note })),
  calendar: async (accountId: string, from: string, to: string) => d<SocialCalendarItem[]>(await api.get(`${S}/calendar`, { params: { accountId, from, to } })),
  slots: async (accountId: string) => d<SocialSlot[]>(await api.get(`${S}/slots`, { params: { accountId } })),
  saveSlots: async (accountId: string, slots: SocialSlot[]) => d<SocialSlot[]>(await api.put(`${S}/slots`, slots, { params: { accountId } })),
  approvers: async () => d<SocialPerson[]>(await api.get(`${S}/approvers`)),
  publishingLimit: async (accountId: string) => d<{ used: number; total: number } | null>(await api.get(`${S}/publishing-limit`, { params: { accountId }, timeout: 30_000 })),

  inbox: async (q: { accountId: string; channel?: InboxChannel; view?: InboxView; search?: string }) => d<SocialConversation[]>(await api.get(`${S}/inbox`, { params: q })),
  unread: async (accountId?: string) => d<number>(await api.get(`${S}/inbox/unread`, { params: accountId ? { accountId } : undefined })),
  agents: async () => d<SocialPerson[]>(await api.get(`${S}/inbox/agents`)),
  thread: async (contactId: string) => d<SocialThread>(await api.get(`${S}/inbox/dm/${enc(contactId)}`)),
  send: async (contactId: string, text?: string, file?: File | null) => {
    const form = new FormData();
    if (text) form.append('text', text);
    if (file) form.append('file', file);
    return d<SocialMessage>(await api.post(`${S}/inbox/dm/${enc(contactId)}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 }));
  },
  note: async (contactId: string, text: string) => d<SocialNote>(await api.post(`${S}/inbox/dm/${enc(contactId)}/notes`, { text })),
  assign: async (id: string, userId: string | null) => d<SocialConversation>(await api.put(`${S}/inbox/${enc(id)}/assign`, { userId })),
  setStatus: async (contactId: string, status: 'Open' | 'Closed') => d<SocialConversation>(await api.put(`${S}/inbox/dm/${enc(contactId)}/status`, { status })),
  leadFromChat: async (contactId: string, p: SocialMakeLead) => d<SocialLead>(await api.post(`${S}/inbox/dm/${enc(contactId)}/lead`, p)),
  comment: async (commentId: string) => d<SocialComment>(await api.get(`${S}/inbox/comments/${enc(commentId)}`)),
  replyToComment: async (commentId: string, text: string, isPrivate = false) =>
    d<SocialComment>(await api.post(`${S}/inbox/comments/${enc(commentId)}/reply`, { text, private: isPrivate })),
  hideComment: async (commentId: string, hidden: boolean) => d<SocialComment>(await api.put(`${S}/inbox/comments/${enc(commentId)}/hidden`, { hidden })),
  commentDone: async (commentId: string, done: boolean) => d<SocialComment>(await api.put(`${S}/inbox/comments/${enc(commentId)}/done`, undefined, { params: { done } })),
  leadFromComment: async (commentId: string, p: SocialMakeLead) => d<SocialLead>(await api.post(`${S}/inbox/comments/${enc(commentId)}/lead`, p)),

  leads: async (q: SocialLeadQuery) => d<SocialLeadPage>(await api.get(`${S}/leads`, { params: q })),
  checkForms: async (accountId: string) => d<SocialLeadForm[]>(await api.post(`${S}/leads/forms/check`, undefined, { params: { accountId }, timeout: 120_000 })),
  importMissing: async (accountId: string, formId: string) =>
    (await api.post(`${S}/leads/forms/${enc(formId)}/import`, undefined, { params: { accountId }, timeout: 120_000 })).data as { data: number; message?: string },

  ads: async (q: { accountId: string; from: string; to: string; level: AdLevel }) => d<SocialAds>(await api.get(`${S}/ads`, { params: q })),
};

export type SocialApi = typeof real;
export const socialService: SocialApi = SOCIAL_MOCK ? mockSocial : real;

/** The API's reason, in its own words. */
export function socialError(err: unknown): string {
  const r = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (r?.data && typeof r.data === 'object' && r.data.message) return r.data.message;
  if (r?.status === 403) return 'You do not have permission for this.';
  if (err instanceof Error && err.message && !r) return err.message;
  return 'Something went wrong. Please try again.';
}

/** The API's 409 status (e.g. webhooks point elsewhere; reply window closed). */
export const isConflict = (err: unknown): boolean => (err as { response?: { status?: number } })?.response?.status === 409;
