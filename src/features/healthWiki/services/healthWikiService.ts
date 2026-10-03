import { api } from '../../../services/api';
import { HEALTH_WIKI_MOCK } from '../access';
import type { ArticlePayload, DoctorOption, HealthArticle } from '../types';
import { mockHealthWiki } from './mockHealthWiki';

// Endpoints the CMS API will expose (not built yet; see VITE_HEALTH_WIKI_MOCK for local use).
const real = {
  list: async () => (await api.get('/health-articles')).data.data as HealthArticle[],
  get: async (slug: string) => (await api.get(`/health-articles/${encodeURIComponent(slug)}`)).data.data as HealthArticle,
  create: async (p: ArticlePayload) => (await api.post('/health-articles', p)).data.data as HealthArticle,
  update: async (slug: string, p: ArticlePayload) =>
    (await api.patch(`/health-articles/${encodeURIComponent(slug)}`, p)).data.data as HealthArticle,
  uploadImage: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const res = await api.post('/health-articles/images', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data.url as string;
  },
  listDoctors: async () => (await api.get('/health-articles/doctors')).data.data as DoctorOption[],
};

export const healthWikiService: typeof real = HEALTH_WIKI_MOCK ? mockHealthWiki : real;

/** Message to show for a failed call: the API's own message when it sends one. */
export const errorMessage = (e: unknown, fallback: string) => {
  const msg = (e as { response?: { data?: { message?: string } }; message?: string });
  return msg.response?.data?.message || msg.message || fallback;
};
