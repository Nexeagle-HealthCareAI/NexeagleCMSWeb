import type { GoogleApi } from './googleService';
import type {
  AdsLevel, GoogleAccount, GoogleAds, GoogleAdsRow, GoogleChecks, GoogleLead, GoogleOverview, GooglePageDetail, GooglePages, GoogleRange, GoogleSetup,
} from '../types';

// Example data for VITE_GOOGLE_MOCK=true (and the tests). Names and numbers are made up; nothing here is real.

const wait = <T,>(v: T): Promise<T> => new Promise(r => setTimeout(() => r(structuredClone(v)), 120));
const now = () => new Date().toISOString();
const daysAgo = (n: number, h = 9) => { const t = new Date(); t.setDate(t.getDate() - n); t.setHours(h, 12, 0, 0); return t.toISOString(); };
const span = (q: GoogleRange) => Math.max(1, Math.round((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000) + 1);

const NEXEAGLE_EVENTS = [
  { name: 'generate_lead', label: 'Contact and demo requests', isLead: true },
  { name: 'whatsapp_click', label: 'WhatsApp clicks', isLead: false },
  { name: 'phone_click', label: 'Call clicks', isLead: false },
  { name: 'email_click', label: 'Email clicks', isLead: false },
];
const DD_EVENTS = [
  { name: 'appointment_booked', label: 'Appointments booked', isLead: true },
  { name: 'begin_booking', label: 'Bookings started', isLead: false },
  { name: 'view_doctor', label: 'Doctor profiles viewed', isLead: false },
  { name: 'search', label: 'Searches', isLead: false },
  { name: 'whatsapp_click', label: 'WhatsApp clicks', isLead: false },
];

const setups: GoogleSetup[] = [
  {
    accountId: 'g-nexeagle', name: 'NexEagle', site: 'nexeagle', ga4PropertyName: 'nexeagle.com', adsAccountName: 'NexEagle Ads', searchConsoleSite: 'sc-domain:nexeagle.com',
    currency: 'INR', signedIn: true, hasAnalytics: true, hasAds: true, canEdit: true, canEncrypt: true, unreadable: false,
    clientId: '000000000000-example.apps.googleusercontent.com', hasClientSecret: true, signedInEmail: 'marketing@example.com', signedInAt: daysAgo(3),
    ga4PropertyId: '100000001', adsCustomerId: '1112223333', adsLoginCustomerId: null, redirectUrl: 'https://api.example.com/api/v1/google/oauth/callback',
    measurementId: 'G-EXAMPLE001', adsConversionId: 'AW-100000001', eventLabels: { generate_lead: 'ExampleLabel1' }, siteEvents: NEXEAGLE_EVENTS,
    leadWebhookUrl: 'https://api.example.com/api/v1/google/leads', leadKey: 'example-lead-key', lastLeadAt: daysAgo(0, 6),
    outcomes: [{ stage: 'Demo Done', conversionActionId: '9001', conversionActionName: 'CRM: demo done', value: 1000 }, { stage: 'Closed Won', conversionActionId: '9002', conversionActionName: 'CRM: customer' }],
    lastOutcomeAt: daysAgo(1, 18), lastOutcomeError: null, lastReadError: null, updatedAt: daysAgo(3), updatedBy: 'Example Admin',
  },
  {
    accountId: 'g-doctordekho', name: 'Doctor Dekho', site: 'doctordekho', ga4PropertyName: null, adsAccountName: null, searchConsoleSite: null,
    currency: 'INR', signedIn: false, hasAnalytics: false, hasAds: false, canEdit: true, canEncrypt: true, unreadable: false,
    clientId: null, hasClientSecret: false, signedInEmail: null, signedInAt: null, ga4PropertyId: null, adsCustomerId: null, adsLoginCustomerId: null,
    redirectUrl: 'https://api.example.com/api/v1/google/oauth/callback', measurementId: null, adsConversionId: null, eventLabels: {}, siteEvents: DD_EVENTS,
    leadWebhookUrl: 'https://api.example.com/api/v1/google/leads', leadKey: 'example-lead-key-2', lastLeadAt: null, outcomes: [],
    lastOutcomeAt: null, lastOutcomeError: null, lastReadError: null, updatedAt: null, updatedBy: null,
  },
];
const find = (id: string) => setups.find(s => s.accountId === id) ?? setups[0];
const account = (s: GoogleSetup): GoogleAccount => ({
  accountId: s.accountId, name: s.name, site: s.site, ga4PropertyName: s.ga4PropertyName, adsAccountName: s.adsAccountName, searchConsoleSite: s.searchConsoleSite,
  currency: s.currency, signedIn: s.signedIn, hasAnalytics: s.hasAnalytics, hasAds: s.hasAds,
});

const SHAPE = [96, 118, 130, 121, 88, 74, 140, 152, 149, 163, 155, 101, 90, 171, 188, 176, 160, 149, 112, 97, 182, 205, 199, 186, 173, 121, 108, 214, 226, 198];

function overview(q: GoogleRange): GoogleOverview {
  const n = span(q);
  const f = n / 30;
  const r = (v: number) => Math.round(v * f);
  const days = Array.from({ length: n }, (_, i) => {
    const t = new Date(q.from); t.setDate(t.getDate() + i);
    const s = SHAPE[i % SHAPE.length];
    return { day: t.toISOString().slice(0, 10), sessions: s, keyEvents: Math.round(s / 75) };
  });
  const dd = q.accountId === 'g-doctordekho';
  return {
    users: r(3184), previousUsers: r(2840), sessions: r(4410), engagedSessions: r(2690), keyEvents: r(57), ownVisits: r(6920),
    days,
    channels: [['Organic Search', 1630, 21], ['Paid Search', 920, 19], ['Organic Social', 760, 9], ['Direct', 610, 5], ['Referral', 160, 0]]
      .map(([name, s, k]) => ({ name: name as string, sessions: r(s as number), keyEvents: r(k as number) })),
    campaigns: [['1hms_demo_bihar', 'google / cpc', 640, 14], ['camp_invite_nov', 'whatsapp / broadcast', 210, 2], ['five_questions_reel', 'instagram / social', 330, 4]]
      .map(([name, sm, s, k]) => ({ name: name as string, sourceMedium: sm as string, sessions: r(s as number), keyEvents: r(k as number) })),
    events: (dd ? DD_EVENTS : NEXEAGLE_EVENTS).map((e, i) => ({ ...e, count: r([57, 96, 46, 12, 30][i] ?? 10) })),
    readAt: now(),
  };
}

const PAGES: [string, number, number, number, number, number][] = [
  ['/', 1420, 824, 72, 18, 54], ['/1hms', 910, 600, 125, 21, 31], ['/pricing', 640, 454, 108, 9, 22], ['/demo', 420, 336, 58, 6, 4],
  ['/1rad', 310, 192, 97, 2, 8], ['/guides/choosing-hms', 280, 207, 190, 1, 3], ['/contact', 160, 123, 44, 0, 15],
];
const pages = (q: GoogleRange): GooglePages => {
  const f = span(q) / 30;
  return {
    siteUrl: q.accountId === 'g-nexeagle' ? 'https://nexeagle.com' : null,
    pages: PAGES.map(([path, s, e, sec, k, c]) => ({ path, sessions: Math.round(s * f), engagedSessions: Math.round(e * f), avgSeconds: sec, keyEvents: Math.round(k * f), contacts: Math.round(c * f) })),
    readAt: now(),
  };
};
const page = (q: GoogleRange, path: string): GooglePageDetail => ({
  path,
  sources: [['Organic Search', 46], ['Direct', 24], ['Organic Social', 18], ['Paid Search', 12]].map(([name, s]) => ({ name: name as string, sessions: s as number, keyEvents: 0 })),
  queries: q.accountId === 'g-nexeagle'
    ? [{ key: 'example search one', clicks: 64, impressions: 900, position: 11.2 }, { key: 'example search two', clicks: 22, impressions: 310, position: 6.8 }]
    : [],
  searchConsoleConnected: q.accountId === 'g-nexeagle',
});

const ROWS: Record<AdsLevel, GoogleAdsRow[]> = {
  campaign: [
    { id: 'c1', name: '1HMS demo, Bihar', sub: null, status: 'Active', spend: 8940, impressions: 17200, clicks: 702, conversions: 24, crmLeads: 27, costPerLead: 331 },
    { id: 'c2', name: 'Doctor Dekho listing', sub: null, status: 'Active', spend: 3820, impressions: 8100, clicks: 361, conversions: 10, crmLeads: 11, costPerLead: 347 },
    { id: 'c3', name: 'Brand: NexEagle', sub: null, status: 'Active', spend: 1500, impressions: 3400, clicks: 117, conversions: 3, crmLeads: 3, costPerLead: 500 },
  ],
  adgroup: [
    { id: 'a1', name: 'Hospital management software', sub: '1HMS demo, Bihar', status: 'Active', spend: 5610, impressions: 10100, clicks: 421, conversions: 16 },
    { id: 'a2', name: 'Small hospital, OPD', sub: '1HMS demo, Bihar', status: 'Active', spend: 3330, impressions: 7100, clicks: 281, conversions: 8 },
  ],
  keyword: [
    { id: 'k1', name: 'hospital management software', sub: 'phrase · Hospital management software', status: 'Active', spend: 3140, impressions: 5200, clicks: 226, conversions: 10 },
    { id: 'k2', name: 'opd software', sub: 'phrase · Small hospital, OPD', status: 'Paused', spend: 1190, impressions: 2600, clicks: 104, conversions: 2 },
  ],
  search: [
    { id: 's1', name: 'example search that brought leads', sub: 'Hospital management software', status: 'Added', spend: 860, impressions: 900, clicks: 64, conversions: 5 },
    { id: 's2', name: 'example search with no lead', sub: 'Hospital management software', status: 'Not added', spend: 540, impressions: 700, clicks: 49, conversions: 0 },
  ],
};
const ads = (q: GoogleRange & { level: AdsLevel }): GoogleAds => ({
  currency: 'INR', spend: 14260, dailyBudgets: 700, impressions: 28700, clicks: 1180, conversions: 37, crmLeads: 41, webLeads: 29, formLeads: 12,
  costPerLead: 348, previousCostPerLead: 391, customers: 3,
  days: Array.from({ length: span(q) }, (_, i) => { const t = new Date(q.from); t.setDate(t.getDate() + i); return { day: t.toISOString().slice(0, 10), spend: 380 + ((i * 37) % 160) }; }),
  rows: ROWS[q.level],
  platforms: [
    { platform: 'google', spend: 14260, leads: 41, costPerLead: 348, reachedDemo: 11, customers: 3, costPerCustomer: 4753 },
    { platform: 'meta', spend: 18420, leads: 59, costPerLead: 312, reachedDemo: 9, customers: 4, costPerCustomer: 4605 },
  ],
  readAt: now(),
});

const LEADS: GoogleLead[] = [
  { googleLeadId: 'gl1', leadId: 'l1', name: 'Example Hospital Owner', phone: '+91 98000 00031', source: 'web', formName: 'Book a demo page', campaignName: '1HMS demo, Bihar', keyword: 'hospital management software', fromGoogleAd: true, answers: [{ name: 'City', value: 'Purnia' }], receivedAt: daysAgo(0, 8), stage: 'New', owner: null, inCrm: true },
  { googleLeadId: 'gl2', leadId: 'l2', name: 'Example Clinic Owner', phone: '+91 98000 00032', source: 'form', formName: 'Search ad form', campaignName: 'Doctor Dekho listing', keyword: null, fromGoogleAd: true, answers: [{ name: 'Doctors', value: '2' }], receivedAt: daysAgo(0, 6), stage: 'New', owner: null, inCrm: true },
  { googleLeadId: 'gl3', leadId: 'l3', name: 'Example Hospital Admin', phone: '+91 98000 00034', source: 'web', formName: 'Pricing page', campaignName: 'Brand: NexEagle', keyword: 'nexeagle', fromGoogleAd: true, answers: [], receivedAt: daysAgo(3, 11), stage: 'Demo Done', owner: 'Example Sales', inCrm: true, sentStage: 'Demo Done', sentAt: daysAgo(2, 18) },
  { googleLeadId: 'gl4', leadId: 'l4', name: 'Example Multispeciality', email: 'admin@example.com', source: 'web', formName: 'Home page', campaignName: null, keyword: null, fromGoogleAd: false, utmSource: 'instagram', answers: [], receivedAt: daysAgo(9, 10), stage: 'Demo Done', owner: 'Example Sales', inCrm: true },
];

export const mockGoogle: GoogleApi = {
  accounts: () => wait(setups.map(account)),
  createAccount: (name, site) => {
    const s: GoogleSetup = { ...setups[1], accountId: `g-${Date.now()}`, name, site, siteEvents: site === 'doctordekho' ? DD_EVENTS : NEXEAGLE_EVENTS };
    setups.push(s);
    return wait(s);
  },
  setup: id => wait(find(id)),
  saveClient: (id, p) => { const s = find(id); Object.assign(s, { name: p.name ?? s.name, clientId: p.clientId ?? s.clientId, hasClientSecret: s.hasClientSecret || !!p.clientSecret }); if (p.signOut) Object.assign(s, { signedIn: false, signedInEmail: null }); return wait(s); },
  signIn: (id, returnUrl) => { const s = find(id); Object.assign(s, { signedIn: true, signedInEmail: 'marketing@example.com', signedInAt: now() }); return wait(`${returnUrl}${returnUrl.includes('?') ? '&' : '?'}google=connected`); },
  discover: () => wait({
    signedInEmail: 'marketing@example.com',
    properties: [{ propertyId: '100000001', name: 'nexeagle.com', accountName: 'NexEagle' }, { propertyId: '100000002', name: 'Doctor Dekho', accountName: 'NexEagle' }],
    adsAccounts: [{ customerId: '1112223333', name: 'NexEagle Ads', currency: 'INR' }],
    searchConsoleSites: ['sc-domain:nexeagle.com'],
    conversionActions: [{ id: '9001', name: 'CRM: demo done' }, { id: '9002', name: 'CRM: customer' }],
    problems: {},
  }),
  choose: (id, p) => { const s = find(id); Object.assign(s, { ga4PropertyId: p.ga4PropertyId, hasAnalytics: !!p.ga4PropertyId, adsCustomerId: p.adsCustomerId, hasAds: !!p.adsCustomerId, searchConsoleSite: p.searchConsoleSite }); return wait(s); },
  saveTag: (id, p) => { const s = find(id); Object.assign(s, { measurementId: p.measurementId, adsConversionId: p.adsConversionId, eventLabels: p.eventLabels ?? {} }); return wait({ data: s, message: 'Saved. The website picks it up within 5 minutes.' }); },
  newLeadKey: id => { const s = find(id); s.leadKey = `example-key-${Date.now() % 1000}`; return wait(s); },
  saveOutcomes: (id, outcomes) => { const s = find(id); s.outcomes = outcomes; return wait(s); },
  checks: (id): Promise<GoogleChecks> => {
    const s = find(id);
    const item = (key: string, label: string, ok: boolean, detail: string, todo = false) => ({ key, label, state: ok ? 'ok' as const : todo ? 'todo' as const : 'warn' as const, detail });
    return wait({
      ready: s.signedIn && s.hasAnalytics,
      items: [
        item('signin', 'Signed in with Google', s.signedIn, s.signedInEmail ?? 'Enter the OAuth client, then sign in.'),
        item('analytics', 'Google Analytics property chosen', s.hasAnalytics, s.ga4PropertyName ?? 'Choose the property.'),
        item('tag', 'Website tag is sending', !!s.measurementId, s.measurementId ? '4 of 4 site actions seen in the last 24 hours' : 'Enter the measurement ID.'),
        item('ads', 'Google Ads account chosen', s.hasAds, s.adsAccountName ?? 'Optional, for spend and cost per lead.', !s.hasAds),
        item('leads', 'Google lead forms send to the CMS', !!s.lastLeadAt, s.lastLeadAt ? 'last lead today' : 'No lead yet. Use “Send test data” in Google Ads.', !s.lastLeadAt),
        item('outcomes', 'Results sent to Google', s.outcomes.length > 0, s.outcomes.length ? '14 sent this month' : 'Choose the CRM stages.', !s.outcomes.length),
        item('searchConsole', 'Search Console (optional)', !!s.searchConsoleSite, s.searchConsoleSite ?? 'Shows the searches that led to each page.', !s.searchConsoleSite),
      ],
    });
  },
  overview: q => wait(overview(q)),
  pages: q => wait(pages(q)),
  page: (q, path) => wait(page(q, path)),
  ads: q => wait(ads(q)),
  leads: q => {
    const items = LEADS.filter(l => !q.source || l.source === q.source).filter(l => !q.campaign || l.campaignName === q.campaign);
    return wait({
      items, total: items.length, campaigns: ['1HMS demo, Bihar', 'Doctor Dekho listing', 'Brand: NexEagle'],
      summary: { last7Days: 3, web7: 2, forms7: 1, notContacted: 2, oldestNotContactedAt: daysAgo(0, 6), reachedDemoThisMonth: 2, leadsThisMonth: 4, sentThisMonth: 1 },
    });
  },
};
