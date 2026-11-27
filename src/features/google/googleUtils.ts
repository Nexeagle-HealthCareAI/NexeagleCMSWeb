import { ymd } from '../social/socialUtils';

// Small helpers for the Google screens. Numbers and money use the same formatting as Social.
export { ago, change, day, money, n, pct, when, ymd } from '../social/socialUtils';

export const SITES: { id: string; label: string }[] = [
  { id: 'nexeagle', label: 'nexeagle.com' },
  { id: 'doctordekho', label: 'Doctor Dekho' },
];

/** CRM stages in order (the API's GoogleShared.Stages). "Closed Lost" is never sent to Google. */
export const STAGES = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won'];
/** Stages a lead can be "sent to Google" at, in the order they are shown in Setup. */
export const OUTCOME_STAGES = ['Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won'];

export const PERIODS = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'year', label: 'This year' },
] as const;
export type PeriodId = (typeof PERIODS)[number]['id'];

/** A period as the API's from/to days (both included), counted back from today. */
export const periodRange = (id: string, now = new Date()): { from: string; to: string } => {
  if (id === 'year') return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) };
  if (id === 'this') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  if (id === 'last') return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  const days = Number(id) || 30;
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))), to: ymd(now) };
};

/** 125 → "2m 05s". */
export const duration = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/** Google's channel names ("Organic Search") in plain words. */
export const CHANNEL: Record<string, string> = {
  'Organic Search': 'Organic search', 'Paid Search': 'Paid search (Google Ads)', 'Organic Social': 'Social', 'Paid Social': 'Paid social',
  Direct: 'Direct', Referral: 'Referral', Email: 'Email', 'Organic Video': 'Video', 'Cross-network': 'Google Ads (other networks)',
  'Paid Other': 'Other paid', Unassigned: 'Unassigned', 'Organic Shopping': 'Shopping', 'Paid Video': 'Paid video', Display: 'Display ads', SMS: 'SMS',
};
export const channelLabel = (c: string): string => CHANNEL[c] ?? c;

/** "G-ABC123" and "AW-123456789" (the API checks the same). */
export const validTagId = (id: string, prefix: 'G-' | 'AW-'): boolean => id.startsWith(prefix) && id.length > 4 && id.length <= 30 && /^[A-Za-z0-9]+$/.test(id.slice(prefix.length));
/** A Google Ads conversion label: letters, digits, - and _. */
export const validLabel = (label: string): boolean => /^[A-Za-z0-9_-]{1,60}$/.test(label);
