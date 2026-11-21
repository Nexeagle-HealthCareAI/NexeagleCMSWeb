import type { ActivitySource, WorkActivity } from './types';
import { describeChange } from './workMeta';

export const SOURCE_LABEL: Record<ActivitySource, string> = {
  items: 'Work items', comments: 'Comments', access: 'Board access', docs: 'Documents', sessions: 'Visits and blocked actions',
};

const ACCESS: Record<string, (who: string, board: string) => string> = {
  MemberAdded: (who, board) => `added ${who} to ${board}`,
  MemberRemoved: (who, board) => `removed ${who} from ${board}`,
  Restricted: (_who, board) => `made ${board} members-only`,
  Opened: (_who, board) => `opened ${board} to everyone`,
};
const SESSION: Record<string, string> = {
  Opened: 'opened the work board',
  CopyBlocked: 'tried to copy from the protected screen',
  PrintBlocked: 'tried to print the protected screen',
  SaveBlocked: 'tried to save the protected screen',
  ScreenshotKey: 'pressed the screenshot key on the protected screen',
};
const DOC: Record<string, string> = {
  open: 'opened', download: 'downloaded', create: 'created', upload: 'uploaded', edit: 'edited', rename: 'renamed',
  move: 'moved', bin: 'moved to the bin', restore: 'restored', access: 'changed access to',
};

/** What happened, as the end of a sentence that starts with the person's name. */
export function describeActivity(a: WorkActivity): string {
  if (a.source === 'items') return describeChange(a.action, a.oldValue, a.newValue);
  if (a.source === 'comments') return a.action === 'commentRemoved' ? 'wrote a comment that was later removed' : 'commented';
  if (a.source === 'access') return (ACCESS[a.action] || (() => a.action))(a.detail || 'someone', a.projectKey || 'a board');
  if (a.source === 'sessions') return SESSION[a.action] || a.action;
  const verb = DOC[a.action] || a.action;
  return `${verb} ${a.documentName ? `“${a.documentName}”` : a.detail || 'a folder'}`;
}

/** Things worth a second look in a compliance review. */
export const isFlagged = (a: WorkActivity): boolean =>
  (a.source === 'sessions' && a.action !== 'Opened') || a.action === 'deleted' || a.action === 'escalated' || a.action === 'MemberRemoved' || (a.source === 'docs' && (a.action === 'download' || a.action === 'bin'));

/** "Online now", "5 min ago", "3 h ago", "20 Nov". */
export function lastSeenText(lastSeenAt: string | null | undefined, isOnline: boolean, now: Date = new Date()): string {
  if (!lastSeenAt) return 'Not seen yet';
  if (isOnline) return 'Online now';
  const minutes = Math.max(1, Math.round((now.getTime() - new Date(lastSeenAt).getTime()) / 60_000));
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  if (minutes < 24 * 60) return `Last seen ${Math.round(minutes / 60)} h ago`;
  return `Last seen ${new Date(lastSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export const dayLabel = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  if (same(d, new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
