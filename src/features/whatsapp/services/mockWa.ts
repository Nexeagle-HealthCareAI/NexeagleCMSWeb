import type {
  ChatView, WaAgent, WaBroadcast, WaBroadcastPreview, WaBroadcastRequest, WaChat, WaContact, WaContactPage, WaContactQuery,
  WaImportCommon, WaImportResult, WaImportRow, WaMessage, WaMetaSpendDay, WaNote, WaNumber, WaProfile, WaRate, WaRecipient,
  WaSaveContact, WaSaveTemplate, WaSettings, WaSpend, WaTemplate, WaThread,
} from '../types';
import { fill, requiredKeys, variablesIn } from '../waUtils';

// In-memory stand-in used when VITE_WA_MOCK=true. Example data only (made-up names and numbers); resets on reload.

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const id = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
const pause = () => new Promise(r => setTimeout(r, 120));
const display = (p: string) => (p.startsWith('91') && p.length === 12 ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`);
const normal = (raw: string): string | null => {
  let d = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && '6789'.includes(d[0])) d = '91' + d;
  return d.length >= 8 && d.length <= 15 && d[0] !== '0' ? d : null;
};

/** "Dr Asha Rao" → "Dr Asha"; "Asha Rao" → "Asha" (as the API does). */
const firstName = (name?: string | null) => {
  const w = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return ['dr', 'mr', 'mrs', 'ms'].includes(w[0].replace(/\.$/, '').toLowerCase()) && w.length > 1 ? `${w[0]} ${w[1]}` : w[0];
};

const ME: WaAgent = { userId: 'u-me', fullName: 'You (example)' };
const AGENTS: WaAgent[] = [ME, { userId: 'u-2', fullName: 'Example teammate' }];

const contact = (phone: string, name: string, source: string, optIn: WaContact['optIn'], extra: Partial<WaContact> = {}): WaContact => ({
  contactId: id(), phone, displayPhone: display(phone), name, profileName: name, source, optIn, tags: [], unreadCount: 0, chatStatus: 'Open',
  attributes: {}, createdAt: ago(60 * 24 * 10), optInSource: optIn === 'OptedIn' ? 'Example: signed up at a health camp' : null, ...extra,
});

const contacts: WaContact[] = [
  contact('919800000001', 'Example Hospital A', 'Lead', 'OptedIn', { tags: ['hospital', 'pune'], attributes: { city: 'Pune' }, lastInboundAt: ago(35), lastMessageAt: ago(35), lastMessagePreview: 'Can you share the pricing?', unreadCount: 2 }),
  contact('919800000002', 'Dr Example Doctor', 'Lead', 'OptedIn', { tags: ['doctor'], attributes: { speciality: 'Cardiology' }, lastInboundAt: ago(60 * 30), lastMessageAt: ago(60 * 30), lastMessagePreview: 'Thanks, will check.' }),
  contact('919800000003', 'Example Patient', 'DoctorDekho', 'OptedIn', { lastMessageAt: ago(60 * 50), lastMessagePreview: 'Template: camp_invite' }),
  contact('919800000004', 'Example Clinic', 'Import', 'Unknown', { tags: ['clinic'] }),
  contact('919800000005', 'Example Lab', 'Import', 'OptedOut', { optOutAt: ago(60 * 24 * 2), optOutReason: 'Replied STOP' }),
];
contacts.forEach(c => { c.windowClosesAt = c.lastInboundAt ? new Date(new Date(c.lastInboundAt).getTime() + 86_400_000).toISOString() : null; });

const msg = (contactId: string, direction: 'In' | 'Out', body: string, min: number, extra: Partial<WaMessage> = {}): WaMessage & { contactId: string } => ({
  contactId, messageId: id(), direction, type: 'text', body, hasMedia: false, status: direction === 'In' ? 'received' : 'read',
  statusAt: ago(min), cost: 0, createdAt: ago(min), sentBy: direction === 'Out' ? 'Example teammate' : null, ...extra,
});
const messages: (WaMessage & { contactId: string })[] = [
  msg(contacts[0].contactId, 'Out', 'Hello! Example Hospital A, NexEagle can help with your hospital software.', 60 * 3, { type: 'template', templateName: 'intro_offer', cost: 0.8631 }),
  msg(contacts[0].contactId, 'In', 'Interesting. What does it include?', 40),
  msg(contacts[0].contactId, 'In', 'Can you share the pricing?', 35),
  msg(contacts[1].contactId, 'Out', 'Hello Dr Example, here is the brochure you asked for.', 60 * 31),
  msg(contacts[1].contactId, 'In', 'Thanks, will check.', 60 * 30),
  msg(contacts[2].contactId, 'Out', 'Hello Example, our free health camp is on Sunday.', 60 * 50, { type: 'template', templateName: 'camp_invite', status: 'delivered', cost: 0.8631 }),
];
const notes: (WaNote & { contactId: string })[] = [
  { contactId: contacts[0].contactId, noteId: id(), author: 'Example teammate', userId: 'u-2', text: 'Asked about the 50-bed plan last month.', createdAt: ago(38) },
];

const templates: WaTemplate[] = [
  {
    templateId: id(), name: 'camp_invite', language: 'en', category: 'MARKETING', status: 'APPROVED', parameterFormat: 'POSITIONAL', headerFormat: 'TEXT',
    headerText: 'Free health camp', body: 'Hello {{1}}, our free health camp is on {{2}}. Reply YES to book a slot.', footer: 'Reply STOP to stop these messages',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book a slot' }, { type: 'QUICK_REPLY', text: 'Stop promotions' }], headerVariables: [], bodyVariables: ['1', '2'],
    urlButtonVariable: false, hasSampleMedia: false, updatedAt: ago(60 * 24 * 3), qualityScore: 'GREEN',
  },
  {
    templateId: id(), name: 'intro_offer', language: 'en', category: 'MARKETING', status: 'APPROVED', parameterFormat: 'POSITIONAL', headerFormat: 'IMAGE',
    body: 'Hello! {{1}}, NexEagle can help with your hospital software.', buttons: [{ type: 'URL', text: 'See plans', url: 'https://example.com/plans' }],
    headerVariables: [], bodyVariables: ['1'], urlButtonVariable: false, hasSampleMedia: true, updatedAt: ago(60 * 24 * 9),
  },
  {
    templateId: id(), name: 'diwali_greeting', language: 'en', category: 'MARKETING', status: 'PENDING', parameterFormat: 'POSITIONAL', headerFormat: 'NONE',
    body: 'Happy Diwali, {{1}}!', buttons: [], headerVariables: [], bodyVariables: ['1'], urlButtonVariable: false, hasSampleMedia: false, updatedAt: ago(90),
  },
  {
    templateId: id(), name: 'big_discount', language: 'en', category: 'MARKETING', status: 'REJECTED', rejectedReason: 'INVALID_FORMAT', parameterFormat: 'POSITIONAL',
    headerFormat: 'NONE', body: '{{1}} 90% off!!!', buttons: [], headerVariables: [], bodyVariables: ['1'], urlButtonVariable: false, hasSampleMedia: false, updatedAt: ago(60 * 24),
  },
];

const broadcasts: WaBroadcast[] = [
  {
    broadcastId: id(), name: 'Example: November camp', templateId: templates[0].templateId, templateName: 'camp_invite', category: 'MARKETING', status: 'Done',
    scheduledAt: ago(60 * 52), startedAt: ago(60 * 52), finishedAt: ago(60 * 51), recipients: 120, pending: 0, sent: 118, delivered: 112, read: 80, failed: 2, replied: 14,
    estimatedCost: 103.57, actualCost: 96.67, currency: 'INR', createdBy: 'Example teammate', createdAt: ago(60 * 53),
  },
];
const recipients: Record<string, WaRecipient[]> = {
  [broadcasts[0].broadcastId]: [
    { contactId: contacts[2].contactId, displayPhone: contacts[2].displayPhone, name: contacts[2].name, status: 'Sent', sentAt: ago(60 * 52) },
    { contactId: id(), displayPhone: '+91 98000 00099', name: 'Example failed', status: 'Failed', error: 'This number is not on WhatsApp.' },
  ],
};

let settings: WaSettings = {
  monthlyBudget: 5000, currency: 'INR', sendPerSecond: 20,
  rates: [
    { country: 'IN', category: 'marketing', rate: 0.8631, currency: 'INR' },
    { country: 'IN', category: 'utility', rate: 0.115, currency: 'INR' },
    { country: 'IN', category: 'authentication', rate: 0.115, currency: 'INR' },
  ],
};
let profile: WaProfile = { about: 'Hospital software for India (example)', description: 'Example business description.', email: 'hello@example.com', websites: ['https://example.com'], vertical: 'HEALTH', address: 'Example address' };

const chatOf = (c: WaContact): WaChat => {
  const chat: WaChat = {
    contactId: c.contactId, phone: c.phone, displayPhone: c.displayPhone, name: c.name, profileName: c.profileName, source: c.source, optIn: c.optIn,
    tags: c.tags, lastMessageAt: c.lastMessageAt, lastMessagePreview: c.lastMessagePreview, unreadCount: c.unreadCount, chatStatus: c.chatStatus,
    assignedUserId: c.assignedUserId, windowClosesAt: c.windowClosesAt,
  };
  return { ...chat, assignedName: AGENTS.find(a => a.userId === c.assignedUserId)?.fullName ?? null };
};
const find = (contactId: string) => {
  const c = contacts.find(x => x.contactId === contactId);
  if (!c) throw new Error('This chat does not exist.');
  return c;
};
const open = (c: WaContact) => !!c.windowClosesAt && new Date(c.windowClosesAt) > new Date();
const spentThisMonth = () => messages.filter(m => m.direction === 'Out' && new Date(m.createdAt).getMonth() === new Date().getMonth()).reduce((s, m) => s + m.cost, 0) + 96.67;
const rate = (cat: string) => settings.rates.find(r => r.country === 'IN' && r.category === cat.toLowerCase())?.rate ?? 0;

const send = (c: WaContact, m: Partial<WaMessage>): WaMessage => {
  const row = msg(c.contactId, 'Out', m.body ?? '', 0, { status: 'sent', sentBy: ME.fullName, ...m });
  messages.push(row);
  c.lastMessageAt = row.createdAt;
  c.lastMessagePreview = (m.templateName ? `Template: ${m.templateName}` : m.body) ?? '';
  c.assignedUserId ??= ME.userId;
  return row;
};

const plan = (r: WaBroadcastRequest) => {
  const t = templates.find(x => x.templateId === r.templateId);
  if (!t) throw new Error('Choose a template.');
  if (t.status !== 'APPROVED') throw new Error('Only templates Meta has approved can be broadcast.');
  for (const k of requiredKeys(t)) if (!r.variables[k]) throw new Error(`Say how to fill ${k}.`);
  let matched = r.audience.contactIds.length ? contacts.filter(c => r.audience.contactIds.includes(c.contactId)) : contacts.slice();
  if (!r.audience.contactIds.length && r.audience.sources.length) matched = matched.filter(c => r.audience.sources.includes(c.source));
  if (!r.audience.contactIds.length && r.audience.tags.length) matched = matched.filter(c => c.tags.some(tag => r.audience.tags.includes(tag)));
  const sending = matched.filter(c => c.optIn === 'OptedIn');
  return { t, matched, sending, estimate: sending.length * rate(t.category) };
};

export const mockWa = {
  chats: async (q: { view?: ChatView; search?: string }) => {
    await pause();
    const s = q.search?.trim().toLowerCase();
    return contacts
      .filter(c => c.lastMessageAt)
      .filter(c => {
        switch (q.view ?? 'open') {
          case 'open': return c.chatStatus === 'Open';
          case 'closed': return c.chatStatus === 'Closed';
          case 'mine': return c.assignedUserId === ME.userId && c.chatStatus === 'Open';
          case 'unassigned': return !c.assignedUserId && c.chatStatus === 'Open';
          case 'unread': return c.unreadCount > 0;
          default: return true;
        }
      })
      .filter(c => !s || `${c.name} ${c.profileName} ${c.phone}`.toLowerCase().includes(s))
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
      .map(chatOf);
  },
  thread: async (contactId: string): Promise<WaThread> => {
    await pause();
    const c = find(contactId);
    c.unreadCount = 0;
    return { contact: { ...c }, messages: messages.filter(m => m.contactId === contactId), notes: notes.filter(n => n.contactId === contactId), windowOpen: open(c) };
  },
  threadSince: async (contactId: string, after: string): Promise<WaThread> => {
    const c = find(contactId);
    return {
      contact: { ...c }, windowOpen: open(c),
      messages: messages.filter(m => m.contactId === contactId && (m.createdAt > after || (m.statusAt ?? '') > after)),
      notes: notes.filter(n => n.contactId === contactId && n.createdAt > after),
    };
  },
  sendText: async (contactId: string, text: string) => {
    await pause();
    const c = find(contactId);
    if (!open(c)) throw new Error('More than 24 hours since their last message: send an approved template instead.');
    return send(c, { body: text });
  },
  sendMedia: async (contactId: string, file: File, caption?: string) => {
    await pause();
    const c = find(contactId);
    if (!open(c)) throw new Error('More than 24 hours since their last message: send an approved template instead.');
    return send(c, { type: file.type.startsWith('image/') ? 'image' : 'document', body: caption ?? null, hasMedia: true, mediaMime: file.type, mediaName: file.name });
  },
  sendTemplate: async (contactId: string, p: { templateId: string; values: Record<string, string>; headerMediaUrl?: string }) => {
    await pause();
    const c = find(contactId);
    if (c.optIn === 'OptedOut') throw new Error('This person asked not to get messages.');
    const t = templates.find(x => x.templateId === p.templateId)!;
    return send(c, { type: 'template', templateName: t.name, body: fill(t.body, p.values), cost: rate(t.category) });
  },
  addNote: async (contactId: string, text: string) => {
    const n = { contactId, noteId: id(), author: ME.fullName, userId: ME.userId, text, createdAt: new Date().toISOString() };
    notes.push(n);
    return n;
  },
  assign: async (contactId: string, userId: string | null) => { const c = find(contactId); c.assignedUserId = userId; return chatOf(c); },
  setStatus: async (contactId: string, status: 'Open' | 'Closed') => { const c = find(contactId); c.chatStatus = status; return chatOf(c); },
  media: async () => new Blob(['Example file'], { type: 'text/plain' }),
  unread: async () => contacts.filter(c => c.unreadCount > 0).length,
  agents: async () => AGENTS,

  contacts: async (q: WaContactQuery): Promise<WaContactPage> => {
    await pause();
    const s = q.search?.trim().toLowerCase();
    const list = contacts
      .filter(c => !s || `${c.name} ${c.phone}`.toLowerCase().includes(s))
      .filter(c => !q.optIn || c.optIn === q.optIn)
      .filter(c => !q.source || c.source === q.source)
      .filter(c => !q.tag || c.tags.includes(q.tag));
    const size = q.pageSize ?? 50;
    const page = q.page ?? 1;
    return { items: list.slice((page - 1) * size, page * size), total: list.length, allTags: [...new Set(contacts.flatMap(c => c.tags))].sort() };
  },
  contact: async (cid: string) => ({ ...find(cid) }),
  createContact: async (p: WaSaveContact) => {
    const phone = normal(p.phone);
    if (!phone) throw new Error('This is not a phone number.');
    if (contacts.some(c => c.phone === phone)) throw new Error('This number is already a contact.');
    if (p.optIn === 'OptedIn' && !p.optInSource?.trim()) throw new Error('Say how they agreed to WhatsApp messages.');
    const c = contact(phone, p.name ?? '', 'Manual', p.optIn ?? 'Unknown', { tags: p.tags ?? [], attributes: p.attributes ?? {}, optInSource: p.optInSource ?? null, createdAt: new Date().toISOString() });
    contacts.push(c);
    return c;
  },
  updateContact: async (cid: string, p: WaSaveContact) => {
    const c = find(cid);
    if (p.optIn === 'OptedIn' && c.optIn !== 'OptedIn' && !p.optInSource?.trim()) throw new Error('Say how they agreed to WhatsApp messages.');
    Object.assign(c, { name: p.name ?? c.name, tags: p.tags ?? c.tags, attributes: p.attributes ?? c.attributes });
    if (p.optIn && p.optIn !== c.optIn) {
      c.optIn = p.optIn;
      if (p.optIn === 'OptedIn') { c.optInSource = p.optInSource ?? null; c.optInBy = ME.fullName; c.optInAt = new Date().toISOString(); }
      if (p.optIn === 'OptedOut') { c.optOutAt = new Date().toISOString(); c.optOutReason = 'Changed in the CMS'; }
    }
    return { ...c };
  },
  importRows: async (rows: WaImportRow[], o: WaImportCommon): Promise<WaImportResult> => {
    await pause();
    if (o.allOptedIn && !o.optInSource?.trim()) throw new Error('Say how they agreed to WhatsApp messages.');
    const result: WaImportResult = { added: 0, updated: 0, skipped: 0, problems: [] };
    for (const r of rows) {
      const phone = normal(r.phone);
      if (!phone) { result.skipped++; result.problems.push(`${r.phone}: not a phone number.`); continue; }
      const agreed = r.optedIn ?? (o.allOptedIn ? true : undefined);
      const existing = contacts.find(c => c.phone === phone);
      if (existing) {
        existing.tags = [...new Set([...existing.tags, ...(r.tags ?? []), ...(o.tags ?? [])])];
        if (agreed && existing.optIn === 'Unknown') { existing.optIn = 'OptedIn'; existing.optInSource = o.optInSource ?? null; }
        result.updated++;
      } else {
        contacts.push(contact(phone, r.name ?? '', 'Import', agreed ? 'OptedIn' : 'Unknown', { tags: [...(r.tags ?? []), ...(o.tags ?? [])], attributes: r.attributes ?? {} }));
        result.added++;
      }
    }
    return result;
  },
  importLeads: async (): Promise<WaImportResult> => ({ added: 0, updated: 2, skipped: 0, problems: [] }),
  importDoctorDekho: async (): Promise<WaImportResult> => ({ added: 0, updated: 1, skipped: 0, problems: [] }),

  templates: async () => { await pause(); return templates.filter(t => t.status !== 'DELETED').map(t => ({ ...t })); },
  createTemplate: async (t: WaSaveTemplate, sample?: File | null) => {
    await pause();
    if (templates.some(x => x.name === t.name && x.language === t.language && x.status !== 'DELETED')) throw new Error('A template with this name and language already exists.');
    const urlButton = t.buttons.find(b => b.type === 'URL' && variablesIn(b.url).length > 0);
    const row: WaTemplate = {
      templateId: id(), name: t.name, language: t.language, category: t.category, status: 'PENDING', parameterFormat: 'POSITIONAL',
      headerFormat: t.headerFormat, headerText: t.headerText ?? null, body: t.body, footer: t.footer ?? null, buttons: t.buttons,
      headerVariables: t.headerFormat === 'TEXT' ? variablesIn(t.headerText) : [], bodyVariables: variablesIn(t.body),
      urlButtonVariable: !!urlButton, hasSampleMedia: !!sample, updatedAt: new Date().toISOString(),
    };
    templates.unshift(row);
    return row;
  },
  deleteTemplate: async (tid: string) => { const t = templates.find(x => x.templateId === tid); if (t) t.status = 'DELETED'; },

  broadcasts: async () => { await pause(); return broadcasts.map(b => ({ ...b })); },
  broadcast: async (bid: string) => ({ ...broadcasts.find(b => b.broadcastId === bid)! }),
  recipients: async (bid: string, status?: string) => (recipients[bid] ?? []).filter(r => !status || r.status === status),
  preview: async (r: WaBroadcastRequest): Promise<WaBroadcastPreview> => {
    await pause();
    const p = plan(r);
    const spent = spentThisMonth();
    return {
      matched: p.matched.length, willSend: p.sending.length, notOptedIn: p.matched.filter(c => c.optIn === 'Unknown').length,
      optedOut: p.matched.filter(c => c.optIn === 'OptedOut').length, estimatedCost: p.estimate, currency: 'INR', spentThisMonth: spent, committed: 0,
      monthlyBudget: settings.monthlyBudget, overBudget: !!settings.monthlyBudget && spent + p.estimate > settings.monthlyBudget,
      samples: p.sending.slice(0, 3).map(c => `${c.name}: ` + fill(p.t.body, Object.fromEntries(Object.entries(r.variables).map(([k, v]) => [k, v.from === 'name' ? firstName(c.name) : v.from === 'phone' ? c.displayPhone : v.from === 'attribute' ? c.attributes[v.attribute ?? ''] ?? v.text ?? '' : v.text ?? ''])))),
    };
  },
  createBroadcast: async (r: WaBroadcastRequest) => {
    await pause();
    const p = plan(r);
    if (!r.name.trim()) throw new Error('Give the broadcast a name (only your team sees it).');
    if (!p.sending.length) throw new Error('Nobody in this audience has agreed to WhatsApp messages. Record their opt-in in Contacts first.');
    const over = !!settings.monthlyBudget && spentThisMonth() + p.estimate > settings.monthlyBudget;
    const b: WaBroadcast = {
      broadcastId: id(), name: r.name, templateId: p.t.templateId, templateName: p.t.name, category: p.t.category, status: over ? 'AwaitingApproval' : 'Scheduled',
      scheduledAt: r.scheduledAt ?? new Date().toISOString(), recipients: p.sending.length, pending: p.sending.length, sent: 0, delivered: 0, read: 0, failed: 0, replied: 0,
      estimatedCost: p.estimate, actualCost: 0, currency: 'INR', createdBy: ME.fullName, createdAt: new Date().toISOString(),
    };
    broadcasts.unshift(b);
    recipients[b.broadcastId] = p.sending.map(c => ({ contactId: c.contactId, displayPhone: c.displayPhone, name: c.name, status: 'Pending' }));
    return b;
  },
  broadcastAction: async (bid: string, action: 'approve' | 'pause' | 'resume' | 'cancel') => {
    const b = broadcasts.find(x => x.broadcastId === bid)!;
    if (action === 'approve') { b.status = 'Scheduled'; b.approvedBy = ME.fullName; }
    if (action === 'pause') { b.status = 'Paused'; b.pausedReason = `Paused by ${ME.fullName}`; }
    if (action === 'resume') { b.status = b.startedAt ? 'Sending' : 'Scheduled'; b.pausedReason = null; }
    if (action === 'cancel') { b.status = 'Cancelled'; b.pending = 0; }
    return { ...b };
  },

  number: async (): Promise<WaNumber> => ({ connected: true, displayPhone: '+91 90000 00000', verifiedName: 'Example Business', nameStatus: 'APPROVED', quality: 'GREEN', messagingLimit: 'TIER_1K', throughput: 'STANDARD' }),
  profile: async () => ({ ...profile }),
  saveProfile: async (p: WaProfile) => { profile = { ...p }; return profile; },
  settings: async () => ({ ...settings, rates: settings.rates.map(r => ({ ...r })) }),
  saveSettings: async (p: { monthlyBudget?: number | null; sendPerSecond?: number; rates?: WaRate[] }) => {
    settings = { ...settings, monthlyBudget: p.monthlyBudget === undefined ? settings.monthlyBudget : p.monthlyBudget, sendPerSecond: p.sendPerSecond ?? settings.sendPerSecond, rates: p.rates ?? settings.rates };
    return { ...settings };
  },
  spend: async (from: string, to: string): Promise<WaSpend> => {
    await pause();
    const days = [];
    for (let t = new Date(from); t <= new Date(to); t.setDate(t.getDate() + 1)) {
      const seed = (t.getDate() * 37) % 11;
      const marketing = seed > 6 ? +(seed * 8.63).toFixed(2) : 0;
      const utility = seed % 3 === 0 ? +(seed * 0.46).toFixed(2) : 0;
      days.push({ date: t.toISOString().slice(0, 10), marketing, utility, authentication: 0, service: 0, total: +(marketing + utility).toFixed(2), charged: Math.round(marketing / 0.8631 + utility / 0.115), free: seed });
    }
    const total = days.reduce((s, x) => s + x.total, 0);
    return {
      from, to, currency: 'INR', total, spentThisMonth: spentThisMonth(), committed: 0, monthlyBudget: settings.monthlyBudget, days,
      byCategory: { marketing: days.reduce((s, x) => s + x.marketing, 0), utility: days.reduce((s, x) => s + x.utility, 0) },
      byBroadcast: broadcasts.filter(b => b.actualCost > 0).map(b => ({ broadcastId: b.broadcastId, name: b.name, cost: b.actualCost, delivered: b.delivered })),
    };
  },
  metaSpend: async (from: string): Promise<WaMetaSpendDay[]> => [{ date: from, category: 'MARKETING', volume: 112, cost: 96.67 }],
};
