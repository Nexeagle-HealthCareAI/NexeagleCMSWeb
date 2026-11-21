import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { lastSeenText } from '../activityMeta';
import type { GuardEvent, LastSeen, MyPresence, WorkUser } from '../types';
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
export default function PresenceBar() {
  const me = useAuthStore(s => s.user);
  const [mine, setMine] = useState<MyPresence | null>(null);
  const [seen, setSeen] = useState<LastSeen[]>([]);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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
  );
}
