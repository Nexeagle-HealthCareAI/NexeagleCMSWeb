import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import type { SocialCan } from '../access';
import { socialService, socialError } from '../services/socialService';
import type { Channel, PostKind, SocialAccount, SocialDraft, SocialDraftSave, SocialMediaRef, SocialPerson, WhenMode } from '../types';
import {
  captionFor, checkFile, checkPost, fromLocalInput, hashtags, OPTIONAL_CHECKS, REQUIRED_CHECKS, RULES, toJpeg, toLocalInput, when,
} from '../socialUtils';
import { MediaThumb, Modal, StatusTag } from './shared';

// Social → Compose: write a post for the Page, Instagram or both, see how it will look, and send it for approval.
// Someone with "Approve and publish posts" approves it (after the healthcare checks); the CMS then posts it at
// the time chosen. Changing an approved post sends it back for approval.

const KIND_CHOICES: PostKind[] = ['Photo', 'Carousel', 'Video', 'Reel', 'Story', 'Text', 'Link'];
const WHEN: { id: WhenMode; label: string }[] = [
  { id: 'approved', label: 'Post when approved' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'queue', label: 'Add to the queue' },
];
const STEPS = [
  { label: 'Draft', on: ['Draft', 'SentBack'] },
  { label: 'Waiting for approval', on: ['AwaitingApproval'] },
  { label: 'Scheduled', on: ['Scheduled', 'Publishing', 'Failed'] },
  { label: 'Published', on: ['Published'] },
];
const EDITABLE = ['Draft', 'SentBack', 'AwaitingApproval', 'Scheduled', 'Failed'];

const empty = (accountId: string, account: SocialAccount): SocialDraftSave => ({
  accountId, title: '', toFacebook: !!account.pageId, toInstagram: !!account.igUserId, kind: 'Photo', caption: '', media: [], whenMode: 'approved', checklist: {},
});
const fromDraft = (d: SocialDraft): SocialDraftSave => ({
  accountId: d.accountId, title: d.title, toFacebook: d.toFacebook, toInstagram: d.toInstagram, kind: d.kind, caption: d.caption ?? '',
  facebookCaption: d.facebookCaption, instagramCaption: d.instagramCaption, link: d.link, media: d.media, whenMode: d.whenMode,
  scheduledAt: d.scheduledAt, checklist: d.checklist ?? {}, approverUserId: d.approverUserId,
});

export default function ComposeTab({ account, can, draftId }: { account: SocialAccount; can: SocialCan; draftId?: string }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<SocialDraftSave>(() => empty(account.accountId, account));
  const [draft, setDraft] = useState<SocialDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [approvers, setApprovers] = useState<SocialPerson[]>([]);
  const [preview, setPreview] = useState<Channel>(account.igUserId ? 'instagram' : 'facebook');
  const [limit, setLimit] = useState<{ used: number; total: number } | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { socialService.approvers().then(setApprovers).catch(() => { /* optional */ }); }, []);
  useEffect(() => { if (account.igUserId) socialService.publishingLimit(account.accountId).then(setLimit).catch(() => { /* optional */ }); }, [account.accountId, account.igUserId]);
  useEffect(() => {
    if (!draftId) { setDraft(null); return; }
    let live = true;
    socialService.draft(draftId)
      .then(d => { if (!live) return; setDraft(d); setForm(fromDraft(d)); setSplit(!!(d.facebookCaption?.trim() || d.instagramCaption?.trim())); })
      .catch(e => { if (live) setLoadError(socialError(e)); });
    return () => { live = false; };
  }, [draftId]);

  const set = <K extends keyof SocialDraftSave>(k: K, v: SocialDraftSave[K]) => setForm(f => ({ ...f, [k]: v }));
  const editable = !draft || EDITABLE.includes(draft.status);
  const problem = useMemo(() => checkPost(form), [form]);
  const checksDone = REQUIRED_CHECKS.every(c => form.checklist[c.key]);
  const noMedia = form.kind === 'Text' || form.kind === 'Link';
  const igCaption = captionFor(form, 'instagram');
  const step = draft ? STEPS.findIndex(s => s.on.includes(draft.status)) : 0;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    for (const f of list) {
      const bad = checkFile(f);
      if (bad) { toast.error(bad); return; }
    }
    setUploading(u => u + list.length);
    try {
      for (const f of list) {
        try {
          const jpeg = f.type.startsWith('image/') ? await toJpeg(f) : f;
          const ref = await socialService.upload(jpeg);
          setForm(cur => {
            const media = [...cur.media, ref];
            const kind = cur.kind === 'Photo' && media.filter(m => m.mime.startsWith('image/')).length > 1 ? 'Carousel'
              : ref.mime.startsWith('video/') && (cur.kind === 'Photo' || cur.kind === 'Carousel') && media.length === 1 ? (cur.toInstagram ? 'Reel' : 'Video') : cur.kind;
            return { ...cur, media, kind };
          });
        } catch (e) { toast.error(`${f.name}: ${socialError(e)}`); } finally { setUploading(u => u - 1); }
      }
    } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const move = (i: number, by: number) => setForm(f => {
    const media = [...f.media];
    const j = i + by;
    if (j < 0 || j >= media.length) return f;
    [media[i], media[j]] = [media[j], media[i]];
    return { ...f, media };
  });

  const save = async (): Promise<SocialDraft | null> => {
    const body: SocialDraftSave = { ...form, facebookCaption: split ? form.facebookCaption : null, instagramCaption: split ? form.instagramCaption : null, media: noMedia ? [] : form.media };
    const d = await socialService.saveDraft(draft?.draftId ?? null, body);
    setDraft(d);
    setListVersion(v => v + 1);
    if (!draft) navigate(`/social/compose/${d.draftId}`, { replace: true });
    return d;
  };
  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };
  const saveDraft = () => act('save', async () => { await save(); toast.success('Draft saved.'); });
  const submit = () => act('submit', async () => {
    if (problem) { toast.error(problem); return; }
    const d = await save();
    if (!d) return;
    if (d.status === 'AwaitingApproval') { toast.success('Saved. It is waiting for approval.'); return; }
    const r = await socialService.draftAction(d.draftId, 'submit');
    setDraft(r.data); setListVersion(v => v + 1);
    toast.success(r.message ?? 'Sent for approval.');
  });
  const approve = () => act('approve', async () => {
    if (problem) { toast.error(problem); return; }
    if (!checksDone) { toast.error('Tick the checks under “Before it goes out” first.'); return; }
    const d = await save();
    if (!d) return;
    const r = await socialService.draftAction(d.draftId, 'approve');
    setDraft(r.data); setListVersion(v => v + 1);
    toast.success(r.message ?? 'Approved.');
  });
  const simple = (action: 'cancel' | 'retry') => act(action, async () => {
    if (!draft) return;
    const r = await socialService.draftAction(draft.draftId, action);
    setDraft(r.data); setListVersion(v => v + 1);
    toast.success(r.message ?? 'Done.');
  });

  if (loadError) return <p className="hw-err wa-pad">{loadError}</p>;
  if (!can.compose && !draftId) {
    return (
      <div className="wa-pad">
        <p className="hw-muted">Writing posts needs “Write posts”. Ask an administrator.</p>
        {can.publish && <ApprovalList account={account} version={listVersion} onChange={() => setListVersion(v => v + 1)} />}
      </div>
    );
  }

  return (
    <div className="wa-pad">
      <div className="wa-row wa-between">
        <ol className="sc-steps" aria-label="Where this post is">
          {STEPS.map((s, i) => <li key={s.label} className={i === step ? 'on' : i < step ? 'done' : ''}>{i + 1} · {s.label}</li>)}
        </ol>
        {draft && <Link to="/social/compose" className="hw-btn">New post</Link>}
      </div>

      {draft?.sentBackNote && draft.status === 'SentBack' && <div className="wa-banner"><b>Sent back:</b> {draft.sentBackNote}</div>}
      {draft?.status === 'Failed' && <p className="wa-problem">Meta did not take it: {draft.error ?? 'no reason given'}.</p>}
      {draft && ['Scheduled', 'Publishing', 'Published'].includes(draft.status) && (
        <p className="hw-muted wa-small">
          <StatusTag status={draft.status} /> {draft.status === 'Published' ? `Went out ${when(draft.publishedAt)}.` : draft.scheduledAt ? `Goes out ${when(draft.scheduledAt)}.` : ''}
          {draft.approvedBy && ` Approved by ${draft.approvedBy}.`} {draft.status === 'Scheduled' && 'Changing it sends it back for approval.'}
        </p>
      )}

      <div className="wa-editor sc-compose">
        <fieldset className="wa-plain" disabled={!editable || !can.compose}>
          <fieldset className="wa-field">
            <legend>Post to</legend>
            <div className="sc-chips">
              <label className={`sc-chip-big${form.toFacebook ? ' on' : ''}${!account.pageId ? ' off' : ''}`}>
                <input type="checkbox" checked={form.toFacebook} disabled={!account.pageId} onChange={e => set('toFacebook', e.target.checked)} />
                <i className="sc-dot sc-fb" /> Facebook · {account.pageName ?? 'no Page chosen'}
              </label>
              <label className={`sc-chip-big${form.toInstagram ? ' on' : ''}${!account.igUserId ? ' off' : ''}`}>
                <input type="checkbox" checked={form.toInstagram} disabled={!account.igUserId} onChange={e => set('toInstagram', e.target.checked)} />
                <i className="sc-dot sc-ig" /> Instagram · {account.igUsername ? `@${account.igUsername}` : 'not linked'}
              </label>
            </div>
          </fieldset>

          <label className="wa-field"><span>Title (only in the CMS)</span><input value={form.title} maxLength={150} onChange={e => set('title', e.target.value)} placeholder="e.g. Health camp, December" /></label>

          <fieldset className="wa-field">
            <legend>Kind of post</legend>
            <div className="wa-pills">
              {KIND_CHOICES.map(k => (
                <button key={k} type="button" className={`wa-pill${form.kind === k ? ' on' : ''}`} aria-pressed={form.kind === k} onClick={() => set('kind', k)}
                  title={k === 'Story' ? 'Instagram only' : k === 'Text' || k === 'Link' ? 'Facebook only' : undefined}>{k}</button>
              ))}
            </div>
          </fieldset>

          {!noMedia && (
            <fieldset className="wa-field">
              <legend>Pictures or video</legend>
              <div className="sc-media">
                {form.media.map((m, i) => (
                  <MediaTile key={m.key} m={m} i={i} count={form.media.length} onMove={move} onRemove={() => set('media', form.media.filter(x => x.key !== m.key))} />
                ))}
                {uploading > 0 && <div className="sc-media-tile sc-ph">Uploading…</div>}
                <button type="button" className="sc-media-tile sc-add" onClick={() => fileRef.current?.click()}><ImagePlus size={18} /> Add</button>
                <input ref={fileRef} type="file" hidden multiple={form.kind === 'Carousel' || form.kind === 'Photo'} accept={form.kind === 'Video' || form.kind === 'Reel' ? 'video/mp4,video/quicktime' : form.kind === 'Story' ? 'image/*,video/mp4' : 'image/*'} onChange={e => add(e.target.files)} />
              </div>
              <p className="hw-muted wa-small">
                Instagram takes JPEG pictures; the CMS converts others. Up to {RULES.carouselMax} in a carousel. Crop: square or 4:5 for the feed, 9:16 for reels and stories. Pictures up to 8 MB, videos up to 300 MB.
              </p>
            </fieldset>
          )}

          <fieldset className="wa-field">
            <legend>
              Caption
              {form.toFacebook && form.toInstagram && (
                <label className="wa-check sc-inline"><input type="checkbox" checked={!split} onChange={e => setSplit(!e.target.checked)} /> Same text on both</label>
              )}
            </legend>
            {!split || !(form.toFacebook && form.toInstagram) ? (
              <textarea rows={6} value={form.caption ?? ''} onChange={e => set('caption', e.target.value)} aria-label="Caption" />
            ) : (
              <div className="wa-grid2">
                <label className="wa-field"><span>Facebook</span><textarea rows={6} value={form.facebookCaption ?? form.caption ?? ''} onChange={e => set('facebookCaption', e.target.value)} /></label>
                <label className="wa-field"><span>Instagram</span><textarea rows={6} value={form.instagramCaption ?? form.caption ?? ''} onChange={e => set('instagramCaption', e.target.value)} /></label>
              </div>
            )}
            {form.toInstagram && (
              <span className={`wa-small ${igCaption.length > RULES.instagramCaption || hashtags(igCaption) > RULES.hashtags ? 'hw-err' : 'hw-muted'}`}>
                Instagram: {igCaption.length.toLocaleString('en-IN')} of {RULES.instagramCaption.toLocaleString('en-IN')} characters · {hashtags(igCaption)} of {RULES.hashtags} hashtags
              </span>
            )}
          </fieldset>

          {form.toFacebook && (form.kind === 'Link' || form.kind === 'Text' || form.kind === 'Photo') && (
            <label className="wa-field"><span>Link (Facebook only{form.kind === 'Link' ? '' : ', optional'})</span><input type="url" value={form.link ?? ''} onChange={e => set('link', e.target.value)} placeholder="https://" /></label>
          )}

          <fieldset className="wa-field">
            <legend>When</legend>
            <div className="wa-pills">
              {WHEN.map(w => <button key={w.id} type="button" className={`wa-pill${form.whenMode === w.id ? ' on' : ''}`} aria-pressed={form.whenMode === w.id} onClick={() => set('whenMode', w.id)}>{w.label}</button>)}
            </div>
            {form.whenMode === 'schedule' && (
              <input type="datetime-local" aria-label="Date and time" value={toLocalInput(form.scheduledAt)} onChange={e => set('scheduledAt', fromLocalInput(e.target.value))} />
            )}
            {form.whenMode === 'queue' && <span className="hw-muted wa-small">Takes the next free queue slot for these channels when approved. <Link to="/social/calendar">See the slots</Link></span>}
            {form.toInstagram && limit && <span className="hw-muted wa-small">Instagram: {limit.used} of {limit.total} posts used in the last 24 hours.</span>}
          </fieldset>

          <fieldset className="wa-field">
            <legend>Before it goes out</legend>
            {[...REQUIRED_CHECKS, ...OPTIONAL_CHECKS].map(c => (
              <label key={c.key} className="wa-check">
                <input type="checkbox" checked={!!form.checklist[c.key]} onChange={e => set('checklist', { ...form.checklist, [c.key]: e.target.checked })} />
                {c.label}{REQUIRED_CHECKS.includes(c) ? '' : ' (if it applies)'}
              </label>
            ))}
            <span className="hw-muted wa-small">The approver must tick the first two.</span>
          </fieldset>

          <label className="wa-field">
            <span>Approver</span>
            <select value={form.approverUserId ?? ''} onChange={e => set('approverUserId', e.target.value || null)}>
              <option value="">Anyone who can approve</option>
              {approvers.map(a => <option key={a.userId} value={a.userId}>{a.fullName}</option>)}
            </select>
          </label>
        </fieldset>

        <div className="wa-editor-side">
          <div className="sc-seg" role="group" aria-label="Preview">
            {(['instagram', 'facebook'] as const).filter(c => (c === 'instagram' ? form.toInstagram : form.toFacebook)).map(c => (
              <button key={c} type="button" className={preview === c || !(preview === 'instagram' ? form.toInstagram : form.toFacebook) ? 'on' : ''} onClick={() => setPreview(c)}>{c === 'instagram' ? 'Instagram' : 'Facebook'}</button>
            ))}
          </div>
          <Preview form={form} account={account} channel={form.toInstagram && (preview === 'instagram' || !form.toFacebook) ? 'instagram' : 'facebook'} />
          {problem && <p className="wa-problem">{problem}</p>}
          {editable && can.compose && (
            <div className="sc-actions">
              <button type="button" className="hw-btn" onClick={saveDraft} disabled={!!busy || uploading > 0}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
              {draft?.status !== 'Scheduled' && <button type="button" className="hw-btn hw-btn-primary" onClick={submit} disabled={!!busy || uploading > 0}>{busy === 'submit' ? 'Sending…' : 'Send for approval'}</button>}
              {can.publish && <button type="button" className="hw-btn hw-btn-primary" onClick={approve} disabled={!!busy || uploading > 0}>{busy === 'approve' ? 'Approving…' : draft?.status === 'Scheduled' ? 'Save and approve again' : 'Approve now'}</button>}
            </div>
          )}
          {draft && (
            <div className="sc-actions">
              {draft.status === 'Failed' && can.publish && <button type="button" className="hw-btn" onClick={() => simple('retry')} disabled={!!busy}>Try again</button>}
              {EDITABLE.includes(draft.status) && <button type="button" className="hw-btn" onClick={() => simple('cancel')} disabled={!!busy}>Cancel this post</button>}
            </div>
          )}
        </div>
      </div>

      {can.publish && <ApprovalList account={account} version={listVersion} onChange={() => setListVersion(v => v + 1)} currentId={draft?.draftId} />}
      <MyDrafts account={account} version={listVersion} currentId={draft?.draftId} />
    </div>
  );
}

function MediaTile({ m, i, count, onMove, onRemove }: { m: SocialMediaRef; i: number; count: number; onMove: (i: number, by: number) => void; onRemove: () => void }) {
  return (
    <div className="sc-media-tile">
      <MediaThumb mediaKey={m.key} mime={m.mime} alt={m.name} className="sc-media-img" />
      <span className="sc-media-n">{i + 1}</span>
      <div className="sc-media-tools">
        {count > 1 && <button type="button" aria-label={`Move ${m.name} left`} onClick={() => onMove(i, -1)} disabled={i === 0}><ArrowLeft size={12} /></button>}
        {count > 1 && <button type="button" aria-label={`Move ${m.name} right`} onClick={() => onMove(i, 1)} disabled={i === count - 1}><ArrowRight size={12} /></button>}
        <button type="button" aria-label={`Remove ${m.name}`} onClick={onRemove}><X size={12} /></button>
      </div>
    </div>
  );
}

function Preview({ form, account, channel }: { form: SocialDraftSave; account: SocialAccount; channel: Channel }) {
  const text = captionFor(form, channel);
  const first = form.media[0];
  const at = form.whenMode === 'schedule' && form.scheduledAt ? when(form.scheduledAt) : 'Just now';
  if (channel === 'instagram') {
    const short = text.length > 125 ? text.slice(0, 125).trimEnd() + '…' : text;
    return (
      <div className="sc-pv sc-pv-ig" aria-label="Instagram preview">
        <div className="sc-pv-head"><i className="sc-pv-av sc-ig" /> <b>{account.igUsername ?? '[handle]'}</b></div>
        <div className={`sc-pv-media${form.kind === 'Reel' || form.kind === 'Story' ? ' tall' : ''}`}>
          {first ? <MediaThumb mediaKey={first.key} mime={first.mime} alt="" className="sc-pv-img" /> : <span>No picture yet</span>}
          {form.media.length > 1 && <span className="sc-pv-count">1 / {form.media.length}</span>}
        </div>
        {form.kind !== 'Story' && <p className="sc-pv-text"><b>{account.igUsername ?? '[handle]'}</b> {short}{text.length > 125 && <span className="hw-muted"> more</span>}</p>}
      </div>
    );
  }
  return (
    <div className="sc-pv sc-pv-fb" aria-label="Facebook preview">
      <div className="sc-pv-head"><i className="sc-pv-av sc-fb" /> <span><b>{account.pageName ?? '[Page name]'}</b><br /><span className="hw-muted wa-small">{at}</span></span></div>
      <p className="sc-pv-text">{text || <span className="hw-muted">No text yet</span>}</p>
      {first && (
        <div className="sc-pv-media">
          <MediaThumb mediaKey={first.key} mime={first.mime} alt="" className="sc-pv-img" />
          {form.media.length > 1 && <span className="sc-pv-count">+{form.media.length - 1}</span>}
        </div>
      )}
      {form.link && <div className="sc-pv-link">{form.link}</div>}
    </div>
  );
}

const channelsOf = (d: SocialDraft) => [d.toFacebook && 'Facebook', d.toInstagram && 'Instagram'].filter(Boolean).join(' + ');
const whenOf = (d: SocialDraft) => (d.whenMode === 'approved' ? 'when approved' : d.whenMode === 'queue' && d.status !== 'Scheduled' ? 'next queue slot' : when(d.scheduledAt));

function ApprovalList({ account, version, onChange, currentId }: { account: SocialAccount; version: number; onChange: () => void; currentId?: string }) {
  const [items, setItems] = useState<SocialDraft[] | null>(null);
  const [back, setBack] = useState<SocialDraft | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    socialService.drafts(account.accountId, 'AwaitingApproval').then(x => { if (live) setItems(x); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [account.accountId, version]);
  if (!items || items.length === 0) return null;

  const approve = async (d: SocialDraft) => {
    setBusy(d.draftId);
    try { const r = await socialService.draftAction(d.draftId, 'approve'); toast.success(r.message ?? 'Approved.'); onChange(); } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };
  const sendBack = async () => {
    if (!back || !note.trim()) return;
    setBusy(back.draftId);
    try { await socialService.sendBack(back.draftId, note.trim()); toast.success('Sent back with your note.'); setBack(null); setNote(''); onChange(); } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };

  return (
    <section className="wa-chart-card sc-approvals">
      <h3 className="wa-h3">Waiting for your approval ({items.length})</h3>
      {items.map(d => (
        <div key={d.draftId} className={`sc-approval${d.draftId === currentId ? ' on' : ''}`}>
          <div className="wa-grow">
            <Link to={`/social/compose/${d.draftId}`}><b>{d.title || d.caption?.slice(0, 60) || d.kind}</b></Link>
            <div className="hw-muted wa-small">{channelsOf(d)} · {d.kind} · {whenOf(d)} · by {d.createdBy ?? 'someone'}{d.approverName ? ` · for ${d.approverName}` : ''}</div>
            {!(d.checklist?.noTestimonials && d.checklist?.factsBackedUp) && <div className="wa-small sc-warn">Checks not ticked yet: open it to tick them.</div>}
          </div>
          <button type="button" className="hw-btn hw-btn-primary" disabled={busy === d.draftId} onClick={() => approve(d)}>Approve</button>
          <button type="button" className="hw-btn" disabled={busy === d.draftId} onClick={() => setBack(d)}>Send back with a note</button>
        </div>
      ))}
      {back && (
        <Modal title="Send back with a note" onClose={() => setBack(null)}>
          <p className="hw-muted wa-small">{back.title || back.caption?.slice(0, 80)}</p>
          <label className="wa-field"><span>What to change</span><textarea rows={4} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={sendBack} disabled={!note.trim() || busy === back.draftId}>Send back</button></div>
        </Modal>
      )}
    </section>
  );
}

function MyDrafts({ account, version, currentId }: { account: SocialAccount; version: number; currentId?: string }) {
  const [items, setItems] = useState<SocialDraft[] | null>(null);
  useEffect(() => {
    let live = true;
    socialService.drafts(account.accountId, 'open').then(x => { if (live) setItems(x.filter(d => d.status !== 'AwaitingApproval')); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [account.accountId, version]);
  if (!items || items.length === 0) return null;
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">Posts in progress</h3>
      <table className="wa-mini">
        <thead><tr><th>Post</th><th>Channels</th><th>When</th><th>State</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.draftId} className={d.draftId === currentId ? 'sc-row-on' : ''}>
              <td><Link to={`/social/compose/${d.draftId}`}>{d.title || d.caption?.slice(0, 60) || d.kind}</Link></td>
              <td>{channelsOf(d)}</td>
              <td>{whenOf(d)}</td>
              <td><StatusTag status={d.status} />{d.status === 'Failed' && d.error && <div className="wa-small hw-err">{d.error}</div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
