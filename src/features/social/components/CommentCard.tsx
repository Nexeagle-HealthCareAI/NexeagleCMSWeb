import { useState } from 'react';
import { toast } from 'sonner';
import { Check, EyeOff, Lock, MessageSquareReply, UserPlus } from 'lucide-react';
import type { SocialCan } from '../access';
import { socialService, socialError } from '../services/socialService';
import type { SocialComment } from '../types';
import { ago } from '../socialUtils';
import { MakeLead, Modal } from './shared';

// One comment on our post, its replies, and what can be done with it: reply in public, reply once in private
// (a direct message; within 7 days), make a CRM lead, hide it, or mark it done without answering.

export default function CommentCard({ comment: initial, can, compact, onChange }: { comment: SocialComment; can: SocialCan; compact?: boolean; onChange?: (c: SocialComment) => void }) {
  const [c, setC] = useState(initial);
  const [mode, setMode] = useState<'public' | 'private' | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  const update = (next: SocialComment) => { setC(next); onChange?.(next); };
  const run = async (fn: () => Promise<SocialComment>, ok: string) => {
    setBusy(true);
    try { update(await fn()); toast.success(ok); return true; } catch (e) { toast.error(socialError(e)); return false; } finally { setBusy(false); }
  };
  const send = async () => {
    if (!text.trim()) return;
    if (await run(() => socialService.replyToComment(c.commentId, text.trim(), mode === 'private'), mode === 'private' ? 'Sent as a private message.' : 'Reply posted.')) { setText(''); setMode(null); }
  };

  return (
    <div className={`sc-comment${c.hidden ? ' hidden' : ''}${compact ? ' compact' : ''}`}>
      <div className="sc-comment-head">
        <b>{c.authorName ?? 'Someone'}</b>
        <span className="hw-muted wa-small">{ago(c.createdAt)} ago</span>
        {c.hidden && <span className="wa-chip">Hidden</span>}
        {c.status === 'Done' && <span className="wa-chip">Done{c.repliedBy ? ` · ${c.repliedBy}` : ''}</span>}
        {c.privateReplyAt && <span className="wa-chip">Private reply sent</span>}
        {c.leadId && <span className="wa-chip sc-chip-lead">Lead</span>}
      </div>
      <p className="sc-comment-text">{c.text}</p>
      {c.replies.map(r => (
        <div key={r.commentId} className={`sc-reply${r.fromUs ? ' ours' : ''}`}>
          <b>{r.fromUs ? 'You' : r.authorName ?? 'Someone'}</b> {r.text} <span className="hw-muted wa-small">· {ago(r.createdAt)} ago</span>
        </div>
      ))}
      {can.reply && (
        <div className="sc-comment-actions">
          <button type="button" className="wa-link" onClick={() => setMode(mode === 'public' ? null : 'public')}><MessageSquareReply size={13} /> Reply</button>
          {c.canPrivateReply && <button type="button" className="wa-link" onClick={() => setMode(mode === 'private' ? null : 'private')}><Lock size={13} /> Reply in DM</button>}
          {!c.leadId && <button type="button" className="wa-link" onClick={() => setLeadOpen(true)}><UserPlus size={13} /> Make lead</button>}
          <button type="button" className="wa-link" disabled={busy} onClick={() => run(() => socialService.hideComment(c.commentId, !c.hidden), c.hidden ? 'Shown again.' : 'Hidden: only they and their friends see it.')}><EyeOff size={13} /> {c.hidden ? 'Unhide' : 'Hide'}</button>
          {c.status !== 'Done' && <button type="button" className="wa-link" disabled={busy} onClick={() => run(() => socialService.commentDone(c.commentId, true), 'Marked done.')}><Check size={13} /> Done</button>}
        </div>
      )}
      {mode && (
        <div className="sc-comment-reply">
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'private' ? 'A private message to them (once, within 7 days of the comment)' : 'Your public reply'} aria-label={mode === 'private' ? 'Private reply' : 'Reply'} />
          <button type="button" className="hw-btn hw-btn-primary" onClick={send} disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      )}
      {leadOpen && (
        <Modal title="Make a lead from this comment" onClose={() => setLeadOpen(false)}>
          <p className="hw-muted wa-small">“{c.text}” — the comment is kept with the lead.</p>
          <MakeLead name={c.authorName ?? ''} onMake={async p => {
            const l = await socialService.leadFromComment(c.commentId, p);
            update({ ...c, leadId: l.leadId });
            setLeadOpen(false);
            return l;
          }} />
        </Modal>
      )}
    </div>
  );
}
