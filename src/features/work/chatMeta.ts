import type { WorkUser } from './types';

/** The "@name" being typed just before the cursor, if any. */
export function mentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  // A name is at most a few words; a line break or a long run means the @ was something else.
  if (query.length > 30 || /\n/.test(query) || query.split(' ').length > 3) return null;
  return { start: at, query };
}

/** Puts "@Full Name " where the half-typed mention was. */
export function insertMention(text: string, cursor: number, start: number, name: string): { text: string; cursor: number } {
  const inserted = `@${name} `;
  return { text: text.slice(0, start) + inserted + text.slice(cursor), cursor: start + inserted.length };
}

/** The people whose "@Full Name" is still in the text when it is sent. */
export function mentionedIn(text: string, users: WorkUser[]): string[] {
  return users.filter(u => text.includes(`@${u.fullName}`)).map(u => u.userId);
}

/** Splits a message so each "@Full Name" can be shown as a tag. Longer names are tried first. */
export function splitMentions(body: string, names: string[]): { text: string; mention: boolean }[] {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const parts: { text: string; mention: boolean }[] = [];
  let rest = body;
  while (rest) {
    let hit = -1;
    let which = '';
    for (const name of sorted) {
      const at = rest.indexOf(`@${name}`);
      if (at >= 0 && (hit < 0 || at < hit)) { hit = at; which = name; }
    }
    if (hit < 0) { parts.push({ text: rest, mention: false }); break; }
    if (hit > 0) parts.push({ text: rest.slice(0, hit), mention: false });
    parts.push({ text: `@${which}`, mention: true });
    rest = rest.slice(hit + which.length + 1);
  }
  return parts;
}

export const chatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** How often the open chat asks for news, and how often the rest of the board does. */
export const CHAT_POLL_MS = 4000;
export const BADGE_POLL_MS = 20_000;
/** Sent on the window when the chat's read state changed, so the bell and tab badge refresh at once. */
export const CHAT_CHANGED = 'wk-chat-changed';
