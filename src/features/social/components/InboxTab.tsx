import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, CheckCheck, Clock, ExternalLink, Paperclip, Search, StickyNote } from 'lucide-react';
import type { SocialCan } from '../access';
import { isConflict, socialService, socialError } from '../services/socialService';
import type { InboxChannel, InboxView, SocialAccount, SocialComment, SocialConversation, SocialMessage, SocialNote, SocialPerson, SocialThread } from '../types';
import { channelName, shortWhen, timeLeft, when } from '../socialUtils';
import { ChannelTag, MakeLead } from './shared';
import CommentCard from './CommentCard';

// Social → Inbox: Messenger, Instagram direct messages and comments on our posts, in one list. Meta allows a
// normal reply within 24 hours of their last message, and a reply by a person (the "human agent" tag) up to
// 7 days; after that only they can restart the chat. A conversation or comment can become a CRM lead.

const CHANNELS: { id: InboxChannel; label: string }[] = [
  { id: '', label: 'All' }, { id: 'messenger', label: 'Messenger' }, { id: 'instagram', label: 'Instagram' }, { id: 'comments', label: 'Comments' },
];
const VIEWS: { id: InboxView; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'mine', label: 'Mine' }, { id: 'unassigned', label: 'Unassigned' }, { id: 'unread', label: 'Unread' }, { id: 'closed', label: 'Closed' },
];

export default function InboxTab({ account, can, onRead }: { account: SocialAccount; can: SocialCan; onRead?: () => void }) {
  const [channel, setChannel] = useState<InboxChannel>('');
  const [view, setView] = useState<InboxView>('open');
  const [search, setSearch] = useState('');
  const [list, setList] = useState<SocialConversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<SocialConversation | null>(null);
  const [agents, setAgents] = useState<SocialPerson[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => { socialService.agents().then(setAgents).catch(() => { /* assign list is optional */ }); }, []);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 20_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      socialService.inbox({ accountId: account.accountId, channel: channel || undefined, view, search: search.trim() || undefined })
        .then(l => { if (live) { setList(l); setError(null); } })
        .catch(e => { if (live) setError(socialError(e)); });
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [account.accountId, channel, view, search, tick]);

  const changed = useCallback((c: Partial<SocialConversation> & { id: string }) => {
    setList(l => l?.map(x => (x.id === c.id ? { ...x, ...c } : x)) ?? l);
    setOpen(o => (o && o.id === c.id ? { ...o, ...c } : o));
  }, []);
  const pick = (c: SocialConversation) => {
    if (c.unread > 0) { onRead?.(); changed({ id: c.id, unread: 0 }); }
    setOpen({ ...c, unread: 0 });
  };

  return (
    <div className={`wa-inbox sc-inbox${open ? ' has-open' : ''}`}>
      <div className="wa-list">
        <div className="wa-list-top">
          <div className="sc-seg sc-seg-full" role="group" aria-label="Channel">
            {CHANNELS.map(c => <button key={c.id || 'all'} type="button" className={channel === c.id ? 'on' : ''} aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>{c.label}</button>)}
          </div>
          <div className="wa-pills">
            {VIEWS.map(v => <button key={v.id} type="button" className={`wa-pill${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>{v.label}</button>)}
          </div>
          <label className="wa-search"><Search size={14} /><input type="text" placeholder="Search name or text" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" /></label>
        </div>
        {error && <p className="hw-err wa-pad">{error}</p>}
        {!list && !error && <p className="hw-muted wa-pad">Loading…</p>}
        {list && list.length === 0 && <p className="hw-muted wa-pad">Nothing here.</p>}
        <ul className="wa-chats">
          {list?.map(c => (
            <li key={`${c.kind}-${c.id}`}>
              <button type="button" className={`wa-chat${open?.id === c.id ? ' on' : ''}`} onClick={() => pick(c)}>
                <span className={`wa-avatar sc-av-${c.kind === 'comment' ? 'comment' : c.channel}`}>{(c.name || '?').slice(0, 1).toUpperCase()}</span>
                <span className="wa-chat-main">
                  <span className="wa-chat-line"><b className="wa-chat-name">{c.name}</b><span className="wa-chat-time">{shortWhen(c.lastAt)}</span></span>
                  <span className="wa-chat-prev">{c.kind === 'comment' ? 'Comment: ' : ''}{c.preview}</span>
                  <span className="wa-chat-line">
                    <span className="wa-chat-meta"><ChannelTag channel={c.kind === 'comment' ? c.channel : c.channel === 'messenger' ? 'messenger' : 'instagram'} />{c.assignedName && <span>{c.assignedName}</span>}{c.leadId && <span className="sc-chip-lead wa-chip">Lead</span>}</span>
                    {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="wa-thread-wrap">
        {!open && <div className="wa-thread-empty hw-muted wa-pad">Pick a conversation or a comment.</div>}
        {open?.kind === 'dm' && <DmPane key={open.id} conv={open} can={can} agents={agents} onBack={() => setOpen(null)} onChange={changed} />}
        {open?.kind === 'comment' && <CommentPane key={open.id} conv={open} can={can} onBack={() => setOpen(null)} onChange={changed} />}
      </div>
    </div>
  );
}

type Item = { at: string; m?: SocialMessage; n?: SocialNote };

function DmPane({ conv, can, agents, onBack, onChange }: {
  conv: SocialConversation; can: SocialCan; agents: SocialPerson[]; onBack: () => void; onChange: (c: Partial<SocialConversation> & { id: string }) => void;
}) {
  const [t, setT] = useState<SocialThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [asNote, setAsNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => socialService.thread(conv.id).then(x => { setT(x); setError(null); }).catch(e => setError(socialError(e))), [conv.id]);
  useEffect(() => { load(); const i = setInterval(load, 15_000); return () => clearInterval(i); }, [load]);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [t?.messages.length, t?.notes.length]);

  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!t) return <p className="hw-muted wa-pad">Loading…</p>;
  const c = { ...t.conversation, ...conv };
  const items: Item[] = [...t.messages.map(m => ({ at: m.createdAt, m })), ...t.notes.map(n => ({ at: n.createdAt, n }))].sort((a, b) => a.at.localeCompare(b.at));
  const free = timeLeft(c.windowClosesAt);
  const agent = timeLeft(c.humanAgentUntil);
  const canSend = can.reply && (t.windowOpen || t.humanAgentOpen);

  const send = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      if (asNote) {
        const n = await socialService.note(c.id, text.trim());
        setT(x => x && { ...x, notes: [...x.notes, n] });
      } else {
        const m = await socialService.send(c.id, text.trim() || undefined, file);
        setT(x => x && { ...x, messages: [...x.messages, m] });
        onChange({ id: c.id, preview: text.trim() || file?.name, lastAt: m.createdAt });
      }
      setText(''); setFile(null);
    } catch (e) {
      toast.error(socialError(e));
      if (isConflict(e)) load();
    } finally { setBusy(false); }
  };
  const assign = async (userId: string) => {
    try { const x = await socialService.assign(c.id, userId || null); onChange(x); } catch (e) { toast.error(socialError(e)); }
  };
  const status = async () => {
    try { const x = await socialService.setStatus(c.id, c.status === 'Closed' ? 'Open' : 'Closed'); onChange(x); toast.success(x.status === 'Closed' ? 'Closed.' : 'Opened again.'); } catch (e) { toast.error(socialError(e)); }
  };

  return (
    <div className="sc-thread-grid">
      <div className="wa-thread">
        <div className="wa-thread-head">
          <button type="button" className="hw-btn wa-back" onClick={onBack} aria-label="Back to the list"><ArrowLeft size={14} /></button>
          <div className="wa-thread-who"><b>{c.name}</b><span className="hw-muted">{channelName(c.channel)}{c.handle ? ` · ${c.handle}` : ''}</span></div>
          {can.reply && (
            <div className="wa-thread-actions">
              <select value={c.assignedUserId ?? ''} onChange={e => assign(e.target.value)} aria-label="Assigned to">
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.userId} value={a.userId}>{a.fullName}</option>)}
              </select>
              <button type="button" className="hw-btn" onClick={status}>{c.status === 'Closed' ? 'Open again' : 'Close'}</button>
            </div>
          )}
        </div>
        <div className="wa-msgs">
          {items.map(i => i.n
            ? <div key={i.n.noteId} className="wa-note">Private note · {i.n.author}: {i.n.text}</div>
            : <Bubble key={i.m!.messageId} m={i.m!} />)}
          <div ref={end} />
        </div>
        <div className="wa-compose">
          <div className="wa-window">
            <Clock size={12} />
            {t.windowOpen && free ? <>Free reply for {free} more.</>
              : t.humanAgentOpen && agent ? <>Over 24 hours: your reply goes with the “human agent” tag (allowed for {agent} more). Answer personally; no promotions.</>
                : <>More than 7 days since their last message: Meta does not allow a reply until they write again. Notes still work.</>}
          </div>
          {file && <div className="wa-small">Attached: {file.name} <button type="button" className="wa-link" onClick={() => setFile(null)}>Remove</button></div>}
          {can.reply ? (
            <div className="wa-compose-row">
              <button type="button" className={`hw-btn${asNote ? ' wa-note-on' : ''}`} onClick={() => setAsNote(v => !v)} aria-pressed={asNote} title="Private note for the team"><StickyNote size={14} /> Note</button>
              {!asNote && <button type="button" className="hw-btn" onClick={() => fileRef.current?.click()} aria-label="Attach a file" disabled={!canSend}><Paperclip size={14} /></button>}
              <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={asNote ? 'A note only the team sees' : canSend ? 'Write a reply' : 'Reply not possible now'} aria-label={asNote ? 'Note' : 'Reply'}
                disabled={!asNote && !canSend}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
              <button type="button" className="hw-btn hw-btn-primary" onClick={send} disabled={busy || (!asNote && !canSend) || (!text.trim() && !file)}>{busy ? 'Sending…' : asNote ? 'Save note' : 'Send'}</button>
            </div>
          ) : <p className="hw-muted wa-small">Answering needs “Reply to messages and comments”.</p>}
        </div>
      </div>
      <LeadSide conv={c} can={can} onMade={leadId => onChange({ id: c.id, leadId })} make={p => socialService.leadFromChat(c.id, p)} />
    </div>
  );
}

function Bubble({ m }: { m: SocialMessage }) {
  const out = m.direction === 'Out';
  return (
    <div className={`wa-bubble ${out ? 'wa-out' : 'wa-in'}${m.status === 'failed' ? ' wa-failed' : ''}`}>
      {m.humanAgent && <div className="wa-b-tag">Human agent reply</div>}
      {m.attachments.map((a, i) => (
        a.type === 'image' && a.url
          ? <img key={i} src={a.url} alt={a.name ?? 'Picture'} className="wa-media-img" referrerPolicy="no-referrer" />
          : <a key={i} className="wa-media" href={a.url ?? undefined} target="_blank" rel="noreferrer">{a.name ?? a.type}</a>
      ))}
      {m.text && <div className="wa-b-text">{m.text}</div>}
      {m.error && <div className="wa-b-err">{m.error}</div>}
      <div className="wa-b-meta">
        {out && m.sentBy && <span>{m.sentBy} · </span>}
        <span>{when(m.createdAt)}</span>
        {out && (m.status === 'read' ? <CheckCheck size={12} className="wa-tick-read" aria-label="Read" /> : m.status === 'delivered' ? <CheckCheck size={12} aria-label="Delivered" /> : m.status === 'sent' ? <Check size={12} aria-label="Sent" /> : null)}
      </div>
    </div>
  );
}

function LeadSide({ conv, can, onMade, make }: { conv: SocialConversation; can: SocialCan; onMade: (leadId: string) => void; make: Parameters<typeof MakeLead>[0]['onMake'] }) {
  return (
    <aside className="sc-leadside" aria-label="Lead">
      <h4 className="sc-side-h">Lead</h4>
      {conv.leadId ? (
        <p className="wa-small"><b>In the CRM.</b> See it in Social → Leads.</p>
      ) : can.reply ? (
        <>
          <p className="hw-muted wa-small">Not a lead yet.</p>
          <MakeLead name={conv.name} onMake={async p => { const l = await make(p); onMade(l.leadId); return l; }} />
          <p className="hw-muted wa-small">The conversation is kept with the lead, with its source ({channelName(conv.channel)}).</p>
        </>
      ) : <p className="hw-muted wa-small">Not a lead yet.</p>}
    </aside>
  );
}

function CommentPane({ conv, can, onBack, onChange }: { conv: SocialConversation; can: SocialCan; onBack: () => void; onChange: (c: Partial<SocialConversation> & { id: string }) => void }) {
  const [c, setC] = useState<SocialComment | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    socialService.comment(conv.id).then(x => { if (live) setC(x); }).catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [conv.id]);
  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!c) return <p className="hw-muted wa-pad">Loading…</p>;
  return (
    <div className="wa-thread">
      <div className="wa-thread-head">
        <button type="button" className="hw-btn wa-back" onClick={onBack} aria-label="Back to the list"><ArrowLeft size={14} /></button>
        <div className="wa-thread-who"><b>{c.authorName ?? 'Someone'}</b><span className="hw-muted">Comment on {channelName(c.channel)} · {when(c.createdAt)}</span></div>
      </div>
      <div className="wa-pad sc-comment-pane">
        <p className="sc-onpost">
          Comment on your {channelName(c.channel)} post “{(c.postCaption ?? '').slice(0, 90)}{(c.postCaption ?? '').length > 90 ? '…' : ''}”
          {c.postPermalink && <> · <a className="wa-link" href={c.postPermalink} target="_blank" rel="noreferrer">See post <ExternalLink size={11} /></a></>}
        </p>
        <CommentCard comment={c} can={can} onChange={x => { setC(x); onChange({ id: conv.id, status: x.status === 'Done' ? 'Closed' : 'Open', leadId: x.leadId }); }} />
        {!c.canPrivateReply && !c.privateReplyAt && <p className="hw-muted wa-small">A private reply is possible once, within 7 days of the comment.</p>}
      </div>
    </div>
  );
}
