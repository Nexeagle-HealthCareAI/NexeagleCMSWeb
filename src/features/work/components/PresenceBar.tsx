import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { lastSeenText } from '../activityMeta';
import { BADGE_POLL_MS, CHAT_CHANGED } from '../chatMeta';
import type { GuardEvent, LastSeen, MyPresence, WorkNotification, WorkUser } from '../types';
import { workService } from '../services/workService';
import { formatWhen } from '../workMeta';
import { Avatar } from './parts';

const BEAT_MS = 60_000;
let lastOpenSent = 0;
/** ScreenGuard announces what it stopped with this window event, and the bar reports it. */
export const GUARD_EVENT = 'wk-guard';

/**
 * Under the page title: the signed-in person's own sign-in details, and who else is on the board.
 * It also tells the API the board is open (once a minute while the tab is in view), which is what
 * "last seen" and the visits in the activity log are made from.
 */
const NOTE_TEXT: Record<WorkNotification['kind'], string> = { Mention: 'tagged you', Escalation: 'escalated to you', Direct: 'sent you a message' };

export default function PresenceBar({ onUnread }: { onUnread?: (unreadChat: number) => void }) {
  const me = useAuthStore(s => s.user);
  const [mine, setMine] = useState<MyPresence | null>(null);
  const [seen, setSeen] = useState<LastSeen[]>([]);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [unreadNotes, setUnreadNotes] = useState(0);
  const [notes, setNotes] = useState<WorkNotification[] | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bell = useRef<HTMLDivElement>(null);
  /** How many notifications were unread at the last check; -1 before the first one. */
  const lastCount = useRef(-1);
  const report = useRef(onUnread);
  useEffect(() => { report.current = onUnread; }, [onUnread]);

  // Unread chat and notifications, checked now and then while the board is open.
  const check = useCallback(() => {
    workService.chatState()
      .then(async state => {
        report.current?.(state.channels.reduce((sum, c) => sum + c.unread, 0));
        setUnreadNotes(state.unreadNotifications);
        const rose = lastCount.current >= 0 && state.unreadNotifications > lastCount.current;
        lastCount.current = state.unreadNotifications;
        if (!rose) return;
        // Something new: say so here, and on the desktop when the person allowed that.
        const newest = (await workService.notifications()).find(n => !n.isRead);
        if (!newest) return;
        const line = `${newest.actorName} ${NOTE_TEXT[newest.kind]} in ${newest.channelName}`;
        toast.message(line, { description: newest.text });
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(line, { body: newest.text, tag: newest.notificationId }); } catch { /* not allowed here */ }
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    check();
    const tick = window.setInterval(() => { if (!document.hidden) check(); }, BADGE_POLL_MS);
    window.addEventListener(CHAT_CHANGED, check);
    return () => { window.clearInterval(tick); window.removeEventListener(CHAT_CHANGED, check); };
  }, [check]);

  useEffect(() => {
    if (!bellOpen) return;
    const away = (e: MouseEvent) => { if (!bell.current?.contains(e.target as Node)) setBellOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBellOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [bellOpen]);

  const toggleBell = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) workService.notifications().then(setNotes).catch(() => setNotes([]));
  };
  const openNote = (n: WorkNotification) => {
    setBellOpen(false);
    void workService.readNotifications([n.notificationId]).then(check).catch(() => undefined);
    navigate(`/work?tab=chat&channel=${encodeURIComponent(n.channelId)}`);
  };
  const readAll = () => {
    void workService.readNotifications().then(() => { setNotes(prev => (prev || []).map(n => ({ ...n, isRead: true }))); check(); }).catch(() => undefined);
  };
  const canAskDesktop = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default';

  useEffect(() => {
    let alive = true;
    const refresh = () => { workService.lastSeen().then(list => { if (alive) setSeen(list); }).catch(() => undefined); };
    // One visit per page open, even when the effect runs twice (as React does while developing).
    const fresh = Date.now() - lastOpenSent > 5000;
    if (fresh) lastOpenSent = Date.now();
    workService.touch(fresh ? { opened: true } : {}).then(p => { if (alive) setMine(p); refresh(); }).catch(() => undefined);
    workService.users().then(u => { if (alive) setUsers(u); }).catch(() => undefined);
    const beat = window.setInterval(() => {
      if (document.hidden) return;
      workService.touch({}).then(refresh).catch(() => undefined);
    }, BEAT_MS);
    const onGuard = (e: Event) => { void workService.touch({ event: (e as CustomEvent<GuardEvent>).detail }).catch(() => undefined); };
    window.addEventListener(GUARD_EVENT, onGuard);
    return () => { alive = false; window.clearInterval(beat); window.removeEventListener(GUARD_EVENT, onGuard); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const byUser = new Map(seen.map(s => [s.userId, s]));
  const online = seen.filter(s => s.isOnline).length;
  const people = [...users].sort((a, b) => Number(byUser.get(b.userId)?.isOnline ?? false) - Number(byUser.get(a.userId)?.isOnline ?? false)
    || (byUser.get(b.userId)?.lastSeenAt || '').localeCompare(byUser.get(a.userId)?.lastSeenAt || '') || a.fullName.localeCompare(b.fullName));

  return (
    <div className="wk-presence">
      <p className="wk-presence-me">
        Signed in as <strong>{me?.name || 'you'}</strong>{me?.email ? ` (${me.email})` : ''}
        {mine?.openedAt && <> · on the board since {formatWhen(mine.openedAt)}{mine.ip ? ` from ${mine.ip}` : ''}</>}
        {mine?.previousOpenedAt && <> · previous visit {formatWhen(mine.previousOpenedAt)}{mine.previousIp ? ` from ${mine.previousIp}` : ''}</>}
      </p>
      <div className="wk-presence-right">
      <div className="wk-menu" ref={bell}>
        <button type="button" className="wk-btn wk-presence-btn" aria-expanded={bellOpen} aria-haspopup="true" aria-label={`Notifications, ${unreadNotes} unread`} onClick={toggleBell}>
          <Bell size={16} aria-hidden="true" /> {unreadNotes > 0 && <span className="wk-badge">{unreadNotes > 99 ? '99+' : unreadNotes}</span>}
        </button>
        {bellOpen && (
          <div className="wk-menu-list wk-notes" role="group" aria-label="Notifications">
            <div className="wk-notes-head">
              <strong>Notifications</strong>
              {unreadNotes > 0 && <button type="button" className="wk-link" onClick={readAll}>Mark all read</button>}
            </div>
            {notes === null ? <p className="wk-muted">Loading…</p> : notes.length === 0 ? <p className="wk-muted">Nothing yet. You are told here when someone tags you, escalates to you or messages you.</p> : notes.map(n => (
              <button key={n.notificationId} type="button" className={`wk-note ${n.isRead ? '' : 'is-unread'} ${n.kind === 'Escalation' ? 'is-escalation' : ''}`} onClick={() => openNote(n)}>
                <span><strong>{n.actorName}</strong> {NOTE_TEXT[n.kind]} in {n.channelName}</span>
                <small>{n.text}</small>
                <time dateTime={n.createdAt}>{formatWhen(n.createdAt)}</time>
              </button>
            ))}
            {canAskDesktop && <button type="button" className="wk-link" onClick={() => { void Notification.requestPermission(); setBellOpen(false); }}>Turn on desktop alerts</button>}
          </div>
        )}
      </div>
      <div className="wk-menu" ref={box}>
        <button type="button" className="wk-btn wk-presence-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(v => !v)}>
          <Users size={16} aria-hidden="true" /> Team <span className="wk-dot is-on" aria-hidden="true" /> {online} online
        </button>
        {open && (
          <div className="wk-menu-list wk-presence-list" role="group" aria-label="Team, last seen">
            {people.map(u => {
              const s = byUser.get(u.userId);
              return (
                <div key={u.userId} className="wk-presence-row">
                  <Avatar name={u.fullName} />
                  <span>{u.fullName}{u.userId === me?.id ? ' (you)' : ''}</span>
                  <small><span className={`wk-dot ${s?.isOnline ? 'is-on' : ''}`} aria-hidden="true" /> {lastSeenText(s?.lastSeenAt, !!s?.isOnline)}</small>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
