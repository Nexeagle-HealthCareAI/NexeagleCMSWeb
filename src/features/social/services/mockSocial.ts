import type {
  AdLevel, InboxChannel, InboxView, MetaAssets, SocialAccount, SocialAdRow, SocialAds, SocialCalendarItem, SocialChecks, SocialComment,
  SocialConversation, SocialDraft, SocialDraftSave, SocialKeysSave, SocialLead, SocialLeadForm, SocialLeadPage, SocialLeadQuery,
  SocialMakeLead, SocialMediaRef, SocialMessage, SocialNote, SocialPerson, SocialPost, SocialPostDetail, SocialPostPage, SocialPostQuery,
  SocialSetup, SocialSlot, SocialThread,
} from '../types';
import { checkPost } from '../socialUtils';

// In-memory stand-in used when VITE_SOCIAL_MOCK=true. Example data only (made-up names, numbers and accounts);
// resets on reload. Account and Page names are placeholders: the real ones come from Meta.

const min = 60_000;
const ago = (m: number) => new Date(Date.now() - m * min).toISOString();
const ahead = (m: number) => new Date(Date.now() + m * min).toISOString();
const id = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
const pause = () => new Promise(r => setTimeout(r, 120));
const fail = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { message } } });

const ME: SocialPerson = { userId: 'u-me', fullName: 'You (example)' };
const TEAM: SocialPerson[] = [ME, { userId: 'u-2', fullName: 'Example teammate' }];

const accounts: SocialSetup[] = [
  {
    accountId: 'acc-1', name: 'NexEagle', pageId: '1001', pageName: '[Page name]', igUserId: '1002', igUsername: '[handle]', adAccountId: 'act_1',
    adAccountName: '[Ad account name]', currency: 'INR', connected: true, canEdit: true, appId: '123456789', hasAppSecret: true, hasToken: true,
    tokenHint: '…x9Qa', verifyToken: 'example-verify-token', unreadable: false, canEncrypt: true,
    suggestedWebhookUrl: 'https://cms-api.example.com/api/v1/meta/webhook', webhookUrl: 'https://cms-api.example.com/api/v1/meta/webhook',
    webhooksConnectedAt: ago(60 * 24 * 3), lastWebhookAt: ago(4), postsSyncedAt: ago(52), adsSyncedAt: ago(70), leadsCheckedAt: ago(300),
    updatedAt: ago(60 * 24 * 3), updatedBy: 'You (example)',
  },
  {
    accountId: 'acc-2', name: 'Doctor Dekho', currency: 'INR', connected: false, canEdit: true, hasAppSecret: false, hasToken: false,
    unreadable: false, canEncrypt: true, suggestedWebhookUrl: 'https://cms-api.example.com/api/v1/meta/webhook',
  },
];
const pub = (a: SocialSetup): SocialAccount => ({
  accountId: a.accountId, name: a.name, pageId: a.pageId, pageName: a.pageName, igUserId: a.igUserId, igUsername: a.igUsername,
  adAccountId: a.adAccountId, adAccountName: a.adAccountName, currency: a.currency, connected: a.connected,
});
const acct = (accountId: string) => accounts.find(a => a.accountId === accountId) ?? (() => { throw fail(404, 'This account does not exist.'); })();

// ── posts ────────────────────────────────────────────────────────────────────

const post = (channel: SocialPost['channel'], type: string, caption: string, daysAgo: number, s: Partial<SocialPost>, fromCms = false): SocialPost => ({
  postId: id(), channel, metaId: `${channel}-${daysAgo}`, type, caption, permalink: 'https://example.com/post', publishedAt: ago(daysAgo * 1440 + 300),
  fromCms, publishedBy: fromCms ? 'Example teammate' : null, statsAt: ago(52), ...s,
});
const posts: SocialPost[] = [
  post('instagram', 'Reel', 'Five questions to ask before choosing hospital software', 3, { views: 12400, reach: 9800, likes: 486, comments: 32, shares: 58, saves: 141 }, true),
  post('facebook', 'Photo', 'Free health camp this Sunday. Register on WhatsApp.', 5, { views: 6100, likes: 204, comments: 18, shares: 41, clicks: 96 }, true),
  post('instagram', 'Carousel', 'Doctor Dekho: how to book a doctor in your town, step by step', 7, { views: 8900, reach: 7200, likes: 312, comments: 21, shares: 33, saves: 97 }, true),
  post('facebook', 'Video', 'Behind the scenes with the support team', 9, { views: 3300, likes: 88, comments: 6, shares: 9 }),
  post('instagram', 'Photo', 'Thank you to everyone who visited our stall', 12, { views: 4000, reach: 3600, likes: 251, comments: 14, shares: 7, saves: 22 }),
  post('facebook', 'Link', 'New article: what changes for hospital records next year', 15, { views: 2700, likes: 64, comments: 11, shares: 29, clicks: 140 }, true),
  post('instagram', 'Story', 'Poll: what slows your front desk most?', 17, { views: 1900, reach: 1700, shares: 12 }),
  post('facebook', 'Photo', 'Meet us at the regional health expo, stall 14', 21, { views: 3300, likes: 97, comments: 5, shares: 15 }, true),
];
const interactions = (p: SocialPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);

// ── comments and messages ────────────────────────────────────────────────────

const comment = (p: SocialPost, author: string, text: string, m: number, extra: Partial<SocialComment> = {}): SocialComment => ({
  commentId: id(), channel: p.channel, metaId: id(), postMetaId: p.metaId, postCaption: p.caption, postPermalink: p.permalink, postId: p.postId,
  authorName: author, text, fromUs: false, hidden: false, status: 'Open', canPrivateReply: true, createdAt: ago(m), replies: [], ...extra,
});
const comments: SocialComment[] = [
  comment(posts[0], 'example.clinic', 'Is this available for a 30-bed hospital?', 120),
  comment(posts[0], 'Example follower', 'Useful, thank you.', 300, { status: 'Done', repliedBy: 'Example teammate' }),
  comment(posts[1], 'Example Person', 'What time does the camp start?', 60 * 20),
];
comments[1].replies.push(comment(posts[0], '[Page name]', 'Glad it helped!', 290, { fromUs: true, status: 'Done', canPrivateReply: false }));

type Contact = SocialConversation & { messages: SocialMessage[]; notes: SocialNote[] };
const msg = (direction: 'In' | 'Out', text: string, m: number, extra: Partial<SocialMessage> = {}): SocialMessage => ({
  messageId: id(), direction, text, attachments: [], status: direction === 'In' ? 'received' : 'read', humanAgent: false, createdAt: ago(m),
  sentBy: direction === 'Out' ? 'Example teammate' : null, ...extra,
});
const contacts: Contact[] = [
  {
    kind: 'dm', id: id(), channel: 'instagram', name: 'Example Clinic Owner', handle: '@example.clinic', lastAt: ago(25), unread: 2, status: 'Open',
    windowClosesAt: ahead(24 * 60 - 25), humanAgentUntil: ahead(7 * 1440 - 25), preview: 'Can you send the price list?',
    messages: [msg('In', 'Hi, saw your reel. Do you have a Hindi demo?', 40), msg('In', 'Can you send the price list?', 25)],
    notes: [{ noteId: id(), author: 'Example teammate', text: 'Asked for the 30-bed price list. Send the PDF.', createdAt: ago(20) }],
  },
  {
    kind: 'dm', id: id(), channel: 'messenger', name: 'Example Hospital Admin', lastAt: ago(60 * 30), unread: 0, status: 'Open', assignedUserId: 'u-2',
    assignedName: 'Example teammate', windowClosesAt: null, humanAgentUntil: ahead(5 * 1440), preview: 'Thanks, we will discuss and come back.', leadId: 'lead-1',
    messages: [msg('In', 'We run a 50-bed hospital. What does the software cost?', 60 * 31), msg('Out', 'Hello! I have sent the plans by email. Can we call tomorrow?', 60 * 30.5), msg('In', 'Thanks, we will discuss and come back.', 60 * 30)],
    notes: [],
  },
];
const conv = (c: Contact): SocialConversation => {
  const out: Partial<Contact> = { ...c };
  delete out.messages;
  delete out.notes;
  return out as SocialConversation;
};
const commentConv = (c: SocialComment): SocialConversation => ({
  kind: 'comment', id: c.commentId, channel: c.channel, name: c.authorName ?? 'Someone', preview: c.text, lastAt: c.createdAt,
  unread: c.status === 'Open' ? 1 : 0, status: c.status === 'Done' ? 'Closed' : 'Open', leadId: c.leadId,
});

// ── compose ──────────────────────────────────────────────────────────────────

const media: Record<string, string> = {};
const draft = (p: Partial<SocialDraft>): SocialDraft => ({
  draftId: id(), accountId: 'acc-1', title: '', toFacebook: true, toInstagram: true, kind: 'Photo', media: [], whenMode: 'schedule', checklist: {},
  status: 'AwaitingApproval', createdBy: 'Example teammate', createdByUserId: 'u-2', createdAt: ago(600), updatedAt: ago(600), ...p,
});
const drafts: SocialDraft[] = [
  draft({ title: 'Free health camp, December', caption: 'Free health camp on Saturday. Register on WhatsApp.', scheduledAt: ahead(8 * 1440), kind: 'Photo', media: [{ key: 'mock/1.jpg', mime: 'image/jpeg', name: 'camp.jpg', size: 1 }] }),
  draft({ title: 'Doctor Dekho: Hindi reel', toFacebook: false, kind: 'Reel', caption: 'Book a doctor in your town, in Hindi.', scheduledAt: ahead(10 * 1440), media: [{ key: 'mock/2.mp4', mime: 'video/mp4', name: 'reel.mp4', size: 1 }] }),
  draft({ title: 'Webinar reminder', status: 'Scheduled', caption: 'Join our webinar on hospital records.', scheduledAt: ahead(4 * 1440), approvedBy: 'You (example)', approvedAt: ago(100), media: [{ key: 'mock/3.jpg', mime: 'image/jpeg', name: 'webinar.jpg', size: 1 }] }),
  draft({ title: 'Story: front desk poll', status: 'Failed', toFacebook: false, kind: 'Story', scheduledAt: ago(60 * 26), error: 'Meta could not fetch the picture (example).', media: [{ key: 'mock/4.jpg', mime: 'image/jpeg', name: 'poll.jpg', size: 1 }] }),
];
let slots: SocialSlot[] = [
  { slotId: id(), dayOfWeek: 2, time: '18:30', toFacebook: true, toInstagram: true },
  { slotId: id(), dayOfWeek: 4, time: '13:00', toFacebook: true, toInstagram: false },
  { slotId: id(), dayOfWeek: 6, time: '10:00', toFacebook: false, toInstagram: true },
];
const nextSlot = (d: SocialDraft): string | null => {
  const now = Date.now();
  for (let i = 0; i < 15; i++) {
    const day = new Date(now + i * 86_400_000);
    for (const s of slots.filter(s => s.dayOfWeek === day.getDay() && (!d.toFacebook || s.toFacebook) && (!d.toInstagram || s.toInstagram))) {
      const [h, m] = s.time.split(':').map(Number);
      const t = new Date(day); t.setHours(h, m, 0, 0);
      if (t.getTime() > now + 10 * min && !drafts.some(x => x.status === 'Scheduled' && x.scheduledAt && Math.abs(new Date(x.scheduledAt).getTime() - t.getTime()) < min)) return t.toISOString();
    }
  }
  return null;
};
const findDraft = (draftId: string) => drafts.find(d => d.draftId === draftId) ?? (() => { throw fail(404, 'This post does not exist.'); })();

// ── leads and ads ────────────────────────────────────────────────────────────

const lead = (name: string, source: string, m: number, extra: Partial<SocialLead> = {}): SocialLead => ({
  socialLeadId: id(), leadId: id(), name, phone: '+91 98000 000' + String(10 + Math.floor(m % 89)), source, answers: [], receivedAt: ago(m), stage: 'New', inCrm: true, ...extra,
});
const leads: SocialLead[] = [
  lead('Example Hospital Owner', 'form', 35, { formName: 'Demo request', adName: 'Reel: five questions', campaignName: '1HMS demo', platform: 'ig', answers: [{ name: 'City', value: 'Purnia' }, { name: 'Beds', value: '30' }] }),
  lead('Example Clinic Owner', 'instagram', 60 * 3, { stage: 'Contacted', owner: 'Example teammate', answers: [{ name: 'Interested in', value: '1HMS' }] }),
  lead('Example Doctor', 'form', 60 * 7, { formName: 'Doctor Dekho: list your clinic', adName: 'Carousel: book a doctor', campaignName: 'Doctor Dekho listing', platform: 'fb', answers: [{ name: 'Speciality', value: 'General physician' }] }),
  lead('Example Lab Manager', 'comment', 60 * 26, { stage: 'Demo Scheduled', owner: 'You (example)' }),
  lead('Example Nursing Home', 'form', 60 * 50, { formName: 'Demo request', adName: 'Photo: health camp', campaignName: '1HMS demo', platform: 'fb', stage: 'Closed Won', owner: 'Example teammate' }),
];
const forms: SocialLeadForm[] = [
  { formId: 'f1', name: 'Demo request', status: 'ACTIVE', metaCount: 16, crmCount: 15, missing: 1, checkedAt: ago(300) },
  { formId: 'f2', name: 'Doctor Dekho: list your clinic', status: 'ACTIVE', metaCount: 9, crmCount: 9, missing: 0, checkedAt: ago(300) },
];
const adRows: Record<AdLevel, SocialAdRow[]> = {
  campaign: [
    { id: 'c1', name: '1HMS demo', status: 'ACTIVE', spend: 11240, impressions: 81200, clicks: 1310, leads: 36, conversations: 9, costPerLead: 312 },
    { id: 'c2', name: 'Doctor Dekho listing', status: 'ACTIVE', spend: 5180, impressions: 41100, clicks: 640, leads: 19, conversations: 6, costPerLead: 273 },
    { id: 'c3', name: 'Health camp, November', status: 'PAUSED', spend: 2000, impressions: 11700, clicks: 190, leads: 4, conversations: 3, costPerLead: 500 },
  ],
  adset: [
    { id: 's1', name: 'Hospital owners, 25–55', parentName: '1HMS demo', status: 'ACTIVE', spend: 7400, impressions: 52000, clicks: 860, leads: 25, conversations: 6, costPerLead: 296 },
    { id: 's2', name: 'Clinic owners', parentName: '1HMS demo', status: 'ACTIVE', spend: 3840, impressions: 29200, clicks: 450, leads: 11, conversations: 3, costPerLead: 349 },
    { id: 's3', name: 'Doctors near the town', parentName: 'Doctor Dekho listing', status: 'ACTIVE', spend: 5180, impressions: 41100, clicks: 640, leads: 19, conversations: 6, costPerLead: 273 },
  ],
  ad: [
    { id: 'a1', name: 'Reel: five questions', parentName: 'Hospital owners, 25–55', status: 'ACTIVE', spend: 5100, impressions: 36000, clicks: 610, leads: 19, conversations: 4, costPerLead: 268 },
    { id: 'a2', name: 'Photo: health camp', parentName: 'Health camp, November', status: 'PAUSED', spend: 2000, impressions: 11700, clicks: 190, leads: 4, conversations: 3, costPerLead: 500 },
    { id: 'a3', name: 'Carousel: book a doctor', parentName: 'Doctors near the town', status: 'ACTIVE', spend: 5180, impressions: 41100, clicks: 640, leads: 19, conversations: 6, costPerLead: 273 },
  ],
};

const checksFor = (a: SocialSetup): SocialChecks => {
  const ok = a.connected;
  return {
    ready: ok,
    items: [
      { key: 'keys', label: 'Meta keys saved', state: a.hasToken && a.hasAppSecret ? 'ok' : 'todo' },
      { key: 'token', label: 'The token works', state: a.hasToken ? 'ok' : 'todo', detail: a.hasToken ? 'Example system user' : null },
      { key: 'page', label: 'Facebook Page chosen', state: a.pageId ? 'ok' : 'todo', detail: a.pageName },
      { key: 'instagram', label: 'Instagram account linked to the Page', state: a.igUserId ? 'ok' : 'todo', detail: a.igUsername ? '@' + a.igUsername : null },
      { key: 'ads', label: 'Ad account chosen', state: a.adAccountId ? 'ok' : 'todo', detail: a.adAccountName },
      { key: 'webhooks', label: 'Comments, messages and leads come to the CMS', state: a.webhooksConnectedAt ? 'ok' : 'todo', detail: a.lastWebhookAt ? 'Last one 4 min ago (example)' : null },
    ],
    permissions: [
      { for: 'Read posts and their numbers', permissions: 'pages_read_engagement, instagram_basic, instagram_manage_insights', state: ok ? 'granted' : 'unknown' },
      { for: 'Publish posts', permissions: 'pages_manage_posts, instagram_content_publish', state: ok ? 'granted' : 'unknown' },
      { for: 'Comments', permissions: 'pages_manage_engagement, instagram_manage_comments', state: ok ? 'granted' : 'unknown' },
      { for: 'Messenger', permissions: 'pages_messaging', state: ok ? 'granted' : 'unknown' },
      { for: 'Instagram messages', permissions: 'instagram_manage_messages (App Review)', state: ok ? 'missing' : 'unknown' },
      { for: 'Lead forms', permissions: 'leads_retrieval', state: ok ? 'granted' : 'unknown' },
      { for: 'Ads', permissions: 'ads_read', state: ok ? 'granted' : 'unknown' },
    ],
  };
};

export const mockSocial = {
  accounts: async (): Promise<SocialAccount[]> => { await pause(); return accounts.map(pub); },
  createAccount: async (name: string): Promise<SocialSetup> => {
    await pause();
    const a: SocialSetup = { accountId: id(), name: name.trim() || 'New account', currency: 'INR', connected: false, canEdit: true, hasAppSecret: false, hasToken: false, unreadable: false, canEncrypt: true, suggestedWebhookUrl: accounts[0].suggestedWebhookUrl };
    accounts.push(a);
    return a;
  },
  setup: async (accountId: string): Promise<SocialSetup> => { await pause(); return { ...acct(accountId) }; },
  saveKeys: async (accountId: string, p: SocialKeysSave): Promise<SocialSetup> => {
    await pause();
    const a = acct(accountId);
    if (p.name?.trim()) a.name = p.name.trim();
    if (p.appId != null) a.appId = p.appId;
    if (p.appSecret) a.hasAppSecret = true;
    if (p.token) { a.hasToken = true; a.tokenHint = '…' + p.token.slice(-4); }
    if (p.clearToken) { a.hasToken = false; a.tokenHint = null; a.connected = false; }
    return { ...a };
  },
  discover: async (accountId: string): Promise<MetaAssets> => {
    await pause();
    if (!acct(accountId).hasToken) throw fail(400, 'Save the token first.');
    return {
      userName: 'Example system user', permissions: ['pages_read_engagement', 'pages_manage_posts', 'leads_retrieval'],
      pages: [{ id: '1001', name: '[Page name]', instagramId: '1002', instagramUsername: '[handle]' }, { id: '2001', name: '[Second Page name]' }],
      adAccounts: [{ id: 'act_1', name: '[Ad account name]', currency: 'INR', status: 1 }],
    };
  },
  chooseAssets: async (accountId: string, p: { pageId?: string | null; adAccountId?: string | null }): Promise<SocialSetup> => {
    await pause();
    const a = acct(accountId);
    a.pageId = p.pageId; a.pageName = p.pageId === '1001' ? '[Page name]' : p.pageId ? '[Second Page name]' : null;
    a.igUserId = p.pageId === '1001' ? '1002' : null; a.igUsername = p.pageId === '1001' ? '[handle]' : null;
    a.adAccountId = p.adAccountId; a.adAccountName = p.adAccountId ? '[Ad account name]' : null;
    a.connected = !!a.pageId && a.hasToken;
    return { ...a };
  },
  checks: async (accountId: string): Promise<SocialChecks> => { await pause(); return checksFor(acct(accountId)); },
  connectWebhooks: async (accountId: string, url: string): Promise<SocialChecks> => {
    await pause();
    if (!url.startsWith('https://')) throw fail(400, 'Meta calls only https addresses.');
    const a = acct(accountId);
    a.webhookUrl = url; a.webhooksConnectedAt = new Date().toISOString();
    return checksFor(a);
  },
  sync: async () => { await pause(); return { message: 'Reading from Meta now; this can take a few minutes.' }; },

  posts: async (q: SocialPostQuery): Promise<SocialPostPage> => {
    await pause();
    if (q.accountId !== 'acc-1') return { items: [], total: 0, summary: { posts: 0, facebookPosts: 0, instagramPosts: 0, views: 0, interactions: 0 } };
    let items = posts.filter(p => (!q.channel || p.channel === q.channel) && (!q.type || p.type === q.type) && (!q.from || p.publishedAt >= q.from)
      && (!q.search || (p.caption ?? '').toLowerCase().includes(q.search.toLowerCase())));
    if (q.sort === 'views') items = [...items].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (q.sort === 'interactions') items = [...items].sort((a, b) => interactions(b) - interactions(a));
    const views = items.reduce((s, p) => s + (p.views ?? 0), 0);
    return {
      items, total: items.length, syncedAt: ago(52),
      summary: {
        posts: items.length, facebookPosts: items.filter(p => p.channel === 'facebook').length, instagramPosts: items.filter(p => p.channel === 'instagram').length,
        views, previousViews: Math.round(views / 1.18), interactions: items.reduce((s, p) => s + interactions(p), 0), newFacebookFollowers: 74, newInstagramFollowers: 138,
      },
    };
  },
  post: async (postId: string): Promise<SocialPostDetail> => {
    await pause();
    const p = posts.find(x => x.postId === postId);
    if (!p) throw fail(404, 'This post does not exist.');
    const share = [0.42, 0.21, 0.12, 0.09, 0.07, 0.05, 0.04];
    return {
      post: p,
      days: share.map((s, i) => ({ day: new Date(new Date(p.publishedAt).getTime() + i * 86_400_000).toISOString(), views: Math.round((p.views ?? 0) * s), likes: Math.round((p.likes ?? 0) * s), comments: Math.round((p.comments ?? 0) * s) })),
      comments: comments.filter(c => c.postId === postId),
      metrics: Object.fromEntries(Object.entries({ views: p.views, reach: p.reach, likes: p.likes, comments: p.comments, shares: p.shares, saved: p.saves, clicks: p.clicks }).filter(([, v]) => v != null)) as Record<string, number>,
    };
  },

  upload: async (file: File): Promise<SocialMediaRef> => {
    await pause();
    const key = `mock/${id()}-${file.name}`;
    media[key] = URL.createObjectURL(file);
    return { key, mime: file.type, name: file.name, size: file.size };
  },
  media: async (key: string): Promise<Blob> => {
    if (media[key]) return (await fetch(media[key])).blob();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="#e0eaff"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#3538cd">Example picture</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  },
  drafts: async (accountId: string, status?: string): Promise<SocialDraft[]> => {
    await pause();
    return drafts.filter(d => d.accountId === accountId && d.status !== 'Cancelled' && (!status || (status === 'open' ? !['Published', 'Cancelled'].includes(d.status) : d.status === status)));
  },
  draft: async (draftId: string): Promise<SocialDraft> => { await pause(); return { ...findDraft(draftId) }; },
  saveDraft: async (draftId: string | null, p: SocialDraftSave): Promise<SocialDraft> => {
    await pause();
    if (draftId) {
      const d = findDraft(draftId);
      if (!['Draft', 'SentBack', 'AwaitingApproval', 'Scheduled', 'Failed'].includes(d.status)) throw fail(409, 'This post can no longer be changed.');
      const changed = JSON.stringify([d.caption, d.facebookCaption, d.instagramCaption, d.media, d.kind, d.link, d.toFacebook, d.toInstagram]) !== JSON.stringify([p.caption, p.facebookCaption, p.instagramCaption, p.media, p.kind, p.link, p.toFacebook, p.toInstagram]);
      Object.assign(d, p, { updatedAt: new Date().toISOString() });
      if (changed && (d.status === 'Scheduled' || d.status === 'Failed')) { d.status = 'AwaitingApproval'; d.approvedBy = null; d.approvedAt = null; }
      return { ...d };
    }
    const d = draft({ ...p, status: 'Draft', createdBy: ME.fullName, createdByUserId: ME.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    drafts.unshift(d);
    return { ...d };
  },
  draftAction: async (draftId: string, action: 'submit' | 'approve' | 'cancel' | 'retry') => {
    await pause();
    const d = findDraft(draftId);
    const problem = checkPost(d);
    if ((action === 'submit' || action === 'approve') && problem) throw fail(400, problem);
    if (action === 'submit') { d.status = 'AwaitingApproval'; d.sentBackNote = null; return { data: { ...d }, message: 'Sent for approval.' }; }
    if (action === 'approve') {
      if (!d.checklist.noTestimonials || !d.checklist.factsBackedUp) throw fail(400, 'Tick the checks under "Before it goes out" first.');
      if (d.whenMode === 'queue') {
        const s = nextSlot(d);
        if (!s) throw fail(409, 'No free queue slot in the next two weeks for these channels. Add slots in Calendar, or schedule a time.');
        d.scheduledAt = s;
      } else if (d.whenMode === 'approved' || !d.scheduledAt || d.scheduledAt < new Date().toISOString()) d.scheduledAt = new Date().toISOString();
      d.status = 'Scheduled'; d.approvedBy = ME.fullName; d.approvedAt = new Date().toISOString();
      return { data: { ...d }, message: d.whenMode === 'approved' ? 'Approved. It goes out within a minute.' : 'Approved.' };
    }
    if (action === 'cancel') { d.status = 'Cancelled'; return { data: { ...d }, message: 'Cancelled.' }; }
    d.status = 'Scheduled'; d.error = null; d.scheduledAt = new Date().toISOString();
    return { data: { ...d }, message: 'Trying again within a minute.' };
  },
  sendBack: async (draftId: string, note: string): Promise<SocialDraft> => {
    await pause();
    const d = findDraft(draftId);
    d.status = 'SentBack'; d.sentBackNote = note; d.approvedBy = null; d.approvedAt = null;
    return { ...d };
  },
  calendar: async (accountId: string, from: string, to: string): Promise<SocialCalendarItem[]> => {
    await pause();
    if (accountId !== 'acc-1') return [];
    const fromPosts: SocialCalendarItem[] = posts.map(p => ({ postId: p.postId, title: p.caption ?? p.type, channels: [p.channel], at: p.publishedAt, status: 'Published' }));
    const fromDrafts: SocialCalendarItem[] = drafts.filter(d => d.scheduledAt && !['Cancelled', 'Published'].includes(d.status)).map(d => ({
      draftId: d.draftId, title: d.title || d.caption || d.kind, channels: [...(d.toFacebook ? ['facebook' as const] : []), ...(d.toInstagram ? ['instagram' as const] : [])], at: d.scheduledAt!, status: d.status, error: d.error,
    }));
    return [...fromPosts, ...fromDrafts].filter(i => i.at >= from && i.at <= to + 'T23:59:59');
  },
  slots: async (): Promise<SocialSlot[]> => { await pause(); return slots.map(s => ({ ...s })); },
  saveSlots: async (accountId: string, next: SocialSlot[]): Promise<SocialSlot[]> => { await pause(); acct(accountId); slots = next.map(s => ({ ...s, slotId: s.slotId ?? id() })); return slots; },
  approvers: async (): Promise<SocialPerson[]> => { await pause(); return TEAM; },
  publishingLimit: async () => { await pause(); return { used: 3, total: 50 }; },

  inbox: async (q: { accountId: string; channel?: InboxChannel; view?: InboxView; search?: string }): Promise<SocialConversation[]> => {
    await pause();
    if (q.accountId !== 'acc-1') return [];
    const list = [
      ...(q.channel === 'comments' ? [] : contacts.filter(c => !q.channel || c.channel === q.channel).map(conv)),
      ...(q.channel && q.channel !== 'comments' ? [] : comments.map(commentConv)),
    ];
    const view = q.view ?? 'open';
    return list
      .filter(c => view === 'all' || (view === 'closed' ? c.status === 'Closed' : c.status !== 'Closed'))
      .filter(c => view !== 'mine' || c.assignedUserId === ME.userId)
      .filter(c => view !== 'unassigned' || !c.assignedUserId)
      .filter(c => view !== 'unread' || c.unread > 0)
      .filter(c => !q.search || `${c.name} ${c.preview ?? ''}`.toLowerCase().includes(q.search.toLowerCase()))
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  },
  unread: async (): Promise<number> => contacts.reduce((s, c) => s + c.unread, 0) + comments.filter(c => c.status === 'Open').length,
  agents: async (): Promise<SocialPerson[]> => { await pause(); return TEAM; },
  thread: async (contactId: string): Promise<SocialThread> => {
    await pause();
    const c = contacts.find(x => x.id === contactId);
    if (!c) throw fail(404, 'This conversation does not exist.');
    c.unread = 0;
    const now = new Date().toISOString();
    return { conversation: conv(c), messages: [...c.messages], notes: [...c.notes], windowOpen: !!c.windowClosesAt && c.windowClosesAt > now, humanAgentOpen: !!c.humanAgentUntil && c.humanAgentUntil > now };
  },
  send: async (contactId: string, text?: string, file?: File | null): Promise<SocialMessage> => {
    await pause();
    const c = contacts.find(x => x.id === contactId)!;
    const now = new Date().toISOString();
    if (!(c.windowClosesAt && c.windowClosesAt > now) && !(c.humanAgentUntil && c.humanAgentUntil > now)) throw fail(409, 'More than 7 days since their last message: Meta does not allow a reply now.');
    const m = msg('Out', text ?? '', 0, { sentBy: ME.fullName, status: 'sent', humanAgent: !(c.windowClosesAt && c.windowClosesAt > now), attachments: file ? [{ type: file.type.startsWith('image/') ? 'image' : 'file', name: file.name }] : [] });
    c.messages.push(m); c.lastAt = m.createdAt; c.preview = text || file?.name;
    return m;
  },
  note: async (contactId: string, text: string): Promise<SocialNote> => {
    await pause();
    const n = { noteId: id(), author: ME.fullName, text, createdAt: new Date().toISOString() };
    contacts.find(x => x.id === contactId)!.notes.push(n);
    return n;
  },
  assign: async (cid: string, userId: string | null): Promise<SocialConversation> => {
    await pause();
    const c = contacts.find(x => x.id === cid)!;
    c.assignedUserId = userId; c.assignedName = TEAM.find(t => t.userId === userId)?.fullName ?? null;
    return conv(c);
  },
  setStatus: async (contactId: string, status: 'Open' | 'Closed'): Promise<SocialConversation> => {
    await pause();
    const c = contacts.find(x => x.id === contactId)!;
    c.status = status;
    return conv(c);
  },
  leadFromChat: async (contactId: string, p: SocialMakeLead): Promise<SocialLead> => {
    await pause();
    const c = contacts.find(x => x.id === contactId)!;
    if (c.leadId) throw fail(409, 'This conversation is already a lead.');
    if (!p.name.trim()) throw fail(400, 'Give their name.');
    const l = lead(p.name, c.channel, 0, { phone: p.phone, answers: p.interestedIn ? [{ name: 'Interested in', value: p.interestedIn }] : [] });
    leads.unshift(l); c.leadId = l.leadId;
    return l;
  },
  comment: async (commentId: string): Promise<SocialComment> => {
    await pause();
    const c = comments.find(x => x.commentId === commentId);
    if (!c) throw fail(404, 'This comment does not exist.');
    return { ...c, replies: [...c.replies] };
  },
  replyToComment: async (commentId: string, text: string, isPrivate = false): Promise<SocialComment> => {
    await pause();
    const c = comments.find(x => x.commentId === commentId)!;
    if (isPrivate) {
      if (!c.canPrivateReply) throw fail(409, 'A private reply was already sent, or the comment is older than 7 days.');
      c.privateReplyAt = new Date().toISOString(); c.canPrivateReply = false;
    } else {
      c.replies.push({ ...comment(posts[0], '[Page name]', text, 0, { fromUs: true, status: 'Done', canPrivateReply: false }), channel: c.channel });
    }
    c.status = 'Done'; c.repliedBy = ME.fullName;
    return { ...c, replies: [...c.replies] };
  },
  hideComment: async (commentId: string, hidden: boolean): Promise<SocialComment> => {
    await pause();
    const c = comments.find(x => x.commentId === commentId)!;
    c.hidden = hidden;
    return { ...c };
  },
  commentDone: async (commentId: string, done: boolean): Promise<SocialComment> => {
    await pause();
    const c = comments.find(x => x.commentId === commentId)!;
    c.status = done ? 'Done' : 'Open';
    return { ...c };
  },
  leadFromComment: async (commentId: string, p: SocialMakeLead): Promise<SocialLead> => {
    await pause();
    const c = comments.find(x => x.commentId === commentId)!;
    if (c.leadId) throw fail(409, 'This comment is already a lead.');
    if (!p.name.trim()) throw fail(400, 'Give their name.');
    const l = lead(p.name, 'comment', 0, { phone: p.phone });
    leads.unshift(l); c.leadId = l.leadId;
    return l;
  },

  leads: async (q: SocialLeadQuery): Promise<SocialLeadPage> => {
    await pause();
    if (q.accountId !== 'acc-1') return { items: [], total: 0, forms: [], summary: { last7Days: 0, fromForms7: 0, fromChats7: 0, notContacted: 0, customers: 0 } };
    const items = leads.filter(l => (!q.source || l.source === q.source) && (!q.formId || l.formName === forms.find(f => f.formId === q.formId)?.name));
    const week = leads.filter(l => l.receivedAt >= ago(7 * 1440));
    const fresh = leads.filter(l => l.stage === 'New');
    return {
      items, total: items.length, forms,
      summary: {
        last7Days: week.length, fromForms7: week.filter(l => l.source === 'form').length, fromChats7: week.filter(l => l.source !== 'form').length,
        notContacted: fresh.length, oldestNotContactedAt: fresh.map(l => l.receivedAt).sort()[0] ?? null, customers: leads.filter(l => l.stage === 'Closed Won').length,
      },
    };
  },
  checkForms: async (): Promise<SocialLeadForm[]> => { await pause(); forms.forEach(f => { f.checkedAt = new Date().toISOString(); }); return forms.map(f => ({ ...f })); },
  importMissing: async (accountId: string, formId: string) => {
    await pause();
    acct(accountId);
    const f = forms.find(x => x.formId === formId)!;
    const count = f.missing;
    for (let i = 0; i < count; i++) leads.unshift(lead('Example missed lead', 'form', 60 * 30, { formName: f.name, adName: 'Reel: five questions', campaignName: '1HMS demo' }));
    f.crmCount = f.metaCount; f.missing = 0;
    return { data: count, message: `${count} lead${count === 1 ? '' : 's'} brought in.` };
  },

  ads: async (q: { accountId: string; from: string; to: string; level: AdLevel }): Promise<SocialAds> => {
    await pause();
    const from = new Date(q.from), to = new Date(q.to);
    const days = [];
    for (let t = new Date(from); t <= to; t = new Date(t.getTime() + 86_400_000)) {
      const k = t.getDate();
      days.push({ day: t.toISOString(), spend: q.accountId === 'acc-1' ? 420 + ((k * 137) % 490) : 0, leads: q.accountId === 'acc-1' ? (k * 7) % 4 : 0 });
    }
    const rows = q.accountId === 'acc-1' ? adRows[q.level] : [];
    const spend = days.reduce((s, d) => s + d.spend, 0);
    const lds = days.reduce((s, d) => s + d.leads, 0);
    return {
      currency: 'INR', spend, impressions: Math.round(spend * 7.3), clicks: Math.round(spend * 0.116), leads: lds, conversations: Math.round(lds * 0.3),
      costPerLead: lds ? Math.round(spend / lds) : null, previousCostPerLead: lds ? Math.round((spend / lds) * 1.1) : null, customers: q.accountId === 'acc-1' ? 4 : 0,
      days, rows, syncedAt: ago(70),
    };
  },
};
