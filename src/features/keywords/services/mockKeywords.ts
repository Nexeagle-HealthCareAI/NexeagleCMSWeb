import type {
  ContentItem, ContentSave, KeywordDetail, KeywordOverview, KeywordPage, KeywordQuery, KeywordRow, KeywordSetup, KeywordSource, KeywordUpdate,
  Lang, SetupSave, Site, TopicDetail, TopicRow, TopicSave,
} from '../types';
import type { KeywordsApi } from './keywordsService';

// Example data for VITE_KEYWORDS_MOCK=true: screens can be reviewed in the browser without the API. Numbers are made up.

const wait = <T,>(v: T): Promise<T> => new Promise(r => setTimeout(() => r(structuredClone(v)), 120));
const now = new Date();
const iso = (daysAgo = 0, h = 0) => new Date(now.getTime() - daysAgo * 86_400_000 - h * 3_600_000).toISOString();
let seq = 0;
const id = (p: string) => `${p}-${(++seq).toString().padStart(4, '0')}`;

const T = {
  dengue: id('t'), piles: id('t'), purnea: id('t'), gyn: id('t'), hms: id('t'), pmjay: id('t'), opd: id('t'),
};
const topics: TopicDetail[] = [
  { topicId: T.dengue, site: 'doctordekho', name: 'Dengue and platelets', targetPage: '/health/conditions/dengue', isSuggested: true, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: 7.8, reason: 'lang', why: '68% of the demand is in Hinglish, Hindi, Bengali, and no content in them is published yet.', score: 86, contentCount: 1, publishedCount: 0, keywords: [], questions: ['dengue me platelets kitna hona chahiye', 'dengue ke lakshan kya hai', 'what is the normal platelet count in dengue', 'dengue test price in purnea'], content: [] },
  { topicId: T.piles, site: 'doctordekho', name: 'Piles treatment', targetPage: '/health/conditions/piles', isSuggested: true, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: 11.2, reason: 'close', why: 'Average position 11.2 on 2,140 showings in 28 days: a better answer can reach page one.', score: 78, contentCount: 0, publishedCount: 0, keywords: [], questions: ['piles ka ilaj bina operation', 'is piles curable without surgery'], content: [] },
  { topicId: T.purnea, site: 'doctordekho', name: 'Doctors in Purnea', targetPage: '/doctors/purnea', isSuggested: true, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: 4.1, reason: 'ctr', why: 'Position 4.1 but only 0.9% of 3,310 showings were clicked: the title and description need work.', score: 74, contentCount: 0, publishedCount: 0, keywords: [], questions: [], content: [] },
  { topicId: T.gyn, site: 'doctordekho', name: 'Gynecologist near me', targetPage: null, isSuggested: false, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: null, reason: 'gap', why: '4,400 searches a month in India, and none of our pages shows for it.', score: 71, contentCount: 0, publishedCount: 0, keywords: [], questions: ['lady doctor near me open now'], content: [] },
  { topicId: T.hms, site: 'nexeagle', name: 'Hospital management software', targetPage: '/products/hms', isSuggested: true, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: 14.6, reason: 'close', why: 'Average position 14.6 on 1,020 showings in 28 days: a better answer can reach page one.', score: 82, contentCount: 1, publishedCount: 1, keywords: [], questions: ['which is the best hospital software in india', 'hospital management software price'], content: [] },
  { topicId: T.pmjay, site: 'nexeagle', name: 'PMJAY claim software', targetPage: null, isSuggested: false, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: null, reason: 'rising', why: '64 searches or showings in the last 7 days, up 120% on the week before.', score: 69, contentCount: 0, publishedCount: 0, keywords: [], questions: ['how to submit pmjay claim online'], content: [] },
  { topicId: T.opd, site: 'nexeagle', name: 'OPD billing', targetPage: '/products/opd', isSuggested: true, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: 3.2, reason: null, why: null, score: 52, contentCount: 0, publishedCount: 0, keywords: [], questions: [], content: [] },
];

const weeks = (base: number, up = 0) => Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round(base * (1 + (up * i) / 8) + ((i * 37) % 11) - 5)));
const kw = (site: Site, text: string, language: Lang, intent: string, topic: string | null, vol: number | null, imp: number, pos: number | null, sources: string, city: string | null = null, visitors = 0, up = 0): KeywordRow => ({
  keywordId: id('k'), site, text, language, intent, city, topicId: topic, topicName: topics.find(t => t.topicId === topic)?.name ?? null, status: 'active', sources,
  avgMonthlySearches: vol, impressions: imp, clicks: Math.round(imp * (pos != null && pos < 5 ? 0.05 : 0.012)), position: pos, visitors,
  weeks: weeks(Math.max(imp, visitors * 4) / 4, up), firstSeenAt: iso(40),
});
const keywords: KeywordRow[] = [
  kw('doctordekho', 'dengue ke lakshan', 'hg', 'info', T.dengue, 14800, 1820, 9.4, 'gsc,planner', null, 0, 0.6),
  kw('doctordekho', 'डेंगू के लक्षण', 'hi', 'info', T.dengue, 9900, 310, 12.1, 'gsc,planner', null, 0, 0.5),
  kw('doctordekho', 'dengue symptoms', 'en', 'info', T.dengue, 6600, 2410, 6.2, 'gsc,planner'),
  kw('doctordekho', 'ডেঙ্গু জ্বরের লক্ষণ', 'bn', 'info', T.dengue, 2900, 0, null, 'planner'),
  kw('doctordekho', 'dengue me platelets kitna hona chahiye', 'hg', 'info', T.dengue, 1900, 640, 8.8, 'gsc,planner,site', null, 22, 0.4),
  kw('doctordekho', 'dengue test price in purnea', 'en', 'cost', T.dengue, 90, 120, 5.6, 'gsc,site', 'Purnea', 9),
  kw('doctordekho', 'piles doctor in purnea', 'en', 'doctor', T.piles, 320, 910, 11.4, 'gsc,planner,site', 'Purnea', 31),
  kw('doctordekho', 'piles ka ilaj', 'hg', 'info', T.piles, 8100, 1230, 13.0, 'gsc,planner'),
  kw('doctordekho', 'doctor in purnea', 'en', 'doctor', T.purnea, 1300, 3310, 4.1, 'gsc,planner', 'Purnea'),
  kw('doctordekho', 'gynecologist near me', 'en', 'nearme', T.gyn, 4400, 0, null, 'planner'),
  kw('doctordekho', 'lady doctor kishanganj', 'en', 'doctor', T.gyn, 210, 0, null, 'planner,site', 'Kishanganj', 14),
  kw('doctordekho', 'skin doctor in kolkata', 'en', 'doctor', null, 2400, 180, 24.0, 'gsc,planner', 'Kolkata'),
  kw('nexeagle', 'hospital management software', 'en', 'software', T.hms, 2900, 1020, 14.6, 'gsc,planner,ads'),
  kw('nexeagle', 'hospital software india', 'en', 'software', T.hms, 480, 420, 9.8, 'gsc,planner'),
  kw('nexeagle', 'hospital management software price', 'en', 'cost', T.hms, 390, 160, 18.2, 'gsc,planner,ads'),
  kw('nexeagle', 'pmjay claim software', 'en', 'software', T.pmjay, 110, 64, 22.0, 'gsc,planner', null, 0, 1.2),
  kw('nexeagle', 'opd billing software', 'en', 'software', T.opd, 320, 540, 3.2, 'gsc,planner'),
];
const ignored: KeywordRow[] = [{ ...kw('doctordekho', 'dengue movie', 'en', 'other', null, 50, 12, 40, 'gsc'), status: 'ignored' }];

const content: ContentItem[] = [
  {
    contentId: id('c'), site: 'doctordekho', topicId: T.dengue, topicName: 'Dengue and platelets', kind: 'article', title: 'Dengue and platelets: what the numbers mean, day by day', stage: 'writing',
    languages: ['en', 'hg', 'hi'], ownerUserId: null, ownerName: '[Writer]', dueDate: new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10), url: null, publishedAt: null,
    createdAt: iso(5), updatedAt: iso(1), result: null,
    brief: {
      mainKeywords: { en: 'dengue symptoms', hg: 'dengue ke lakshan', hi: 'डेंगू के लक्षण' }, page: '/health/conditions/dengue', schema: 'MedicalWebPage, FAQPage',
      writer: '[Writer]', reviewer: '[Reviewing doctor]', notes: null, checklist: { facts: true, questions: true },
      outline: '1. What platelets are and the normal range\n2. How dengue lowers platelets, day by day\n3. Warning signs: when to go to hospital the same day\n4. Tests to ask for and what the numbers mean\n5. Food and fluids during recovery\n6. Doctors and labs near you',
    },
  },
  {
    contentId: id('c'), site: 'nexeagle', topicId: T.hms, topicName: 'Hospital management software', kind: 'guide', title: 'Choosing hospital software for a 30–100 bed hospital', stage: 'published',
    languages: ['en'], ownerUserId: null, ownerName: '[Writer]', dueDate: null, url: 'https://nexeagle.com/guides/hospital-software', publishedAt: iso(21),
    createdAt: iso(40), updatedAt: iso(21),
    result: { impressionsBefore: 640, impressionsAfter: 980, clicksBefore: 9, clicksAfter: 17, positionBefore: 19.4, positionAfter: 14.6, daysAfter: 19 },
    brief: { mainKeywords: { en: 'hospital management software' }, page: '/guides/hospital-software', schema: 'Article', writer: '[Writer]', reviewer: null, notes: null, checklist: { facts: true, ai: true, questions: true, links: true } },
  },
];

const ago = (h: number) => iso(0, h);
const sources: KeywordSource[] = [
  { key: 'gsc', name: 'Search Console', what: 'Searches that showed our pages in India, both sites (from the Google section)', often: 'Daily', state: 'ok', detail: 'Doctor Dekho: 18,240 rows · NexEagle: 2,310 rows', lastRunAt: ago(3), lastOkAt: ago(3), lastCount: 20550, canRun: true },
  { key: 'ads', name: 'Google Ads search terms', what: 'What people searched before clicking our ads', often: 'Daily', state: 'ok', detail: 'NexEagle: 214 search terms', lastRunAt: ago(3), lastOkAt: ago(3), lastCount: 214, canRun: true },
  { key: 'planner', name: 'Keyword Planner', what: 'Ideas and monthly searches for India, in English, Hindi and Bengali', often: 'Daily, in rotation', state: 'ok', detail: '150 requests · 6,820 keywords with volumes', lastRunAt: ago(3), lastOkAt: ago(3), lastCount: 150, canRun: true },
  { key: 'site', name: 'Doctor Dekho site searches', what: 'What patients type into Doctor Dekho’s search, from 5+ visitors only', often: 'Daily', state: 'ok', detail: '412 phrases typed by 5+ visitors in 28 days', lastRunAt: ago(3), lastOkAt: ago(3), lastCount: 412, canRun: true },
  { key: 'wikipedia', name: 'Wikipedia views', what: 'Interest in conditions in English, Hindi and Bengali', often: 'Daily', state: 'off', detail: 'Planned for a later phase.', lastCount: 0, canRun: false },
  { key: 'bing', name: 'Bing keyword stats', what: 'Weekly showings for our top keywords in India', often: 'Weekly', state: 'off', detail: 'Planned for a later phase.', lastCount: 0, canRun: false },
  { key: 'gbp', name: 'Business Profile searches', what: 'Searches that showed our Google business profiles', often: 'Monthly', state: 'off', detail: 'Planned for a later phase.', lastCount: 0, canRun: false },
  { key: 'trends', name: 'Google Trends', what: 'Interest over 5 years by region', often: 'Daily', state: 'off', detail: 'Waiting for Google to approve API access (apply at developers.google.com/search/apis/trends).', lastCount: 0, canRun: false },
];

let setup: KeywordSetup = {
  canEdit: true,
  seeds: {
    doctordekho: ['dengue', 'typhoid', 'sugar', 'bp', 'thyroid', 'kidney stone', 'piles', 'joint pain', 'skin allergy', 'pregnancy care'],
    nexeagle: ['hospital management software', 'opd billing software', 'pmjay claim software', 'nabh software', 'abdm integration', 'lab management software'],
  },
  competitorSites: { doctordekho: [], nexeagle: [] }, extraCities: [], weights: { demand: 7, fit: 8, close: 6, value: 9 }, minVisitors: 5, sources,
  googleAccounts: [
    { site: 'doctordekho', name: 'Doctor Dekho', signedIn: true, hasSearchConsole: true, hasAds: false },
    { site: 'nexeagle', name: 'NexEagle', signedIn: true, hasSearchConsole: true, hasAds: true },
  ],
  cities: ['Bhagalpur', 'Darbhanga', 'Delhi NCR', 'Katihar', 'Kishanganj', 'Kolkata', 'Muzaffarpur', 'Patna', 'Purnea', 'Siliguri'],
};

const demandOf = (k: KeywordRow) => Math.max(k.avgMonthlySearches ?? 0, Math.round((k.impressions * 30) / 28), k.visitors * 30);
function topicRows(site?: Site | ''): TopicDetail[] {
  for (const t of topics) {
    const ks = keywords.filter(k => k.topicId === t.topicId);
    t.keywordCount = ks.length;
    t.demand = {};
    for (const k of ks) t.demand[k.language] = (t.demand[k.language] ?? 0) + demandOf(k);
    t.impressions = ks.reduce((s, k) => s + k.impressions, 0);
    t.clicks = ks.reduce((s, k) => s + k.clicks, 0);
    t.keywords = [...ks].sort((a, b) => demandOf(b) - demandOf(a));
    t.content = content.filter(c => c.topicId === t.topicId);
    t.contentCount = t.content.length;
    t.publishedCount = t.content.filter(c => c.stage === 'published').length;
  }
  return topics.filter(t => !site || t.site === site);
}

/** A topic without its keyword, question and content lists. */
const toRow = (t: TopicDetail): TopicRow => {
  const row: Partial<TopicDetail> = { ...t };
  delete row.keywords; delete row.questions; delete row.content; delete row.notes;
  return row as TopicRow;
};

const fail = (message: string) => Promise.reject(Object.assign(new Error(message), { response: { status: 400, data: { message } } }));

export const mockKeywords: KeywordsApi = {
  overview: async s => {
    const ks = keywords.filter(k => !s || k.site === s);
    const imp = ks.reduce((a, k) => a + k.impressions, 0);
    const ts = topicRows(s);
    const o: KeywordOverview = {
      tracked: ks.length * 412, newThisWeek: 186, impressions: imp * 9, previousImpressions: Math.round(imp * 7.6), clicks: ks.reduce((a, k) => a + k.clicks, 0) * 9,
      position: 11.8, previousPosition: 13.1, topicsWithPlan: ts.filter(t => t.contentCount > 0).length, published: content.filter(c => c.stage === 'published').length,
      inProgress: content.filter(c => c.stage !== 'published').length,
      opportunities: ts.filter(t => t.reason).sort((a, b) => b.score - a.score).slice(0, 6).map(t => ({
        kind: t.reason!, site: t.site, topicId: t.topicId, title: t.name, why: t.why ?? '', score: t.score, keywords: t.keywords.slice(0, 3).map(k => k.text),
      })),
      languages: (['en', 'hg', 'hi', 'bn'] as Lang[]).map(l => ({
        language: l, impressions: ks.filter(k => k.language === l).reduce((a, k) => a + k.impressions, 0) * 9, visitors: ks.filter(k => k.language === l).reduce((a, k) => a + k.visitors, 0),
        searches: ks.filter(k => k.language === l).reduce((a, k) => a + (k.avgMonthlySearches ?? 0), 0),
      })).filter(l => l.impressions + l.visitors + l.searches > 0),
      rising: ks.filter(k => k.weeks[7] >= 20 && k.weeks[7] > k.weeks[5] * 1.05).sort((a, b) => b.weeks[7] / Math.max(1, b.weeks[5]) - a.weeks[7] / Math.max(1, a.weeks[5])).slice(0, 5).map(k => ({
        keywordId: k.keywordId, text: k.text, site: k.site, sources: k.sources, now: k.weeks[7], changePercent: Math.round(((k.weeks[7] - k.weeks[5]) * 100) / Math.max(1, k.weeks[5])),
      })),
      sources, collectedAt: ago(3),
    };
    return wait(o);
  },
  list: async (q: KeywordQuery) => {
    let list = (q.ignored ? ignored : keywords).filter(k => (!q.site || k.site === q.site) && (!q.language || k.language === q.language) && (!q.intent || k.intent === q.intent)
      && (!q.city || k.city === q.city) && (!q.source || k.sources.includes(q.source)) && (!q.topicId || k.topicId === q.topicId)
      && (!q.q || k.text.toLowerCase().includes(q.q.trim().toLowerCase())));
    const sort = q.sort ?? 'demand';
    list = [...list].sort((a, b) => sort === 'shown' ? b.impressions - a.impressions : sort === 'position' ? (a.position ?? 999) - (b.position ?? 999)
      : sort === 'rising' ? (b.weeks[7] - b.weeks[6]) - (a.weeks[7] - a.weeks[6]) : sort === 'newest' ? b.firstSeenAt.localeCompare(a.firstSeenAt) : demandOf(b) - demandOf(a));
    const page: KeywordPage = { items: list, total: list.length, cities: [...new Set(keywords.map(k => k.city).filter(Boolean) as string[])].sort() };
    return wait(page);
  },
  keyword: async kid => {
    const k = [...keywords, ...ignored].find(x => x.keywordId === kid);
    if (!k) return fail('This keyword no longer exists.');
    const base = k.avgMonthlySearches ?? 0;
    const detail: KeywordDetail = {
      ...k, competition: base > 1000 ? 'MEDIUM' : 'LOW', competitionIndex: base > 1000 ? 48 : 21, lowBid: k.site === 'nexeagle' ? 38 : 4.5, highBid: k.site === 'nexeagle' ? 160 : 18, currency: 'INR',
      months: base ? Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); const monsoon = [6, 7, 8, 9].includes(d.getMonth()); return { y: d.getFullYear(), m: d.getMonth() + 1, v: Math.round(base * (monsoon && k.topicId === T.dengue ? 2.6 : 0.7 + (i % 3) * 0.1)) }; }) : [],
      page: topics.find(t => t.topicId === k.topicId)?.targetPage ?? null,
      seenIn: [
        ...(k.avgMonthlySearches ? [{ name: 'Keyword Planner', detail: `${k.avgMonthlySearches.toLocaleString('en-IN')} searches a month, India` }] : []),
        ...(k.impressions ? [{ name: 'Search Console', detail: `${k.impressions.toLocaleString('en-IN')} showings in 28 days, position ${k.position?.toFixed(1)}` }] : []),
        ...(k.visitors ? [{ name: 'Doctor Dekho searches', detail: `typed by ${k.visitors} visitors in 28 days` }] : []),
      ],
      variants: keywords.filter(x => x.topicId && x.topicId === k.topicId && x.language !== k.language).slice(0, 6),
      languageByPerson: false, intentByPerson: false,
    };
    return wait(detail);
  },
  updateKeyword: async (kid, u: KeywordUpdate) => {
    const all = [...keywords, ...ignored];
    const k = all.find(x => x.keywordId === kid);
    if (!k) return fail('This keyword no longer exists.');
    if (u.language) k.language = u.language;
    if (u.intent) k.intent = u.intent;
    if (u.clearTopic) { k.topicId = null; k.topicName = null; }
    if (u.topicId) { k.topicId = u.topicId; k.topicName = topics.find(t => t.topicId === u.topicId)?.name ?? null; }
    if (u.status && u.status !== k.status) {
      k.status = u.status;
      const [from, to] = u.status === 'ignored' ? [keywords, ignored] : [ignored, keywords];
      from.splice(from.indexOf(k), 1);
      to.push(k);
    }
    return mockKeywords.keyword(kid);
  },
  topics: async (s, kind) => wait(topicRows(s).filter(t => !kind || t.reason === kind).map(t => toRow(t))
    .sort((a, b) => Number(!!b.reason) - Number(!!a.reason) || b.score - a.score)),
  topic: async tid => { topicRows(); const t = topics.find(x => x.topicId === tid); return t ? wait(t) : fail('This topic no longer exists.'); },
  createTopic: async (t: TopicSave) => {
    if (!t.name.trim()) return fail('Give the topic a name (up to 200 characters).');
    const row: TopicDetail = { topicId: id('t'), site: t.site, name: t.name.trim(), targetPage: t.targetPage || null, isSuggested: false, keywordCount: 0, demand: {}, impressions: 0, clicks: 0, position: null, reason: null, why: null, score: 0, contentCount: 0, publishedCount: 0, notes: t.notes ?? null, keywords: [], questions: [], content: [] };
    topics.push(row);
    for (const k of keywords.filter(x => t.keywordIds?.includes(x.keywordId))) { k.topicId = row.topicId; k.topicName = row.name; }
    return mockKeywords.topic(row.topicId);
  },
  updateTopic: async (tid, s: TopicSave) => {
    const t = topics.find(x => x.topicId === tid);
    if (!t) return fail('This topic no longer exists.');
    t.name = s.name.trim(); t.notes = s.notes ?? null;
    if ((s.targetPage || null) !== t.targetPage) { t.targetPage = s.targetPage || null; t.isSuggested = false; }
    for (const k of keywords.filter(x => x.topicId === tid)) k.topicName = t.name;
    return mockKeywords.topic(tid);
  },
  mergeTopic: async (tid, into) => {
    const from = topics.find(x => x.topicId === tid);
    const to = topics.find(x => x.topicId === into);
    if (!from || !to) return fail('One of the topics no longer exists.');
    if (from.site !== to.site) return fail('Topics of different websites cannot be merged.');
    for (const k of keywords.filter(x => x.topicId === tid)) { k.topicId = into; k.topicName = to.name; }
    for (const c of content.filter(x => x.topicId === tid)) { c.topicId = into; c.topicName = to.name; }
    topics.splice(topics.indexOf(from), 1);
    return mockKeywords.topic(into);
  },
  content: async (s, kind) => wait(content.filter(c => (!s || c.site === s) && (!kind || c.kind === kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  createContent: async (c: ContentSave) => {
    if (!c.title.trim()) return fail('Give it a title (up to 300 characters).');
    if (c.languages.length === 0) return fail('Choose at least one language: English, Hindi, Hinglish or Bengali.');
    const t = topics.find(x => x.topicId === c.topicId);
    const brief = c.brief ?? { mainKeywords: {}, checklist: {} };
    if (t && Object.keys(brief.mainKeywords).length === 0) {
      for (const k of keywords.filter(x => x.topicId === t.topicId).sort((a, b) => demandOf(b) - demandOf(a))) if (k.language !== 'other' && !brief.mainKeywords[k.language]) brief.mainKeywords[k.language] = k.text;
      brief.page ??= t.targetPage;
    }
    const item: ContentItem = { ...c, contentId: id('c'), topicName: t?.name ?? null, brief, ownerName: null, publishedAt: c.stage === 'published' ? iso() : null, createdAt: iso(), updatedAt: iso(), result: null };
    content.unshift(item);
    return wait(item);
  },
  updateContent: async (cid, c: ContentSave) => {
    const item = content.find(x => x.contentId === cid);
    if (!item) return fail('This item is no longer in the content plan.');
    if (c.stage === 'published' && item.stage !== 'published') item.publishedAt = iso();
    Object.assign(item, { ...c, site: item.site, topicName: topics.find(x => x.topicId === c.topicId)?.name ?? null, brief: c.brief ?? item.brief, updatedAt: iso() });
    return wait(item);
  },
  deleteContent: async cid => { const i = content.findIndex(x => x.contentId === cid); if (i >= 0) content.splice(i, 1); await wait(null); },
  setup: async () => wait(setup),
  saveSetup: async (s: SetupSave) => {
    if (s.minVisitors != null && (s.minVisitors < 5 || s.minVisitors > 100)) return fail('Show a site search once at least 5 (and at most 100) visitors typed it.');
    setup = { ...setup, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v != null)) } as KeywordSetup;
    return wait(setup);
  },
  run: async source => {
    for (const s of sources) if (source === 'all' || s.key === source) if (s.canRun) { s.lastRunAt = iso(); s.lastOkAt = iso(); }
    return wait({ data: { [source]: 120 }, message: 'Collected 120 rows.' });
  },
};
