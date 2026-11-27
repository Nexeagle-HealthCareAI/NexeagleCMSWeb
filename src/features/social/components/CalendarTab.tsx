import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { SocialCan } from '../access';
import { socialService, socialError } from '../services/socialService';
import type { SocialAccount, SocialCalendarItem, SocialSlot } from '../types';
import { DAYS, STATUS_LABEL, when, ymd } from '../socialUtils';
import { StatusTag } from './shared';

// Social → Calendar: what went out and what is coming, by month or as a list, and the queue slots that
// "Add to the queue" fills. Times are shown in this browser's time; slots are India time, as the API keeps them.

const startOfMonth = (t: Date) => new Date(t.getFullYear(), t.getMonth(), 1);
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function CalendarTab({ account, can }: { account: SocialAccount; can: SocialCan }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<'month' | 'list'>('month');
  const [items, setItems] = useState<SocialCalendarItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    let live = true;
    const from = new Date(month); from.setDate(from.getDate() - 7);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 7);
    socialService.calendar(account.accountId, ymd(from), ymd(to))
      .then(x => { if (live) { setItems(x); setError(null); } })
      .catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [account.accountId, month]);
  useEffect(() => { if (account.igUserId) socialService.publishingLimit(account.accountId).then(setLimit).catch(() => { /* optional */ }); }, [account.accountId, account.igUserId]);

  const cells = useMemo(() => {
    const first = month;
    const lead = MONDAY_FIRST.indexOf(first.getDay());
    const start = new Date(first); start.setDate(1 - lead);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
    return out.slice(0, out[35].getMonth() === month.getMonth() ? 42 : 35);
  }, [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, SocialCalendarItem[]>();
    for (const i of items ?? []) { const k = ymd(new Date(i.at)); m.set(k, [...(m.get(k) ?? []), i]); }
    for (const list of m.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return m;
  }, [items]);
  const inMonth = (items ?? []).filter(i => new Date(i.at).getMonth() === month.getMonth() && new Date(i.at).getFullYear() === month.getFullYear());
  const count = (s: string[]) => inMonth.filter(i => s.includes(i.status)).length;
  const monthName = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const today = ymd(new Date());

  return (
    <div className="wa-pad sc-cal-wrap">
      <div className="sc-cal-main">
        <div className="hw-bar wa-bar wa-flush">
          <button type="button" className="hw-btn" aria-label="Previous month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
          <b className="sc-month">{monthName}</b>
          <button type="button" className="hw-btn" aria-label="Next month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
          <button type="button" className="hw-btn" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
          <div className="sc-seg" role="group" aria-label="View">
            <button type="button" className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          </div>
          <span className="wa-grow" />
          {can.compose && <Link to="/social/compose" className="hw-btn hw-btn-primary"><Plus size={14} /> New post</Link>}
        </div>
        <div className="sc-legend">
          <span><i className="sc-dot sc-fb" /> Facebook</span><span><i className="sc-dot sc-ig" /> Instagram</span>
          <span><i className="sc-key sc-k-wait" /> Waiting for approval</span><span><i className="sc-key sc-k-pub" /> Published</span><span><i className="sc-key sc-k-fail" /> Failed</span>
        </div>
        {error && <p className="hw-err">{error}</p>}
        {!items && !error && <p className="hw-muted">Loading…</p>}
        {items && view === 'month' && (
          <div className="sc-cal" role="grid" aria-label={monthName}>
            {MONDAY_FIRST.map(d => <div key={d} className="sc-cal-dow" role="columnheader">{DAYS[d]}</div>)}
            {cells.map(c => {
              const k = ymd(c);
              const list = byDay.get(k) ?? [];
              return (
                <div key={k} role="gridcell" className={`sc-cal-day${c.getMonth() !== month.getMonth() ? ' out' : ''}${k === today ? ' today' : ''}`}>
                  <span className="sc-cal-n">{c.getDate()}</span>
                  {list.slice(0, 3).map((i, j) => <CalItem key={j} i={i} />)}
                  {list.length > 3 && <span className="hw-muted wa-small">+{list.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        )}
        {items && view === 'list' && (
          inMonth.length === 0 ? <p className="hw-empty">Nothing in {monthName}.</p> : (
            <table className="wa-mini">
              <thead><tr><th>When</th><th>Post</th><th>Channels</th><th>State</th></tr></thead>
              <tbody>
                {[...inMonth].sort((a, b) => a.at.localeCompare(b.at)).map((i, j) => (
                  <tr key={j}>
                    <td className="sc-nowrap">{when(i.at)}</td>
                    <td>{i.draftId ? <Link to={`/social/compose/${i.draftId}`}>{i.title}</Link> : i.title}{i.error && <div className="wa-small hw-err">{i.error}</div>}</td>
                    <td>{i.channels.map(c => <i key={c} className={`sc-dot sc-${c === 'facebook' ? 'fb' : 'ig'}`} title={c} />)}</td>
                    <td><StatusTag status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <aside className="sc-cal-side">
        <Slots account={account} can={can} />
        <section className="wa-chart-card">
          <h3 className="wa-h3">{month.toLocaleDateString('en-IN', { month: 'long' })}</h3>
          <dl className="wa-dl sc-dl-tight">
            <dt>Published</dt><dd>{count(['Published'])}</dd>
            <dt>Scheduled</dt><dd>{count(['Scheduled', 'Publishing'])}</dd>
            <dt>Waiting for approval</dt><dd>{count(['AwaitingApproval'])}</dd>
            <dt>Failed (needs a look)</dt><dd>{count(['Failed'])}</dd>
          </dl>
          {limit && <p className="hw-muted wa-small">Instagram allows {limit.total} posts a day per account; {limit.used} used in the last 24 hours.</p>}
        </section>
      </aside>
    </div>
  );
}

function CalItem({ i }: { i: SocialCalendarItem }) {
  const t = new Date(i.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const cls = i.status === 'Published' ? 'pub' : i.status === 'Failed' ? 'fail' : i.status === 'AwaitingApproval' || i.status === 'SentBack' || i.status === 'Draft' ? 'wait' : 'sched';
  const body = (
    <>
      {i.channels.map(c => <i key={c} className={`sc-dot sc-${c === 'facebook' ? 'fb' : 'ig'}`} />)}
      <span>{t} {i.title}</span>
    </>
  );
  const title = `${STATUS_LABEL[i.status] ?? i.status}: ${i.title}${i.error ? ` — ${i.error}` : ''}`;
  return i.draftId
    ? <Link to={`/social/compose/${i.draftId}`} className={`sc-cal-item sc-ci-${cls}`} title={title}>{body}</Link>
    : <span className={`sc-cal-item sc-ci-${cls}`} title={title}>{body}</span>;
}

function Slots({ account, can }: { account: SocialAccount; can: SocialCan }) {
  const [slots, setSlots] = useState<SocialSlot[] | null>(null);
  const [edit, setEdit] = useState<SocialSlot[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { socialService.slots(account.accountId).then(setSlots).catch(() => setSlots([])); }, [account.accountId]);
  const order = (l: SocialSlot[]) => [...l].sort((a, b) => MONDAY_FIRST.indexOf(a.dayOfWeek) - MONDAY_FIRST.indexOf(b.dayOfWeek) || a.time.localeCompare(b.time));
  const save = async () => {
    if (!edit) return;
    if (edit.some(s => !s.toFacebook && !s.toInstagram)) { toast.error('Each slot needs Facebook, Instagram or both.'); return; }
    setBusy(true);
    try { setSlots(await socialService.saveSlots(account.accountId, edit)); setEdit(null); toast.success('Queue slots saved.'); } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
  };
  const change = (i: number, p: Partial<SocialSlot>) => setEdit(l => l!.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">Queue slots</h3>
      <p className="hw-muted wa-small">“Add to the queue” fills the next free slot. Times in IST.</p>
      {!slots && <p className="hw-muted wa-small">Loading…</p>}
      {slots && !edit && (
        <>
          {slots.length === 0 && <p className="hw-muted wa-small">No slots yet.</p>}
          <ul className="sc-slots">
            {order(slots).map((s, i) => <li key={s.slotId ?? i}><b>{DAYS[s.dayOfWeek]} {s.time}</b> {[s.toFacebook && 'Facebook', s.toInstagram && 'Instagram'].filter(Boolean).join(', ')}</li>)}
          </ul>
          {can.publish && <button type="button" className="hw-btn" onClick={() => setEdit(order(slots))}>Change slots</button>}
        </>
      )}
      {edit && (
        <div className="sc-slot-edit">
          {edit.map((s, i) => (
            <div key={i} className="sc-slot-row">
              <select value={s.dayOfWeek} onChange={e => change(i, { dayOfWeek: Number(e.target.value) })} aria-label="Day">
                {MONDAY_FIRST.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
              </select>
              <input type="time" value={s.time} onChange={e => change(i, { time: e.target.value })} aria-label="Time (IST)" />
              <label className="wa-check"><input type="checkbox" checked={s.toFacebook} onChange={e => change(i, { toFacebook: e.target.checked })} /> FB</label>
              <label className="wa-check"><input type="checkbox" checked={s.toInstagram} onChange={e => change(i, { toInstagram: e.target.checked })} /> IG</label>
              <button type="button" className="hw-btn" aria-label="Remove slot" onClick={() => setEdit(l => l!.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="wa-row">
            <button type="button" className="hw-btn" onClick={() => setEdit(l => [...l!, { dayOfWeek: 2, time: '18:30', toFacebook: !!account.pageId, toInstagram: !!account.igUserId }])}><Plus size={13} /> Add a slot</button>
            <span className="wa-grow" />
            <button type="button" className="hw-btn" onClick={() => setEdit(null)}>Cancel</button>
            <button type="button" className="hw-btn hw-btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
