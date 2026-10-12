import { api } from '../../../services/api';
import { HEALTH_WIKI_MOCK } from '../access';
import { toast } from 'sonner';
import type { ArticlePayload, Contributor, HealthArticle, HistoryEntry, InviteContributorPayload, NavCounts, TopicDecision, TopicRequest } from '../types';
import { mockHealthWiki } from './mockHealthWiki';

// The CMS API passes the EasyHMS answer through unchanged. Lists come back wrapped ({ articles }), and a change to an article or a
// contributor comes back as a result that holds the saved record ({ article } or { contributor }, plus link and linkDelivered for
// links). The screens work with the plain records, so they are unwrapped here, in one place.
const enc = encodeURIComponent;
const unwrap = <T,>(d: unknown, key: string): T => ((d as Record<string, unknown> | null)?.[key] ?? d) as T;

/** A link result: the person's record plus the link, which the team must copy when WhatsApp did not deliver it. */
export type LinkResult = Contributor & { link?: string | null; linkDelivered?: boolean };
const withLink = (d: unknown): LinkResult => {
  const r = d as { link?: string | null; linkDelivered?: boolean } | null;
  return { ...unwrap<Contributor>(d, 'contributor'), link: r?.link ?? null, linkDelivered: r?.linkDelivered ?? false };
};

/** Tells the team the outcome of sending a link. When WhatsApp did not deliver it, the link is offered to copy and send by hand. */
export function announceLink(r: LinkResult, name: string) {
  if (r.linkDelivered || !r.link) {
    toast.success(`WhatsApp link sent to ${name}`);
    return;
  }
  const link = r.link;
  toast.warning(`WhatsApp did not deliver the link to ${name}. Copy it and send it yourself.`, {
    duration: Infinity,
    closeButton: true,
    action: { label: 'Copy link', onClick: () => { void navigator.clipboard?.writeText(link); toast.success('Link copied'); } },
  });
}
const real = {
  list: async () => unwrap<HealthArticle[]>((await api.get('/health-articles')).data.data, 'articles'),
  get: async (slug: string) => (await api.get(`/health-articles/${enc(slug)}`)).data.data as HealthArticle,
  create: async (p: ArticlePayload) => unwrap<HealthArticle>((await api.post('/health-articles', p)).data.data, 'article'),
  update: async (slug: string, p: ArticlePayload) => unwrap<HealthArticle>((await api.patch(`/health-articles/${enc(slug)}`, p)).data.data, 'article'),
  approveArticle: async (slug: string) => unwrap<HealthArticle>((await api.post(`/health-articles/${enc(slug)}/approve`)).data.data, 'article'),
  returnToDraft: async (slug: string, reason: string) =>
    unwrap<HealthArticle>((await api.post(`/health-articles/${enc(slug)}/withdraw`, { reason })).data.data, 'article'),
  uploadImage: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const res = await api.post('/health-articles/images', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data.url as string;
  },
  listContributors: async () => (await api.get('/health-wiki/contributors')).data.data as Contributor[],
  inviteContributor: async (p: InviteContributorPayload) => withLink((await api.post('/health-wiki/contributors/invite', p)).data.data),
  verifyContributor: async (id: string) => unwrap<Contributor>((await api.post(`/health-wiki/contributors/${enc(id)}/verify`)).data.data, 'contributor'),
  rejectContributor: async (id: string, reason: string) =>
    unwrap<Contributor>((await api.post(`/health-wiki/contributors/${enc(id)}/reject`, { reason })).data.data, 'contributor'),
  sendLink: async (id: string, articleSlug?: string) =>
    withLink((await api.post(`/health-wiki/contributors/${enc(id)}/send-link`, { articleSlug })).data.data),
  listConditions: async () => (await api.get('/health-wiki/conditions')).data.data as string[],
  articleHistory: async (slug: string) => (await api.get(`/health-articles/${enc(slug)}/history`)).data.data as HistoryEntry[],
  listTopicRequests: async () => (await api.get('/health-wiki/topic-requests')).data.data as TopicRequest[],
  getTopicRequest: async (id: string) => (await api.get(`/health-wiki/topic-requests/${enc(id)}`)).data.data as TopicRequest,
  decideTopicRequest: async (id: string, d: TopicDecision) => {
    const path = d.action === 'ACCEPT' ? 'accept' : d.action === 'DECLINE' ? 'decline' : 'ask-detail';
    const body = d.action === 'DECLINE' ? { reason: d.reason } : d.action === 'ASK_DETAIL' ? { message: d.message }
      : { ...(d.writerContributorId ? { writerContributorId: d.writerContributorId } : {}), ...(d.contentTeam ? { contentTeam: true } : {}) };
    return (await api.post(`/health-wiki/topic-requests/${enc(id)}/${path}`, body)).data.data as TopicRequest;
  },
  navCounts: async () => (await api.get('/health-wiki/summary')).data.data as NavCounts,
};

export const healthWikiService: typeof real = HEALTH_WIKI_MOCK ? mockHealthWiki : real;

/** Message to show for a failed call: the API's own message when it sends one. */
export const errorMessage = (e: unknown, fallback: string) => {
  const msg = e as { response?: { data?: { message?: string } }; message?: string };
  return msg.response?.data?.message || msg.message || fallback;
};
