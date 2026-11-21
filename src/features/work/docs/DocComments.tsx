import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CornerDownRight, MessageSquare, Pencil, Quote, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { insertMention, mentionedIn, mentionQuery, splitMentions } from '../chatMeta';
import { Avatar } from '../components/parts';
import { errorMessage, workService } from '../services/workService';
import type { WorkUser } from '../types';
import { formatWhen } from '../workMeta';
import { docsService } from './docsService';
import type { DocComment } from './types';

const MAX = 4000;
const MAX_QUOTE = 500;
/** The part of the document screen whose selected text can be quoted. */
const MAIN = '.dc-view-main';

/** Finds the quoted text in the document, selects it and brings it into view. False when it is no longer there. */
function showQuote(quote: string): boolean {
  const main = document.querySelector(MAIN);
  if (!main) return false;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  // The quote can run over several text nodes (bold words, list items), so search the joined text.
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push({ node: n as Text, start: text.length }); text += (n as Text).data; }
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
  let at = text.indexOf(quote);
  let length = quote.length;
  if (at < 0) {
    // Line breaks in the selection do not exist in the joined text: try the first line alone.
    const firstLine = squash(quote.split('\n')[0]);
    at = firstLine ? text.indexOf(firstLine) : -1;
    length = firstLine.length;
  }
  if (at < 0) return false;
  const locate = (offset: number) => {
    const hit = [...nodes].reverse().find(x => x.start <= offset) || nodes[0];
    return { node: hit.node, offset: Math.min(offset - hit.start, hit.node.data.length) };
  };
  const from = locate(at);
  const to = locate(at + length);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  from.node.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  return true;
}

interface BoxProps {
  users: WorkUser[];
  placeholder: string;
  submitLabel: string;
  initial?: string;
  autoFocus?: boolean;
  onSubmit: (body: string, mentionUserIds: string[]) => Promise<void>;
  onCancel?: () => void;
}

/** The writing box: type @ to tag someone, Ctrl+Enter (or the button) to post. */
function CommentBox({ users, placeholder, submitLabel, initial = '', autoFocus, onSubmit, onCancel }: BoxProps) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    return users.filter(u => u.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [suggest, users]);

  const pick = (user: WorkUser) => {
    if (!suggest) return;
    const cursor = input.current?.selectionStart ?? text.length;
    const next = insertMention(text, cursor, suggest.start, user.fullName);
    setText(next.text);
    setSuggest(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.cursor, next.cursor); });
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onSubmit(body, mentionedIn(body, users));
      setText('');
      setSuggest(null);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not post the comment. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggest && options.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[index]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSuggest(null); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
    if (e.key === 'Escape' && onCancel) { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };

  return (
    <div className="dc-cbox">
      {suggest && options.length > 0 && (
        <ul className="dc-csuggest" role="listbox" aria-label="People to tag">
          {options.map((u, i) => (
            <li key={u.userId} role="option" aria-selected={i === index} className={i === index ? 'is-on' : ''} onMouseDown={e => { e.preventDefault(); pick(u); }}>
              <Avatar name={u.fullName} /> {u.fullName}
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={input} value={text} rows={2} maxLength={MAX} placeholder={placeholder} aria-label={placeholder}
        onChange={e => { setText(e.target.value); setSuggest(mentionQuery(e.target.value, e.target.selectionStart)); setIndex(0); }}
        onKeyDown={onKey} onBlur={() => setSuggest(null)}
      />
      <div className="dc-cbox-actions">
        <small>Type @ to tag someone</small>
        {onCancel && <button type="button" className="wk-btn" onClick={onCancel}>Cancel</button>}
        <button type="button" className="wk-btn is-primary" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? 'Posting…' : submitLabel}</button>
      </div>
    </div>
  );
}

/**
 * Comments on one document: threads with replies, tagging, the selected text a comment is about,
 * resolve and reopen. Everyone who can open the document can read and write here.
 */
export default function DocComments({ documentId, canRemoveAny }: { documentId: string; canRemoveAny: boolean }) {
  const me = useAuthStore(s => s.user);
  const [params] = useSearchParams();
  const wanted = params.get('comment');
  const [comments, setComments] = useState<DocComment[] | null>(null);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const [quote, setQuote] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setComments(await docsService.comments(documentId));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load the comments.'));
    }
  }, [documentId]);

  useEffect(() => {
    let alive = true;
    docsService.comments(documentId)
      .then(list => { if (alive) { setComments(list); setError(''); } })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not load the comments.')); });
    workService.users().then(u => { if (alive) setUsers(u); }).catch(() => undefined);
    // Other people's comments arrive without a reload, while this tab is in view.
    const tick = window.setInterval(() => { if (!document.hidden) void load(); }, 20_000);
    return () => { alive = false; window.clearInterval(tick); };
  }, [documentId, load]);

  // Text selected in the document is offered as what the next comment is about.
  useEffect(() => {
    const onSelect = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const main = document.querySelector(MAIN);
      if (!main || !selection.anchorNode || !main.contains(selection.anchorNode)) return;
      const text = selection.toString().trim();
      if (text) setQuote(text.slice(0, MAX_QUOTE));
    };
    document.addEventListener('selectionchange', onSelect);
    return () => document.removeEventListener('selectionchange', onSelect);
  }, []);

  const threads = useMemo(() => {
    const roots = (comments || []).filter(c => !c.parentId);
    return roots
      .map(root => ({ root, replies: (comments || []).filter(c => c.parentId === root.commentId) }))
      // A removed first comment with nothing under it has nothing left to show.
      .filter(t => !t.root.isDeleted || t.replies.some(r => !r.isDeleted))
      .sort((a, b) => b.root.createdAt.localeCompare(a.root.createdAt));
  }, [comments]);
  const open = threads.filter(t => !t.root.isResolved);
  const resolved = threads.filter(t => t.root.isResolved);

  // Arriving from a notification: show the side the comment is on, and bring it into view.
  const target = wanted && comments ? comments.find(c => c.commentId === wanted) : undefined;
  const targetRoot = target ? threads.find(t => t.root.commentId === (target.parentId ?? target.commentId)) : undefined;
  const targetSide = targetRoot ? (targetRoot.root.isResolved ? 'resolved' : 'open') : null;
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (wanted && targetSide && shownFor !== wanted) { setShownFor(wanted); setShow(targetSide); }
  useEffect(() => {
    if (!shownFor) return;
    document.getElementById(`comment-${shownFor}`)?.scrollIntoView?.({ block: 'center' });
  }, [shownFor, show]);

  // The comment asked for is newer than what is on screen (the bell was clicked while this document
  // was already open): fetch once more.
  const sought = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || !comments || target || sought.current === wanted) return;
    sought.current = wanted;
    docsService.comments(documentId).then(setComments).catch(() => undefined);
  }, [wanted, comments, target, documentId]);

  const names = useMemo(() => users.map(u => u.fullName), [users]);
  const taggable = useMemo(() => users.filter(u => u.userId !== me?.id), [users, me?.id]);
  const replace = (saved: DocComment) => setComments(prev => (prev || []).map(c => (c.commentId === saved.commentId ? saved : c)));

  const add = async (body: string, mentionUserIds: string[], parentId: string | null) => {
    const saved = await docsService.addComment(documentId, { body, mentionUserIds, parentId, quote: parentId ? null : quote || null });
    setComments(prev => {
      const next = [...(prev || []), saved];
      // An answer reopens a resolved thread.
      return parentId ? next.map(c => (c.commentId === parentId ? { ...c, isResolved: false, resolvedByName: null, resolvedAt: null } : c)) : next;
    });
    if (parentId) setReplyTo(null); else { setQuote(''); setShow('open'); }
  };
  const edit = async (comment: DocComment, body: string, mentionUserIds: string[]) => {
    replace(await docsService.editComment(comment.commentId, { body, mentionUserIds }));
    setEditing(null);
  };
  const resolve = async (root: DocComment, isResolved: boolean) => {
    try { replace(await docsService.resolveComment(root.commentId, isResolved)); } catch (e) { toast.error(errorMessage(e, 'Could not change that.')); }
  };
  const remove = async (comment: DocComment) => {
    try {
      await docsService.removeComment(comment.commentId);
      setComments(prev => (prev || []).map(c => (c.commentId === comment.commentId ? { ...c, isDeleted: true, body: '', quote: null, mentionUserIds: [] } : c)));
    } catch (e) {
      toast.error(errorMessage(e, 'Could not remove the comment.'));
    }
  };

  const one = (c: DocComment, root: DocComment) => {
    const mine = c.authorUserId === me?.id;
    const forMe = !!me?.id && c.mentionUserIds.includes(me.id);
    return (
      <article key={c.commentId} id={`comment-${c.commentId}`} className={`dc-comment ${c.parentId ? 'is-reply' : ''} ${forMe ? 'is-for-me' : ''} ${shownFor === c.commentId ? 'is-target' : ''}`}>
        <Avatar name={c.authorName} />
        <div className="dc-comment-body">
          <p className="dc-comment-head">
            <strong>{c.authorName}</strong> <time dateTime={c.createdAt}>{formatWhen(c.createdAt)}</time>{c.isEdited && <small>edited</small>}
          </p>
          {c.isDeleted ? <p className="wk-muted"><em>Comment removed</em></p> : editing === c.commentId ? (
            <CommentBox users={taggable} initial={c.body} autoFocus placeholder="Change your comment" submitLabel="Save" onSubmit={(body, tags) => edit(c, body, tags)} onCancel={() => setEditing(null)} />
          ) : (
            <>
              {c.quote && (
                <button type="button" className="dc-quote" title="Show this text in the document" onClick={() => { if (!showQuote(c.quote!)) toast.message('That text is no longer in the document.'); }}>
                  <Quote size={13} aria-hidden="true" /> <span>{c.quote}</span>
                </button>
              )}
              <p className="dc-comment-text">{splitMentions(c.body, names).map((part, i) => (part.mention ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}</p>
              <div className="dc-comment-tools">
                {!root.isResolved && <button type="button" onClick={() => { setReplyTo(root.commentId); setEditing(null); }}><CornerDownRight size={14} aria-hidden="true" /> Reply</button>}
                {mine && <button type="button" onClick={() => { setEditing(c.commentId); setReplyTo(null); }}><Pencil size={14} aria-hidden="true" /> Edit</button>}
                {(mine || canRemoveAny) && <button type="button" onClick={() => void remove(c)}><Trash2 size={14} aria-hidden="true" /> Remove</button>}
              </div>
            </>
          )}
        </div>
      </article>
    );
  };

  const list = show === 'open' ? open : resolved;
  return (
    <section className="dc-comments" aria-label="Comments">
      <h3><MessageSquare size={15} aria-hidden="true" /> Comments<span className="wk-count">{open.length}</span></h3>

      {quote && (
        <p className="dc-quote is-draft">
          <Quote size={13} aria-hidden="true" /> <span>{quote}</span>
          <button type="button" aria-label="Do not quote this text" onClick={() => setQuote('')}><X size={14} aria-hidden="true" /></button>
        </p>
      )}
      <CommentBox users={taggable} placeholder={quote ? 'Comment on the selected text' : 'Add a comment'} submitLabel="Comment" onSubmit={(body, tags) => add(body, tags, null)} />
      {!quote && <p className="wk-hint">Select text in the document first to comment on that part.</p>}

      <div className="ne-seg dc-comment-tabs" role="tablist" aria-label="Which comments">
        <button type="button" role="tab" aria-selected={show === 'open'} className={show === 'open' ? 'is-on' : ''} onClick={() => setShow('open')}>Open ({open.length})</button>
        <button type="button" role="tab" aria-selected={show === 'resolved'} className={show === 'resolved' ? 'is-on' : ''} onClick={() => setShow('resolved')}>Resolved ({resolved.length})</button>
      </div>

      {error && <p className="wk-error" role="alert">{error}</p>}
      {comments === null && !error ? <p className="wk-muted">Loading comments…</p> : list.length === 0 ? (
        <p className="wk-muted">{show === 'open' ? 'No open comments.' : 'Nothing resolved yet.'}</p>
      ) : list.map(({ root, replies }) => (
        <div key={root.commentId} className={`dc-thread ${root.isResolved ? 'is-resolved' : ''}`}>
          {one(root, root)}
          {replies.map(r => one(r, root))}
          {replyTo === root.commentId && (
            <CommentBox users={taggable} autoFocus placeholder="Write a reply" submitLabel="Reply" onSubmit={(body, tags) => add(body, tags, root.commentId)} onCancel={() => setReplyTo(null)} />
          )}
          <div className="dc-thread-foot">
            {root.isResolved
              ? <><small>Resolved by {root.resolvedByName || 'someone'}{root.resolvedAt ? ` · ${formatWhen(root.resolvedAt)}` : ''}</small><button type="button" className="wk-link" onClick={() => void resolve(root, false)}><RotateCcw size={14} aria-hidden="true" /> Reopen</button></>
              : <button type="button" className="wk-link" onClick={() => void resolve(root, true)}><Check size={14} aria-hidden="true" /> Resolve</button>}
          </div>
        </div>
      ))}
    </section>
  );
}
