import { api } from '../../../services/api';
import { HEALTH_WIKI_MOCK } from '../access';
import type { ArticlePayload, Contributor, HealthArticle, HistoryEntry, InviteContributorPayload, NavCounts, TopicDecision, TopicRequest } from '../types';
import { mockHealthWiki } from './mockHealthWiki';

// Endpoints the CMS API will expose (not built yet; see VITE_HEALTH_WIKI_MOCK for local use).
const enc = encodeURIComponent;
const real = {
  list: async () => (await api.get('/health-articles')).data.data as HealthArticle[],
  get: async (slug: string) => (await api.get(`/health-articles/${enc(slug)}`)).data.data as HealthArticle,
  create: async (p: ArticlePayload) => (await api.post('/health-articles', p)).data.data as HealthArticle,
  update: async (slug: string, p: ArticlePayload) => (await api.patch(`/health-articles/${enc(slug)}`, p)).data.data as HealthArticle,
  approveArticle: async (slug: string) => (await api.post(`/health-articles/${enc(slug)}/approve`)).data.data as HealthArticle,
  returnToDraft: async (slug: string, reason: string) =>
    (await api.post(`/health-articles/${enc(slug)}/withdraw`, { reason })).data.data as HealthArticle,
  uploadImage: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const res = await api.post('/health-articles/images', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data.url as string;
  },
  listContributors: async () => (await api.get('/health-wiki/contributors')).data.data as Contributor[],
  inviteContributor: async (p: InviteContributorPayload) => (await api.post('/health-wiki/contributors/invite', p)).data.data as Contributor,
  verifyContributor: async (id: string) => (await api.post(`/health-wiki/contributors/${enc(id)}/verify`)).data.data as Contributor,
  rejectContributor: async (id: string, reason: string) =>
    (await api.post(`/health-wiki/contributors/${enc(id)}/reject`, { reason })).data.data as Contributor,
  sendLink: async (id: string, articleSlug?: string) =>
    (await api.post(`/health-wiki/contributors/${enc(id)}/send-link`, { articleSlug })).data.data as Contributor,
  listConditions: async () => (await api.get('/health-wiki/conditions')).data.data as string[],
  articleHistory: async (slug: string) => (await api.get(`/health-articles/${enc(slug)}/history`)).data.data as HistoryEntry[],
  listTopicRequests: async () => (await api.get('/health-wiki/topic-requests')).data.data as TopicRequest[],
  getTopicRequest: async (id: string) => (await api.get(`/health-wiki/topic-requests/${enc(id)}`)).data.data as TopicRequest,
  decideTopicRequest: async (id: string, d: TopicDecision) => {
    const path = d.action === 'ACCEPT' ? 'accept' : d.action === 'DECLINE' ? 'decline' : 'ask-detail';
    const body = d.action === 'DECLINE' ? { reason: d.reason } : d.action === 'ASK_DETAIL' ? { message: d.message } : {};
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
