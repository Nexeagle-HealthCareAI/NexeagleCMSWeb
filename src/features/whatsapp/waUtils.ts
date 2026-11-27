import type { WaButton, WaImportRow, WaSaveTemplate, WaTemplate } from './types';

// Small helpers shared by the WhatsApp tabs. The limits mirror Meta's (and the API's WaRules).

export const LIMITS = { body: 1024, headerText: 60, footer: 60, buttons: 10, buttonText: 25, urlButtons: 2, text: 4096 };

export const money = (n: number | null | undefined, currency = 'INR'): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

export const when = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** "10:42" today, "Mon" this week, "12 Nov" otherwise: for the chat list. */
export const shortWhen = (iso?: string | null, now = new Date()): string => {
  if (!iso) return '';
  const t = new Date(iso);
  const days = (now.getTime() - t.getTime()) / 86_400_000;
  if (t.toDateString() === now.toDateString()) return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (days < 6) return t.toLocaleDateString('en-IN', { weekday: 'short' });
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** "5 h 20 min left" until the 24-hour window closes, or null when closed. */
export const windowLeft = (closesAt?: string | null, now = new Date()): string | null => {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - now.getTime();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min left` : `${m} min left`;
};

/** The variables in a text, in order, once each: "{{1}}", "{{first_name}}" → ["1", "first_name"]. */
export const variablesIn = (text?: string | null): string[] => {
  const out: string[] = [];
  for (const m of (text ?? '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
};

export const fill = (text: string | null | undefined, values: Record<string, string>, prefix = ''): string =>
  (text ?? '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, k: string) => values[prefix + k]?.trim() || whole);

/** The keys a send must fill: "h.1" for the header, body variables, "url" for a link button's variable, "code" for copy code. */
export const requiredKeys = (t: Pick<WaTemplate, 'headerVariables' | 'bodyVariables' | 'urlButtonVariable' | 'buttons'>): string[] => [
  ...t.headerVariables.map(v => `h.${v}`),
  ...t.bodyVariables,
  ...(t.urlButtonVariable ? ['url'] : []),
  ...(t.buttons.some(b => b.type === 'COPY_CODE') ? ['code'] : []),
];

export const keyLabel = (key: string): string =>
  key === 'url' ? 'Link variable' : key === 'code' ? 'Code to copy' : key.startsWith('h.') ? `Header {{${key.slice(2)}}}` : `{{${key}}}`;

export const isMediaHeader = (f: string): boolean => f === 'IMAGE' || f === 'VIDEO' || f === 'DOCUMENT';

/** What is wrong with a new template before Meta sees it, or null. Same rules as the API. */
export function checkTemplate(t: WaSaveTemplate, sample?: File | null): string | null {
  if (!/^[a-z0-9_]+$/.test(t.name)) return 'The name may only have lower case letters, digits and _ (like diwali_offer_2026).';
  if (!t.body.trim()) return 'Write the message text.';
  if (t.body.length > LIMITS.body) return `The message text can be at most ${LIMITS.body} characters.`;
  const positional = (s: string[]) => s.every(v => /^\d+$/.test(v));
  const vars = variablesIn(t.body);
  if (vars.length && positional(vars) && vars.map(Number).some((n, i) => n !== i + 1)) return 'Number the variables {{1}}, {{2}}, {{3}}… in order.';
  for (const v of vars) if (!t.bodyExamples[v]?.trim()) return `Give an example for {{${v}}}: Meta checks templates with real-looking examples.`;
  if (/^\s*\{\{|\}\}\s*$/.test(t.body)) return 'The message cannot start or end with a variable: add a word before or after it.';
  if (t.headerFormat === 'TEXT') {
    if (!t.headerText?.trim()) return 'Write the header, or choose no header.';
    if (t.headerText.length > LIMITS.headerText) return `The header can be at most ${LIMITS.headerText} characters.`;
    const hv = variablesIn(t.headerText);
    if (hv.length > 1) return 'The header can have one variable at most.';
    if (hv.length === 1 && !t.headerExample?.trim()) return 'Give an example for the header\'s variable.';
  }
  if (isMediaHeader(t.headerFormat) && !sample) return 'Add a sample picture, video or document: Meta needs it to check the template.';
  if ((t.footer?.length ?? 0) > LIMITS.footer) return `The footer can be at most ${LIMITS.footer} characters.`;
  if (t.buttons.length > LIMITS.buttons) return `At most ${LIMITS.buttons} buttons.`;
  if (t.buttons.filter(b => b.type === 'URL').length > LIMITS.urlButtons) return 'At most 2 link buttons.';
  if (t.buttons.filter(b => b.type === 'PHONE_NUMBER').length > 1) return 'At most 1 call button.';
  if (t.buttons.filter(b => b.type === 'COPY_CODE').length > 1) return 'At most 1 copy-code button.';
  const kinds = t.buttons.map(b => (b.type === 'QUICK_REPLY' ? 'q' : 'c'));
  if (kinds.join('').replace(/q+/g, 'q').replace(/c+/g, 'c').length > 2) return 'Keep the quick replies together (all before or all after the other buttons).';
  for (const b of t.buttons) {
    if (b.type !== 'COPY_CODE' && !b.text?.trim()) return 'Every button needs its text.';
    if ((b.text?.length ?? 0) > LIMITS.buttonText) return `Button text can be at most ${LIMITS.buttonText} characters.`;
    if (b.type === 'URL') {
      if (!/^https?:\/\//i.test(b.url ?? '')) return 'A link button needs a web address starting with https://.';
      const uv = variablesIn(b.url);
      if (uv.length > 1 || (uv.length === 1 && !(b.url ?? '').trim().endsWith('}}'))) return 'A link can have one variable, at its end.';
      if (uv.length === 1 && !b.urlExample?.trim()) return 'Give an example for the link\'s variable.';
    }
    if (b.type === 'PHONE_NUMBER' && !/^\+?\d{8,15}$/.test((b.phone ?? '').replace(/[\s-]/g, ''))) return 'A call button needs a phone number with its country code.';
    if (b.type === 'COPY_CODE' && !b.example?.trim()) return 'Give an example code.';
  }
  return null;
}

export const buttonLabel = (b: WaButton): string =>
  b.type === 'COPY_CODE' ? 'Copy code' : b.text || (b.type === 'URL' ? 'Link' : b.type === 'PHONE_NUMBER' ? 'Call' : 'Reply');

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Rows of a CSV file (commas or semicolons; quotes allowed). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

const PHONE = ['phone', 'mobile', 'number', 'whatsapp', 'phone number', 'mobile number', 'contact', 'contact number'];
const NAME = ['name', 'full name', 'contact name', 'doctor', 'hospital'];
const TAGS = ['tags', 'tag', 'labels', 'groups'];
const OPTED = ['opted in', 'opted_in', 'optin', 'opt in', 'consent', 'agreed'];

export interface CsvImport { rows: WaImportRow[]; phoneColumn: string | null; attributeColumns: string[]; problems: string[] }

/**
 * Turns a CSV into contacts: the phone column is found by its heading (phone, mobile, number…),
 * name and tags likewise; every other column becomes a detail usable as a template variable.
 */
export function csvToContacts(text: string, maxRows = 20_000): CsvImport {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], phoneColumn: null, attributeColumns: [], problems: ['The file needs a heading row and at least one contact.'] };
  const head = all[0].map(h => h.trim());
  const low = head.map(h => h.toLowerCase());
  const find = (names: string[]) => low.findIndex(h => names.includes(h));
  const p = find(PHONE);
  if (p < 0) return { rows: [], phoneColumn: null, attributeColumns: [], problems: ['No phone column: name one column "phone" or "mobile".'] };
  const n = find(NAME);
  const t = find(TAGS);
  const o = find(OPTED);
  const attrIdx = head.map((_, i) => i).filter(i => ![p, n, t, o].includes(i) && head[i]);
  const problems: string[] = [];
  const rows: WaImportRow[] = [];
  for (const [i, r] of all.slice(1).entries()) {
    if (rows.length >= maxRows) { problems.push(`Only the first ${maxRows} rows are taken.`); break; }
    const phone = (r[p] ?? '').trim();
    if (!phone) { problems.push(`Row ${i + 2}: no phone number.`); continue; }
    const attributes: Record<string, string> = {};
    for (const a of attrIdx) if (r[a]?.trim()) attributes[head[a].toLowerCase().replace(/\s+/g, '_')] = r[a].trim();
    const opted = o >= 0 ? (r[o] ?? '').trim().toLowerCase() : '';
    rows.push({
      phone,
      name: n >= 0 ? r[n]?.trim() || undefined : undefined,
      tags: t >= 0 ? (r[t] ?? '').split(/[|,]/).map(x => x.trim()).filter(Boolean) : undefined,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      optedIn: o >= 0 ? ['yes', 'y', 'true', '1', 'opted in', 'agreed'].includes(opted) ? true : ['no', 'n', 'false', '0'].includes(opted) ? false : undefined : undefined,
    });
  }
  return { rows, phoneColumn: head[p], attributeColumns: attrIdx.map(i => head[i].toLowerCase().replace(/\s+/g, '_')), problems: problems.slice(0, 20) };
}

export const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved', PENDING: 'Waiting for Meta', REJECTED: 'Rejected', PAUSED: 'Paused by Meta', DISABLED: 'Disabled by Meta',
  IN_APPEAL: 'In appeal', DELETED: 'Deleted', DRAFT: 'Draft', PENDING_DELETION: 'Being deleted', ARCHIVED: 'Archived', LIMIT_EXCEEDED: 'Limit reached',
};

export const BROADCAST_LABEL: Record<string, string> = {
  Draft: 'Draft', AwaitingApproval: 'Waiting for approval', Scheduled: 'Scheduled', Sending: 'Sending', Paused: 'Paused', Done: 'Sent', Cancelled: 'Cancelled',
};

export const OPTIN_LABEL: Record<string, string> = { OptedIn: 'Opted in', OptedOut: 'Opted out', Unknown: 'Not asked' };
