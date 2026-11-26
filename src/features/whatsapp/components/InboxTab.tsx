import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, CheckCheck, Clock, Lock, Paperclip, Send, StickyNote, AlertCircle, FileSignature, Search } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { ChatView, WaAgent, WaChat, WaMessage, WaNote, WaThread } from '../types';
import { LIMITS, OPTIN_LABEL, money, shortWhen, when, windowLeft } from '../waUtils';
import MediaView from './MediaView';
import TemplateSendForm from './TemplateSendForm';

// Every message to and from the marketing number. Replies within WhatsApp's 24-hour window; after it,
// only an approved template. Private notes are for the team and never reach the person.

const VIEWS: { id: ChatView; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'mine', label: 'Mine' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'unread', label: 'Unread' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

const CHAT_POLL_MS = 10_000;
const THREAD_POLL_MS = 4_000;

type Entry = { kind: 'msg'; at: string; m: WaMessage } | { kind: 'note'; at: string; n: WaNote };

function Tick({ m }: { m: WaMessage }) {
  if (m.direction === 'In') return null;
  if (m.status === 'failed') return <AlertCircle size={13} className="wa-tick-fail" aria-label="Not delivered" />;
  if (m.status === 'read') return <CheckCheck size={14} className="wa-tick-read" aria-label="Read" />;
  if (m.status === 'delivered') return <CheckCheck size={14} aria-label="Delivered" />;
  if (m.status === 'sent') return <Check size={14} aria-label="Sent" />;
  return <Clock size={12} aria-label="Sending" />;
}

/** The newest moment anything in the thread changed, to ask only for what is newer. */
const latest = (t: WaThread): string =>
  [...t.messages.map(m => m.statusAt ?? m.createdAt), ...t.messages.map(m => m.createdAt), ...t.notes.map(n => n.createdAt)].sort().pop() ?? new Date(0).toISOString();

export default function InboxTab({ can }: { can: WaCan }) {
  const [view, setView] = useState<ChatView>('open');
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<WaChat[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [agents, setAgents] = useState<WaAgent[]>([]);

  const loadChats = useCallback(() => waService.chats({ view, search: search.trim() || undefined })
    .then(list => { setChats(list); setListError(null); })
    .catch(e => setListError(waError(e))), [view, search]);

  useEffect(() => {
    void loadChats();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void loadChats(); }, CHAT_POLL_MS);
    return () => clearInterval(t);
  }, [loadChats]);

  useEffect(() => { waService.agents().then(setAgents).catch(() => setAgents([])); }, []);

  return (
    <div className={`wa-inbox${openId ? ' has-open' : ''}`}>
      <aside className="wa-list" aria-label="Chats">
        <div className="wa-list-top">
          <div className="wa-search">
            <Search size={14} />
            <input type="text" placeholder="Search name or number" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search chats" />
          </div>
          <div className="wa-pills" role="tablist" aria-label="Which chats">
            {VIEWS.map(v => (
              <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={`wa-pill${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {listError && <p className="hw-err wa-pad">{listError}</p>}
        {chats == null && !listError && <p className="hw-muted wa-pad">Loading…</p>}
        {chats?.length === 0 && (
          <div className="hw-empty"><b>No chats here</b><span>Messages people send to the marketing number appear here.</span></div>
        )}
        <ul className="wa-chats">
          {chats?.map(c => (
            <li key={c.contactId}>
              <button type="button" className={`wa-chat${openId === c.contactId ? ' on' : ''}`} onClick={() => setOpenId(c.contactId)}>
                <span className="wa-avatar" aria-hidden>{(c.name || c.profileName || '#').slice(0, 1).toUpperCase()}</span>
                <span className="wa-chat-main">
                  <span className="wa-chat-line">
                    <b className="wa-chat-name">{c.name || c.profileName || c.displayPhone}</b>
                    <span className="wa-chat-time">{shortWhen(c.lastMessageAt)}</span>
                  </span>
                  <span className="wa-chat-line">
                    <span className="wa-chat-prev">{c.lastMessagePreview}</span>
                    {c.unreadCount > 0 && <span className="wa-unread" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</span>}
                  </span>
                  <span className="wa-chat-meta">
                    {c.assignedName ? <>→ {c.assignedName}</> : 'Unassigned'}
                    {c.windowClosesAt && windowLeft(c.windowClosesAt) ? <span className="wa-open-dot" title="Can reply freely">● reply window open</span> : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="wa-thread-wrap">
        {openId
          ? <ThreadPane key={openId} contactId={openId} can={can} agents={agents} onBack={() => setOpenId(null)} onChanged={loadChats} />
          : <div className="hw-empty wa-thread-empty"><b>Choose a chat</b><span>Replies go out from the marketing number.</span></div>}
      </section>
    </div>
  );
}

function ThreadPane({ contactId, can, agents, onBack, onChanged }: {
  contactId: string; can: WaCan; agents: WaAgent[]; onBack: () => void; onChanged: () => void;
}) {
  const [thread, setThread] = useState<WaThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [noteMode, setNoteMode] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const since = useRef<string | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const loadAll = useCallback(async () => {
    try {
      const t = await waService.thread(contactId);
      setThread(t);
      if (t.contact.unreadCount === 0) onChangedRef.current();   // opening it read it: the list's badge goes
      since.current = latest(t);
      setError(null);
    } catch (e) {
      setError(waError(e));
    }
  }, [contactId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // New messages and status changes, merged into what is on screen.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!since.current || document.visibilityState !== 'visible') return;
      try {
        const fresh = await waService.threadSince(contactId, since.current);
        if (!fresh.messages.length && !fresh.notes.length) {
          setThread(cur => (cur ? { ...cur, contact: fresh.contact, windowOpen: fresh.windowOpen } : cur));
          return;
        }
        setThread(cur => {
          if (!cur) return cur;
          const byId = new Map(cur.messages.map(m => [m.messageId, m]));
          fresh.messages.forEach(m => byId.set(m.messageId, m));
          const notes = new Map(cur.notes.map(n => [n.noteId, n]));
          fresh.notes.forEach(n => notes.set(n.noteId, n));
          const next = { contact: fresh.contact, windowOpen: fresh.windowOpen, messages: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), notes: [...notes.values()] };
          since.current = latest(next);
          return next;
        });
      } catch { /* the next tick tries again */ }
    }, THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [contactId]);

  const entries = useMemo<Entry[]>(() => {
    if (!thread) return [];
    return [
      ...thread.messages.map(m => ({ kind: 'msg' as const, at: m.createdAt, m })),
      ...thread.notes.map(n => ({ kind: 'note' as const, at: n.createdAt, n })),
    ].sort((a, b) => a.at.localeCompare(b.at));
  }, [thread]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [entries.length]);

  if (error) return <div className="wa-pad"><p className="hw-err">{error}</p><button type="button" className="hw-btn" onClick={onBack}>Back</button></div>;
  if (!thread) return <p className="hw-muted wa-pad">Loading…</p>;

  const c = thread.contact;
  const left = windowLeft(c.windowClosesAt);
  const optedOut = c.optIn === 'OptedOut';

  const addLocal = (m: WaMessage) => setThread(cur => (cur ? { ...cur, messages: [...cur.messages, m] } : cur));

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      if (noteMode) {
        const n = await waService.addNote(contactId, body);
        setThread(cur => (cur ? { ...cur, notes: [...cur.notes, n] } : cur));
      } else {
        addLocal(await waService.sendText(contactId, body));
        onChanged();
      }
      setText('');
    } catch (e) {
      toast.error(waError(e));
    } finally {
      setBusy(false);
    }
  };

  const attach = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('Files up to 16 MB can be sent.'); return; }
    setBusy(true);
    try {
      addLocal(await waService.sendMedia(contactId, file, text.trim() || undefined));
      setText('');
      onChanged();
    } catch (e) {
      toast.error(waError(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const assign = async (userId: string) => {
    try {
      await waService.assign(contactId, userId || null);
      await loadAll();
      onChanged();
    } catch (e) { toast.error(waError(e)); }
  };

  const toggleStatus = async () => {
    try {
      await waService.setStatus(contactId, c.chatStatus === 'Open' ? 'Closed' : 'Open');
      await loadAll();
      onChanged();
    } catch (e) { toast.error(waError(e)); }
  };

  return (
    <div className="wa-thread">
      <header className="wa-thread-head">
        <button type="button" className="hw-btn wa-back" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={16} /></button>
        <div className="wa-thread-who">
          <b>{c.name || c.profileName || c.displayPhone}</b>
          <span className="hw-muted">
            {c.displayPhone}{c.profileName && c.name && c.profileName !== c.name ? ` · WhatsApp name: ${c.profileName}` : ''} · {c.source}
            {' · '}<span className={`wa-opt wa-opt-${c.optIn.toLowerCase()}`}>{OPTIN_LABEL[c.optIn]}</span>
          </span>
        </div>
        <div className="wa-thread-actions">
          {can.reply && (
            <select aria-label="Assigned to" value={c.assignedUserId ?? ''} onChange={e => assign(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.userId} value={a.userId}>{a.fullName}</option>)}
            </select>
          )}
          {can.reply && <button type="button" className="hw-btn" onClick={toggleStatus}>{c.chatStatus === 'Open' ? 'Close chat' : 'Reopen'}</button>}
        </div>
      </header>

      <div className="wa-msgs" aria-live="polite">
        {entries.length === 0 && <p className="hw-muted wa-pad">No messages yet.</p>}
        {entries.map(e => e.kind === 'note'
          ? (
            <div key={e.n.noteId} className="wa-note">
              <StickyNote size={13} /> <b>{e.n.author}</b> <span className="hw-muted">· private note · {when(e.n.createdAt)}</span>
              <div>{e.n.text}</div>
            </div>
          )
          : (
            <div key={e.m.messageId} className={`wa-bubble ${e.m.direction === 'In' ? 'wa-in' : 'wa-out'}${e.m.status === 'failed' ? ' wa-failed' : ''}`}>
              {e.m.templateName && <div className="wa-b-tag"><FileSignature size={12} /> Template · {e.m.templateName}</div>}
              {e.m.hasMedia && <MediaView message={e.m} />}
              {e.m.body && <div className="wa-b-text">{e.m.body}</div>}
              {!e.m.body && !e.m.hasMedia && <div className="wa-b-text hw-muted">({e.m.type} message)</div>}
              {e.m.errorText && <div className="wa-b-err">{e.m.errorText}</div>}
              <div className="wa-b-meta">
                {e.m.direction === 'Out' && e.m.sentBy && <span>{e.m.sentBy} · </span>}
                {e.m.cost > 0 && <span title="Charged by Meta">{money(e.m.cost)} · </span>}
                <span title={when(e.m.createdAt)}>{shortWhen(e.m.createdAt)}</span> <Tick m={e.m} />
              </div>
            </div>
          ))}
        <div ref={endRef} />
      </div>

      {can.reply ? (
        <footer className="wa-compose">
          {templateOpen
            ? <TemplateSendForm contact={c} onCancel={() => setTemplateOpen(false)} onSent={() => { setTemplateOpen(false); void loadAll(); onChanged(); }} />
            : (
              <>
                <div className="wa-window">
                  {optedOut
                    ? <><Lock size={13} /> This person asked not to get messages. Only notes can be added.</>
                    : left
                      ? <><Clock size={13} /> Reply window open · {left}. Replies inside it are free.</>
                      : <><Lock size={13} /> More than 24 hours since their last message: WhatsApp allows only an approved template. <button type="button" className="wa-link" onClick={() => setTemplateOpen(true)}>Send a template</button></>}
                </div>
                <div className="wa-compose-row">
                  <button type="button" className={`hw-btn${noteMode ? ' wa-note-on' : ''}`} onClick={() => setNoteMode(n => !n)} aria-pressed={noteMode} title="Private note for the team">
                    <StickyNote size={15} /> Note
                  </button>
                  <textarea
                    rows={2}
                    value={text}
                    maxLength={LIMITS.text}
                    placeholder={noteMode ? 'Private note: only your team sees it' : left ? 'Write a reply' : 'Free replies are closed: add a note or send a template'}
                    disabled={!noteMode && (!left || optedOut)}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                    aria-label={noteMode ? 'Private note' : 'Reply'}
                  />
                  {!noteMode && (
                    <>
                      <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,video/mp4,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={e => attach(e.target.files?.[0])} />
                      <button type="button" className="hw-btn" disabled={!left || optedOut || busy} onClick={() => fileRef.current?.click()} aria-label="Attach a file"><Paperclip size={15} /></button>
                      <button type="button" className="hw-btn" disabled={optedOut || busy} onClick={() => setTemplateOpen(true)} title="Send an approved template"><FileSignature size={15} /></button>
                    </>
                  )}
                  <button type="button" className="hw-btn hw-btn-primary" disabled={busy || !text.trim() || (!noteMode && (!left || optedOut))} onClick={submit}>
                    <Send size={15} /> {noteMode ? 'Add note' : 'Send'}
                  </button>
                </div>
              </>
            )}
        </footer>
      ) : (
        <footer className="wa-compose hw-muted wa-small">You can read chats. Replying needs “Reply to WhatsApp chats”.</footer>
      )}
    </div>
  );
}
