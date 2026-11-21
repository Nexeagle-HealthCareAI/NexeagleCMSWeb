import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hash, Link2, MessageSquarePlus, Send, Siren, Star, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { canDeleteWork } from '../access';
import { dayLabel, lastSeenText } from '../activityMeta';
import { CHAT_CHANGED, CHAT_POLL_MS, chatTime, insertMention, mentionedIn, mentionQuery, splitMentions } from '../chatMeta';
import type { ChatChannel, ChatMessage, LastSeen, WorkItem, WorkUser } from '../types';
import { errorMessage, workService } from '../services/workService';
import { Avatar, Dialog, TypeIcon } from './parts';

const KIND_TITLE = { Board: 'Boards', Group: 'Groups', Direct: 'Direct messages' } as const;

/** Tab "Chat" of the Daily Work Board: a conversation per board, groups and direct messages. */
export default function ChatTab() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useAuthStore(s => s.user);
  const canRemoveAny = canDeleteWork(useAuthStore(s => s.permissions) || []);
  const channelId = params.get('channel') || '';

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [seen, setSeen] = useState<LastSeen[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** Which conversation (and filter) `messages` belongs to. */
  const [loadedFor, setLoadedFor] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const [importantOnly, setImportantOnly] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<'group' | 'direct' | null>(null);

  const [text, setText] = useState('');
  const [important, setImportant] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [item, setItem] = useState<WorkItem | null>(null);
  const [pickingItem, setPickingItem] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggest, setSuggest] = useState<{ start: number; query: string } | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const newest = useRef('');

  const channel = channels.find(c => c.channelId === channelId) || null;
  const wanted = `${channelId}#${importantOnly}`;
  const loading = !!channelId && loadedFor !== wanted;

  const choose = useCallback((id: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'chat');
    next.set('channel', id);
    setParams(next);
  }, [params, setParams]);

  // People, last seen and the list of conversations, once.
  useEffect(() => {
    let alive = true;
    Promise.all([workService.chatState(), workService.users(), workService.lastSeen()])
      .then(([state, u, s]) => { if (!alive) return; setChannels(state.channels); setUsers(u); setSeen(s); })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not load chat.')); });
    return () => { alive = false; };
  }, []);

  // Open the first conversation when none is chosen.
  useEffect(() => {
    if (!channelId && channels.length > 0) choose(channels[0].channelId);
  }, [channelId, channels, choose]);

  const markRead = useCallback((id: string) => {
    workService.markChannelRead(id)
      .then(() => { setChannels(prev => prev.map(c => (c.channelId === id ? { ...c, unread: 0 } : c))); window.dispatchEvent(new Event(CHAT_CHANGED)); })
      .catch(() => undefined);
  }, []);

  // The chosen conversation's messages.
  useEffect(() => {
    if (!channelId) return;
    let alive = true;
    workService.chatMessages(channelId, { important: importantOnly || undefined })
      .then(list => {
        if (!alive) return;
        setMessages(list);
        setHasOlder(list.length === 50);
        newest.current = list[list.length - 1]?.createdAt || new Date(0).toISOString();
        setError('');
        markRead(channelId);
      })
      .catch(e => { if (alive) { setMessages([]); setError(errorMessage(e, 'Could not open this conversation.')); } })
      .finally(() => { if (alive) setLoadedFor(`${channelId}#${importantOnly}`); });
    return () => { alive = false; };
  }, [channelId, importantOnly, markRead]);

  // News every few seconds while this tab is in view.
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      const open = importantOnly ? '' : channelId;
      workService.chatState(open || undefined, open ? newest.current : undefined)
        .then(state => {
          setChannels(state.channels.map(c => (c.channelId === open ? { ...c, unread: 0 } : c)));
          if (!open || state.newMessages.length === 0) return;
          newest.current = state.newMessages[state.newMessages.length - 1].createdAt;
          setMessages(prev => {
            const known = new Set(prev.map(m => m.messageId));
            return [...prev, ...state.newMessages.filter(m => !known.has(m.messageId))];
          });
          if (state.newMessages.some(m => m.authorUserId !== me?.id)) markRead(open);
        })
        .catch(() => undefined);
    }, CHAT_POLL_MS);
    return () => window.clearInterval(tick);
  }, [channelId, importantOnly, markRead, me?.id]);

  // Keep the newest message in view.
  const count = messages.length;
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }); }, [count, loadedFor]);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    try {
      const older = await workService.chatMessages(channelId, { before: first.createdAt, important: importantOnly || undefined });
      setMessages(prev => [...older, ...prev]);
      setHasOlder(older.length === 50);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not load older messages.'));
    }
  };

  // Who can be tagged here: a group's or direct message's people, otherwise everyone.
  const taggable = useMemo(() => {
    const pool = channel && channel.kind !== 'Board' ? users.filter(u => channel.memberUserIds.includes(u.userId)) : users;
    return pool.filter(u => u.userId !== me?.id);
  }, [channel, users, me?.id]);
  const suggestions = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    return taggable.filter(u => u.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [suggest, taggable]);

  const onType = (value: string, cursor: number) => {
    setText(value);
    setSuggest(mentionQuery(value, cursor));
    setSuggestIndex(0);
  };
  const pickMention = (user: WorkUser) => {
    if (!suggest) return;
    const cursor = input.current?.selectionStart ?? text.length;
    const next = insertMention(text, cursor, suggest.start, user.fullName);
    setText(next.text);
    setSuggest(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.cursor, next.cursor); });
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !channelId || sending) return;
    const mentionUserIds = mentionedIn(body, taggable);
    if (escalate && mentionUserIds.length === 0) { toast.error('Tag at least one person to escalate to: type @ and pick a name.'); return; }
    setSending(true);
    try {
      const sent = await workService.sendMessage(channelId, { body, isImportant: important, isEscalation: escalate, mentionUserIds, workItemId: item?.workItemId });
      newest.current = sent.createdAt;
      if (!importantOnly || sent.isImportant) setMessages(prev => (prev.some(m => m.messageId === sent.messageId) ? prev : [...prev, sent]));
      setText(''); setImportant(false); setEscalate(false); setItem(null); setSuggest(null);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send. Try again.'));
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggest && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIndex(i => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIndex(i => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(suggestions[suggestIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSuggest(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const toggleImportant = async (m: ChatMessage) => {
    try {
      const saved = await workService.markImportant(m.messageId, !m.isImportant);
      setMessages(prev => (importantOnly && !saved.isImportant ? prev.filter(x => x.messageId !== m.messageId) : prev.map(x => (x.messageId === m.messageId ? saved : x))));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change that.'));
    }
  };
  const remove = async (m: ChatMessage) => {
    try {
      await workService.deleteMessage(m.messageId);
      setMessages(prev => prev.map(x => (x.messageId === m.messageId ? { ...x, isDeleted: true, body: '', isImportant: false, isEscalation: false, workItemId: null } : x)));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove the message.'));
    }
  };

  const seenBy = new Map(seen.map(s => [s.userId, s]));
  const names = useMemo(() => users.map(u => u.fullName), [users]);
  const groups = (['Board', 'Group', 'Direct'] as const).map(kind => ({ kind, list: channels.filter(c => c.kind === kind) }));
  const other = channel?.otherUserId ? seenBy.get(channel.otherUserId) : undefined;

  const days: { day: string; list: ChatMessage[] }[] = [];
  for (const m of messages) {
    const day = dayLabel(m.createdAt);
    const lastDay = days[days.length - 1];
    if (lastDay && lastDay.day === day) lastDay.list.push(m); else days.push({ day, list: [m] });
  }

  return (
    <div className="wk-chat">
      <aside className="wk-chat-side" aria-label="Conversations">
        <div className="wk-chat-new">
          <button type="button" className="wk-btn" onClick={() => setStarting('direct')}><MessageSquarePlus size={16} aria-hidden="true" /> Message</button>
          <button type="button" className="wk-btn" onClick={() => setStarting('group')}><Users size={16} aria-hidden="true" /> Group</button>
        </div>
        {groups.map(({ kind, list }) => list.length > 0 && (
          <section key={kind}>
            <h3>{KIND_TITLE[kind]}</h3>
            {list.map(c => {
              const s = c.otherUserId ? seenBy.get(c.otherUserId) : undefined;
              return (
                <button key={c.channelId} type="button" className={`wk-chat-channel ${c.channelId === channelId ? 'is-on' : ''}`} aria-current={c.channelId === channelId ? 'true' : undefined} onClick={() => choose(c.channelId)}>
                  {c.kind === 'Board' ? <Hash size={16} aria-hidden="true" /> : c.kind === 'Group' ? <Users size={16} aria-hidden="true" /> : <span className={`wk-dot ${s?.isOnline ? 'is-on' : ''}`} aria-hidden="true" />}
                  <span className="wk-chat-channel-text">
                    <strong>{c.kind === 'Board' && c.projectKey ? `${c.projectKey} · ${c.name}` : c.name}</strong>
                    {c.lastMessageText && <small>{c.lastMessageBy ? `${c.lastMessageBy.split(' ')[0]}: ` : ''}{c.lastMessageText}</small>}
                  </span>
                  {c.unread > 0 && <span className="wk-badge" aria-label={`${c.unread} unread`}>{c.unread > 99 ? '99+' : c.unread}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </aside>

      <section className="wk-chat-main" aria-label={channel ? `Conversation: ${channel.name}` : 'Conversation'}>
        {!channel ? <p className="wk-muted wk-chat-note">{error || 'Choose a conversation.'}</p> : (
          <>
            <header className="wk-chat-head">
              <div>
                <h2>{channel.kind === 'Board' && channel.projectKey ? `${channel.projectKey} · ${channel.name}` : channel.name}</h2>
                <p className="wk-muted">
                  {channel.kind === 'Board' ? 'Everyone who can open this board'
                    : channel.kind === 'Group' ? `${channel.memberUserIds.length} people`
                      : lastSeenText(other?.lastSeenAt, !!other?.isOnline)}
                </p>
              </div>
              <label className="wk-check">
                <input type="checkbox" checked={importantOnly} onChange={e => setImportantOnly(e.target.checked)} />
                <span><Star size={15} aria-hidden="true" /> Important only</span>
              </label>
            </header>

            <div className="wk-chat-messages" role="log" aria-label="Messages" aria-live="polite">
              {error && <p className="wk-error" role="alert">{error}</p>}
              {loading ? <p className="wk-muted wk-chat-note">Loading messages…</p> : messages.length === 0 ? (
                <p className="wk-muted wk-chat-note">{importantOnly ? 'Nothing is marked important here yet.' : 'No messages yet. Say hello.'}</p>
              ) : (
                <>
                  {hasOlder && <button type="button" className="wk-link wk-chat-older" onClick={() => void loadOlder()}>Load older messages</button>}
                  {days.map(group => (
                    <div key={group.day}>
                      <p className="wk-chat-day"><span>{group.day}</span></p>
                      {group.list.map(m => {
                        const mine = m.authorUserId === me?.id;
                        const forMe = !!me?.id && m.mentionUserIds.includes(me.id);
                        return (
                          <article key={m.messageId} className={`wk-chat-msg ${m.isEscalation ? 'is-escalation' : m.isImportant ? 'is-important' : ''} ${forMe ? 'is-for-me' : ''}`}>
                            <Avatar name={m.authorName} />
                            <div className="wk-chat-msg-body">
                              <p className="wk-chat-msg-head">
                                <strong>{m.authorName}</strong> <time dateTime={m.createdAt}>{chatTime(m.createdAt)}</time>
                                {m.isEscalation && <span className="wk-chat-flag is-escalation"><Siren size={13} aria-hidden="true" /> Escalation</span>}
                                {m.isImportant && !m.isEscalation && <span className="wk-chat-flag"><Star size={13} aria-hidden="true" /> Important</span>}
                              </p>
                              {m.isDeleted ? <p className="wk-muted"><em>Message removed</em></p> : (
                                <p className="wk-chat-text">
                                  {splitMentions(m.body, names).map((part, i) => (part.mention ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
                                </p>
                              )}
                              {m.workItemId && (
                                <button type="button" className="wk-chat-item" onClick={() => navigate(`/work?item=${encodeURIComponent(m.workItemId!)}`)}>
                                  <Link2 size={14} aria-hidden="true" /> <strong>{m.workItemKey}</strong> {m.workItemTitle}
                                </button>
                              )}
                            </div>
                            {!m.isDeleted && (
                              <div className="wk-chat-msg-tools">
                                <button type="button" aria-pressed={m.isImportant} aria-label={m.isImportant ? 'Remove the important mark' : 'Mark important'} title={m.isImportant ? 'Remove the important mark' : 'Mark important'} disabled={m.isEscalation} onClick={() => void toggleImportant(m)}>
                                  <Star size={16} aria-hidden="true" fill={m.isImportant ? 'currentColor' : 'none'} />
                                </button>
                                {(mine || canRemoveAny) && (
                                  <button type="button" aria-label="Remove message" title="Remove message" onClick={() => void remove(m)}><Trash2 size={16} aria-hidden="true" /></button>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
              <div ref={bottom} />
            </div>

            <form className={`wk-chat-compose ${escalate ? 'is-escalation' : ''}`} onSubmit={send}>
              {item && (
                <p className="wk-chat-attached">
                  <Link2 size={14} aria-hidden="true" /> <strong>{item.key}</strong> {item.title}
                  <button type="button" aria-label="Remove the work item" onClick={() => setItem(null)}><X size={14} aria-hidden="true" /></button>
                </p>
              )}
              <div className="wk-chat-inputwrap">
                {suggest && suggestions.length > 0 && (
                  <ul className="wk-chat-suggest" role="listbox" aria-label="People to tag">
                    {suggestions.map((u, i) => (
                      <li key={u.userId} role="option" aria-selected={i === suggestIndex} className={i === suggestIndex ? 'is-on' : ''} onMouseDown={e => { e.preventDefault(); pickMention(u); }}>
                        <Avatar name={u.fullName} /> {u.fullName} <small>{lastSeenText(seenBy.get(u.userId)?.lastSeenAt, !!seenBy.get(u.userId)?.isOnline)}</small>
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  ref={input} value={text} rows={2} maxLength={4000} aria-label="Message"
                  placeholder={escalate ? 'What needs attention? Type @ to choose who to escalate to' : 'Write a message. Type @ to tag someone. Enter sends, Shift+Enter makes a new line'}
                  onChange={e => onType(e.target.value, e.target.selectionStart)} onKeyDown={onKey} onBlur={() => setSuggest(null)}
                />
              </div>
              <div className="wk-chat-actions">
                <button type="button" className={`wk-chip ${important ? 'is-on' : ''}`} aria-pressed={important} onClick={() => setImportant(v => !v)}><Star size={15} aria-hidden="true" /> Important</button>
                <button type="button" className={`wk-chip is-danger ${escalate ? 'is-on' : ''}`} aria-pressed={escalate} onClick={() => setEscalate(v => !v)}><Siren size={15} aria-hidden="true" /> Escalate</button>
                <button type="button" className="wk-chip" onClick={() => setPickingItem(true)}><Link2 size={15} aria-hidden="true" /> Work item</button>
                <button type="submit" className="wk-btn is-primary" disabled={sending || !text.trim()}><Send size={16} aria-hidden="true" /> {escalate ? 'Escalate' : 'Send'}</button>
              </div>
            </form>
          </>
        )}
      </section>

      {starting && (
        <StartDialog
          mode={starting} users={users.filter(u => u.userId !== me?.id)} seen={seenBy} onClose={() => setStarting(null)}
          onOpened={c => { setChannels(prev => (prev.some(x => x.channelId === c.channelId) ? prev : [...prev, c])); setStarting(null); choose(c.channelId); }}
        />
      )}
      {pickingItem && <ItemPicker projectId={channel?.projectId || null} onClose={() => setPickingItem(false)} onPick={picked => { setItem(picked); setPickingItem(false); }} />}
    </div>
  );
}

/** Start a direct message (pick one person) or a group (a name and several people). */
function StartDialog({ mode, users, seen, onClose, onOpened }: {
  mode: 'group' | 'direct'; users: WorkUser[]; seen: Map<string, LastSeen>; onClose: () => void; onOpened: (channel: ChatChannel) => void;
}) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<ChatChannel>) => {
    setBusy(true);
    setError('');
    try { onOpened(await work()); } catch (e) { setError(errorMessage(e, 'Could not start the conversation.')); setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the group a name.'); return; }
    if (picked.length === 0) { setError('Choose at least one person.'); return; }
    void run(() => workService.createGroup({ name: name.trim(), memberUserIds: picked }));
  };

  if (mode === 'direct') {
    return (
      <Dialog title="Message someone" onClose={onClose}>
        <div className="wk-form">
          <div className="wk-members-list">
            {users.map(u => (
              <button key={u.userId} type="button" className="wk-chat-person" disabled={busy} onClick={() => void run(() => workService.openDirect(u.userId))}>
                <Avatar name={u.fullName} /> <span>{u.fullName}</span>
                <small><span className={`wk-dot ${seen.get(u.userId)?.isOnline ? 'is-on' : ''}`} aria-hidden="true" /> {lastSeenText(seen.get(u.userId)?.lastSeenAt, !!seen.get(u.userId)?.isOnline)}</small>
              </button>
            ))}
          </div>
          {error && <p className="wk-error" role="alert">{error}</p>}
          <div className="wk-form-actions"><button type="button" className="wk-btn" onClick={onClose}>Cancel</button></div>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title="New group" onClose={onClose}>
      <form className="wk-form" onSubmit={submit} noValidate>
        <label className="wk-field">
          <span>Name</span>
          <input data-autofocus value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Release crew" />
        </label>
        <fieldset className="wk-members">
          <legend>People ({picked.length})</legend>
          <div className="wk-members-list">
            {users.map(u => (
              <label key={u.userId} className="wk-check">
                <input type="checkbox" checked={picked.includes(u.userId)} onChange={() => setPicked(prev => (prev.includes(u.userId) ? prev.filter(x => x !== u.userId) : [...prev, u.userId]))} />
                <span>{u.fullName}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="wk-error" role="alert">{error}</p>}
        <div className="wk-form-actions">
          <button type="button" className="wk-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wk-btn is-primary" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Choose a work item to attach to a message. Starts on the conversation's own board. */
function ItemPicker({ projectId, onClose, onPick }: { projectId: string | null; onClose: () => void; onPick: (item: WorkItem) => void }) {
  const [projects, setProjects] = useState<{ projectId: string; key: string }[]>([]);
  const [chosen, setChosen] = useState(projectId || '');
  const [items, setItems] = useState<WorkItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    workService.projects().then(p => { if (!alive) return; setProjects(p); setChosen(c => c || p[0]?.projectId || ''); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    workService.items(chosen).then(list => { if (alive) setItems(list); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [chosen]);

  const q = query.trim().toLowerCase();
  const shown = items.filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)).slice(0, 40);
  return (
    <Dialog title="Attach a work item" onClose={onClose}>
      <div className="wk-form">
        <div className="wk-filters">
          <select value={chosen} onChange={e => setChosen(e.target.value)} aria-label="Board">
            {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.key}</option>)}
          </select>
          <input type="search" data-autofocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find by key or title" aria-label="Find a work item" />
        </div>
        <div className="wk-members-list">
          {shown.map(i => (
            <button key={i.workItemId} type="button" className="wk-chat-person" onClick={() => onPick(i)}>
              <TypeIcon type={i.itemType} /> <strong>{i.key}</strong> <span>{i.title}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="wk-muted">No work items match.</p>}
        </div>
        <div className="wk-form-actions"><button type="button" className="wk-btn" onClick={onClose}>Cancel</button></div>
      </div>
    </Dialog>
  );
}
