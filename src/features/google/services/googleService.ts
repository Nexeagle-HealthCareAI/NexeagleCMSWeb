import { api } from '../../../services/api';
import { GOOGLE_MOCK } from '../access';
import type {
  AdsLevel, GoogleAccount, GoogleAds, GoogleChecks, GoogleChoice, GoogleClientSave, GoogleDiscovery, GoogleLeadPage, GoogleLeadQuery,
  GoogleOutcome, GoogleOverview, GooglePageDetail, GooglePages, GoogleRange, GoogleSetup, GoogleTagSave,
} from '../types';
import { mockGoogle } from './mockGoogle';

// Google calls (CMS API: GoogleController, /api/v1/google). Every answer is { success, data, message }.
// Numbers are read live from Google (kept 10 minutes by the API), so the first open of a period can take a few seconds.
const enc = encodeURIComponent;
const d = <T,>(r: { data: { data: T } }) => r.data.data;
const G = '/google';
const A = (id: string) => `${G}/accounts/${enc(id)}`;
const SLOW = { timeout: 60_000 };

const real = {
  accounts: async () => d<GoogleAccount[]>(await api.get(`${G}/accounts`)),
  createAccount: async (name: string, site: string | null) => d<GoogleSetup>(await api.post(`${G}/accounts`, { name, site })),
  setup: async (id: string) => d<GoogleSetup>(await api.get(`${A(id)}/setup`)),
  saveClient: async (id: string, p: GoogleClientSave) => d<GoogleSetup>(await api.put(`${A(id)}/client`, p)),
  /** Google's sign-in page for this account; the browser comes back to returnUrl with ?google=connected|partial|error. */
  signIn: async (id: string, returnUrl: string) => d<string>(await api.post(`${A(id)}/signin`, { returnUrl })),
  discover: async (id: string) => d<GoogleDiscovery>(await api.get(`${A(id)}/discover`, SLOW)),
  choose: async (id: string, p: GoogleChoice) => d<GoogleSetup>(await api.put(`${A(id)}/choose`, p, SLOW)),
  saveTag: async (id: string, p: GoogleTagSave) => (await api.put(`${A(id)}/tag`, p)).data as { data: GoogleSetup; message?: string },
  newLeadKey: async (id: string) => d<GoogleSetup>(await api.post(`${A(id)}/lead-key`)),
  saveOutcomes: async (id: string, outcomes: GoogleOutcome[]) => d<GoogleSetup>(await api.put(`${A(id)}/outcomes`, outcomes)),
  checks: async (id: string) => d<GoogleChecks>(await api.get(`${A(id)}/checks`, SLOW)),

  overview: async (q: GoogleRange) => d<GoogleOverview>(await api.get(`${G}/overview`, { params: q, ...SLOW })),
  pages: async (q: GoogleRange) => d<GooglePages>(await api.get(`${G}/pages`, { params: q, ...SLOW })),
  page: async (q: GoogleRange, path: string) => d<GooglePageDetail>(await api.get(`${G}/pages/detail`, { params: { ...q, path }, ...SLOW })),
  ads: async (q: GoogleRange & { level: AdsLevel }) => d<GoogleAds>(await api.get(`${G}/ads`, { params: q, ...SLOW })),
  leads: async (q: GoogleLeadQuery) => d<GoogleLeadPage>(await api.get(`${G}/leads`, { params: q })),
};

export type GoogleApi = typeof real;
export const googleService: GoogleApi = GOOGLE_MOCK ? mockGoogle : real;

/** The API's reason, in its own words. */
export function googleError(err: unknown): string {
  const r = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (r?.data && typeof r.data === 'object' && r.data.message) return r.data.message;
  if (r?.status === 403) return 'You do not have permission for this.';
  if (err instanceof Error && err.message && !r) return err.message;
  return 'Something went wrong. Please try again.';
}
