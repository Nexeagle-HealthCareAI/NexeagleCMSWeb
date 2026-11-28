import { api } from '../../../services/api';
import { KEYWORDS_MOCK } from '../access';
import type {
  ContentItem, ContentSave, KeywordDetail, KeywordOverview, KeywordPage, KeywordQuery, KeywordSetup, KeywordUpdate, SetupSave, Site, TopicDetail, TopicRow, TopicSave,
} from '../types';
import { mockKeywords } from './mockKeywords';

// Keywords calls (CMS API: KeywordsController, /api/v1/keywords). Every answer is { success, data, message }.
// Numbers come from the CMS's own daily collection, so these are quick; only "Run now" waits on Google.
const enc = encodeURIComponent;
const d = <T,>(r: { data: { data: T } }) => r.data.data;
const K = '/keywords';
const site = (s?: Site | '') => (s ? { site: s } : {});

const real = {
  overview: async (s?: Site | '') => d<KeywordOverview>(await api.get(`${K}/overview`, { params: site(s) })),
  list: async (q: KeywordQuery) => d<KeywordPage>(await api.get(K, { params: { ...q, site: q.site || undefined } })),
  keyword: async (id: string) => d<KeywordDetail>(await api.get(`${K}/${enc(id)}`)),
  updateKeyword: async (id: string, u: KeywordUpdate) => d<KeywordDetail>(await api.put(`${K}/${enc(id)}`, u)),

  topics: async (s?: Site | '', kind?: string) => d<TopicRow[]>(await api.get(`${K}/topics`, { params: { ...site(s), kind: kind || undefined } })),
  topic: async (id: string) => d<TopicDetail>(await api.get(`${K}/topics/${enc(id)}`)),
  createTopic: async (t: TopicSave) => d<TopicDetail>(await api.post(`${K}/topics`, t)),
  updateTopic: async (id: string, t: TopicSave) => d<TopicDetail>(await api.put(`${K}/topics/${enc(id)}`, t)),
  mergeTopic: async (id: string, into: string) => d<TopicDetail>(await api.post(`${K}/topics/${enc(id)}/merge/${enc(into)}`)),

  content: async (s?: Site | '', kind?: string) => d<ContentItem[]>(await api.get(`${K}/content`, { params: { ...site(s), kind: kind || undefined } })),
  createContent: async (c: ContentSave) => d<ContentItem>(await api.post(`${K}/content`, c)),
  updateContent: async (id: string, c: ContentSave) => d<ContentItem>(await api.put(`${K}/content/${enc(id)}`, c)),
  deleteContent: async (id: string) => { await api.delete(`${K}/content/${enc(id)}`); },

  setup: async () => d<KeywordSetup>(await api.get(`${K}/setup`)),
  saveSetup: async (s: SetupSave) => d<KeywordSetup>(await api.put(`${K}/setup`, s)),
  /** Collects now from one source (site, gsc, ads, planner) or all; Keyword Planner can take a few minutes. */
  run: async (source: string) => (await api.post(`${K}/run/${enc(source)}`, null, { timeout: 600_000 })).data as { data: Record<string, number>; message?: string },
};

export type KeywordsApi = typeof real;
export const keywordsService: KeywordsApi = KEYWORDS_MOCK ? mockKeywords : real;

/** The API's reason, in its own words. */
export function keywordsError(err: unknown): string {
  const r = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (r?.data && typeof r.data === 'object' && r.data.message) return r.data.message;
  if (r?.status === 403) return 'You do not have permission for this.';
  if (err instanceof Error && err.message && !r) return err.message;
  return 'Something went wrong. Please try again.';
}
