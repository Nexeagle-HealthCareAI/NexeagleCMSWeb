import type { ContentKind, Lang, Opportunity, Site, Stage } from './types';

// Labels and small formatting helpers for Keywords.

export const SITES: { id: Site; label: string }[] = [
  { id: 'doctordekho', label: 'Doctor Dekho' },
  { id: 'nexeagle', label: 'nexeagle.com' },
];
export const siteLabel = (s: string) => SITES.find(x => x.id === s)?.label ?? s;

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hg', label: 'Hinglish' },
  { id: 'hi', label: 'Hindi' },
  { id: 'bn', label: 'Bengali' },
  { id: 'other', label: 'Other' },
];
export const langLabel = (l: string) => LANGS.find(x => x.id === l)?.label ?? l;
/** The languages content is written in. */
export const CONTENT_LANGS = LANGS.filter(l => l.id !== 'other');

export const INTENTS: { id: string; label: string; site?: Site }[] = [
  { id: 'doctor', label: 'Find a doctor', site: 'doctordekho' },
  { id: 'nearme', label: 'Near me', site: 'doctordekho' },
  { id: 'info', label: 'Health information', site: 'doctordekho' },
  { id: 'cost', label: 'Cost' },
  { id: 'hospital', label: 'Hospital', site: 'doctordekho' },
  { id: 'lab', label: 'Lab test', site: 'doctordekho' },
  { id: 'software', label: 'Buy software', site: 'nexeagle' },
  { id: 'howto', label: 'How-to', site: 'nexeagle' },
  { id: 'brand', label: 'Our name' },
  { id: 'other', label: 'Other' },
];
export const intentLabel = (i: string) => INTENTS.find(x => x.id === i)?.label ?? i;

export const SOURCES: { id: string; label: string }[] = [
  { id: 'gsc', label: 'Search Console' },
  { id: 'planner', label: 'Keyword Planner' },
  { id: 'site', label: 'Our site searches' },
  { id: 'ads', label: 'Ads search terms' },
];
export const sourceLabel = (s: string) => SOURCES.find(x => x.id === s)?.label ?? s;

export const OPPORTUNITIES: Record<Opportunity, { label: string; action: string }> = {
  close: { label: 'Close to page one', action: 'Improve the page' },
  gap: { label: 'No page yet', action: 'Plan a page' },
  lang: { label: 'Language gap', action: 'Add the language' },
  ctr: { label: 'Seen, not clicked', action: 'Rewrite title and description' },
  rising: { label: 'Rising', action: 'Write about it now' },
};

export const KINDS: { id: ContentKind; label: string; site?: Site }[] = [
  { id: 'page', label: 'Page update' },
  { id: 'article', label: 'Health Wiki article', site: 'doctordekho' },
  { id: 'guide', label: 'nexeagle.com guide', site: 'nexeagle' },
  { id: 'social', label: 'Social post' },
  { id: 'whatsapp', label: 'WhatsApp message' },
  { id: 'ad', label: 'Ad text' },
];
export const kindLabel = (k: string) => KINDS.find(x => x.id === k)?.label ?? k;

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'brief', label: 'Brief' },
  { id: 'writing', label: 'Writing' },
  { id: 'review', label: 'Review' },
  { id: 'ready', label: 'Ready' },
  { id: 'published', label: 'Published' },
];
export const stageLabel = (s: string) => STAGES.find(x => x.id === s)?.label ?? s;

/** Checks before publishing; health content (Doctor Dekho) needs a doctor's review and the NMC rules. */
export const CHECKLIST: { id: string; label: string; site?: Site }[] = [
  { id: 'doctor', label: 'Written or reviewed by a named doctor', site: 'doctordekho' },
  { id: 'facts', label: 'Facts checked against a trusted source' },
  { id: 'nmc', label: 'No “best doctor” claims, guarantees or testimonials', site: 'doctordekho' },
  { id: 'ai', label: 'AI-assisted parts checked and labelled' },
  { id: 'questions', label: 'Answers the questions people ask' },
  { id: 'links', label: 'Links to related pages (doctors, cities, modules)' },
];

const IN = 'en-IN';
export const n = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString(IN));
/** 12,300 → "12.3K", 1,20,000 → "1.2L" (Indian short form). */
export const short = (v: number | null | undefined) => {
  if (v == null) return '—';
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (v >= 100_000) return `${(v / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(v));
};
export const pos = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(1));
export const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) * 100) / before) : null);
export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;

/** "05:41 IST, 28 Nov" for a UTC time. */
export const istTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(IN, { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false, day: 'numeric', month: 'short' }).replace(',', '') + ' IST';
};

/** "5 Dec" for a yyyy-mm-dd date. */
export const dueLabel = (d?: string | null) => {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return y && m && day ? `${day} ${MONTHS[m - 1]}` : d;
};
