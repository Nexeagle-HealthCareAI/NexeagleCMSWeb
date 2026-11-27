import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Pause, Play, Plus, ShieldCheck, Square, Users } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { WaBroadcast, WaBroadcastPreview, WaBroadcastRequest, WaRecipient, WaTemplate, WaVariableValue } from '../types';
import { BROADCAST_LABEL, isMediaHeader, keyLabel, money, requiredKeys, when } from '../waUtils';
import TemplatePreview from './TemplatePreview';

// Broadcasts: one approved template to many opted-in contacts, with the cost known before sending.
// Over this month's budget, it waits for someone who may approve WhatsApp spending.

const SOURCES = [
  { id: 'Lead', label: 'Hospital & doctor leads' },
  { id: 'DoctorDekho', label: 'Doctor Dekho patients' },
  { id: 'Import', label: 'Imported lists' },
  { id: 'Inbound', label: 'People who wrote to us' },
  { id: 'Manual', label: 'Added by hand' },
];

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '–');

export default function BroadcastsTab({ can }: { can: WaCan }) {
  const [list, setList] = useState<WaBroadcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => waService.broadcasts().then(l => { setList(l); setError(null); }).catch(e => setError(waError(e)));
  useEffect(() => {
    void load();
    // Sending broadcasts change every second; the list follows every 10.
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10_000);
    return () => clearInterval(t);
  }, []);

  const act = async (b: WaBroadcast, action: 'approve' | 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !window.confirm(`Stop “${b.name}”? People not reached yet will not get it.`)) return;
    try {
      await waService.broadcastAction(b.broadcastId, action);
      toast.success(action === 'approve' ? 'Approved: it will send' : action === 'pause' ? 'Paused' : action === 'resume' ? 'Sending again' : 'Stopped');
      void load();
    } catch (e) { toast.error(waError(e)); }
  };

  if (composing) return <Composer onClose={() => setComposing(false)} onCreated={() => { setComposing(false); void load(); }} />;
  if (openId) return <BroadcastDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <div className="hw-bar wa-bar">
        <span className="hw-muted">Only contacts who opted in receive broadcasts.</span>
        <span className="wa-grow" />
        {can.broadcast && <button type="button" className="hw-btn hw-btn-primary" onClick={() => setComposing(true)}><Plus size={14} /> New broadcast</button>}
      </div>
      {error && <p className="hw-err wa-pad">{error}</p>}
      {list == null && !error && <p className="hw-muted wa-pad">Loading…</p>}
      {list?.length === 0 && <div className="hw-empty"><b>No broadcasts yet</b><span>Send an approved template to a group of contacts.</span></div>}
      {list && list.length > 0 && (
        <div className="hw-tbl">
          <table>
            <thead>
              <tr><th>Broadcast</th><th>Status</th><th>Recipients</th><th>Delivered</th><th>Read</th><th>Replied</th><th>Failed</th><th>Cost</th><th /></tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b.broadcastId} onClick={() => setOpenId(b.broadcastId)}>
                  <td>
                    <div className="hw-title">{b.name}</div>
                    <div className="hw-muted wa-small">{b.templateName} · {when(b.startedAt ?? b.scheduledAt)}{b.createdBy ? ` · by ${b.createdBy}` : ''}</div>
                  </td>
                  <td>
                    <span className={`wa-st wa-b-${b.status.toLowerCase()}`}>{BROADCAST_LABEL[b.status] ?? b.status}</span>
                    {b.pausedReason && <div className="wa-small hw-muted">{b.pausedReason}</div>}
                  </td>
                  <td>{b.recipients}{b.status === 'Sending' ? <div className="wa-small hw-muted">{b.pending} to go</div> : null}</td>
                  <td>{b.delivered} <span className="hw-muted wa-small">{pct(b.delivered, b.sent)}</span></td>
                  <td>{b.read} <span className="hw-muted wa-small">{pct(b.read, b.delivered)}</span></td>
                  <td>{b.replied}</td>
                  <td>{b.failed}</td>
                  <td>{money(b.actualCost, b.currency)}<div className="wa-small hw-muted">est. {money(b.estimatedCost, b.currency)}</div></td>
                  <td onClick={e => e.stopPropagation()} className="wa-actions">
                    {b.status === 'AwaitingApproval' && can.approve && <button type="button" className="hw-btn hw-btn-primary" onClick={() => act(b, 'approve')}><ShieldCheck size={14} /> Approve</button>}
                    {b.status === 'Paused' && b.pausedReason?.startsWith('Budget') && can.approve && <button type="button" className="hw-btn" onClick={() => act(b, 'approve')}><ShieldCheck size={14} /> Approve spend</button>}
                    {can.broadcast && (b.status === 'Scheduled' || b.status === 'Sending') && <button type="button" className="hw-btn" onClick={() => act(b, 'pause')} aria-label="Pause"><Pause size={14} /></button>}
                    {can.broadcast && b.status === 'Paused' && !b.pausedReason?.startsWith('Budget') && <button type="button" className="hw-btn" onClick={() => act(b, 'resume')} aria-label="Resume"><Play size={14} /></button>}
                    {can.broadcast && ['AwaitingApproval', 'Scheduled', 'Sending', 'Paused'].includes(b.status) && <button type="button" className="hw-btn" onClick={() => act(b, 'cancel')} aria-label="Stop"><Square size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BroadcastDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [b, setB] = useState<WaBroadcast | null>(null);
  const [rows, setRows] = useState<WaRecipient[] | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => { waService.broadcast(id).then(setB).catch(e => toast.error(waError(e))); }, [id]);
  useEffect(() => { waService.recipients(id, status || undefined).then(setRows).catch(e => toast.error(waError(e))); }, [id, status]);

  return (
    <div className="wa-pad">
      <button type="button" className="hw-btn" onClick={onBack}><ArrowLeft size={14} /> Broadcasts</button>
      {b && (
        <>
          <h2 className="wa-h2">{b.name}</h2>
          <p className="hw-muted">{b.templateName} · {BROADCAST_LABEL[b.status]} · {when(b.startedAt ?? b.scheduledAt)}{b.approvedBy ? ` · spend approved by ${b.approvedBy}` : ''}</p>
          <div className="wa-tiles">
            {[['Recipients', b.recipients], ['Sent', b.sent], ['Delivered', b.delivered], ['Read', b.read], ['Replied', b.replied], ['Failed', b.failed]].map(([k, v]) => (
              <div key={k} className="wa-tile"><span>{k}</span><b>{v}</b></div>
            ))}
            <div className="wa-tile"><span>Cost</span><b>{money(b.actualCost, b.currency)}</b><small className="hw-muted">estimate {money(b.estimatedCost, b.currency)}</small></div>
          </div>
        </>
      )}
      <div className="hw-bar wa-bar">
        <select value={status} onChange={e => { setRows(null); setStatus(e.target.value); }} aria-label="Recipient status">
          <option value="">Everyone</option>
          {['Pending', 'Sent', 'Delivered', 'Read', 'Replied', 'Failed', 'Skipped'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {rows == null ? <p className="hw-muted">Loading…</p> : rows.length === 0 ? <p className="hw-muted">Nobody here.</p> : (
        <div className="hw-tbl">
          <table>
            <thead><tr><th>Name</th><th>Number</th><th>Status</th><th>Why</th><th>Sent</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.contactId} className="hw-static"><td>{r.name || '—'}</td><td>{r.displayPhone}</td><td>{r.status}</td><td className="wa-small">{r.error}</td><td className="wa-small">{when(r.sentAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Composer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [r, setR] = useState<WaBroadcastRequest>({ name: '', templateId: '', variables: {}, audience: { tags: [], sources: [], contactIds: [] }, scheduledAt: null });
  const [later, setLater] = useState(false);
  const [preview, setPreview] = useState<WaBroadcastPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    waService.templates().then(l => setTemplates(l.filter(t => t.status === 'APPROVED'))).catch(e => toast.error(waError(e)));
    waService.contacts({ pageSize: 1 }).then(p => setAllTags(p.allTags)).catch(() => setAllTags([]));
  }, []);

  const t = templates?.find(x => x.templateId === r.templateId);
  const keys = useMemo(() => (t ? requiredKeys(t) : []), [t]);
  const set = (p: Partial<WaBroadcastRequest>) => { setR(cur => ({ ...cur, ...p })); setPreview(null); };
  const setVar = (k: string, v: WaVariableValue) => set({ variables: { ...r.variables, [k]: v } });
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter(y => y !== x) : [...list, x]);

  const pickTemplate = (id: string) => {
    const chosen = templates?.find(x => x.templateId === id);
    const vars: Record<string, WaVariableValue> = {};
    if (chosen) for (const k of requiredKeys(chosen)) vars[k] = k === chosen.bodyVariables[0] ? { from: 'name', text: 'there' } : { from: 'text', text: '' };
    set({ templateId: id, variables: vars, headerMediaUrl: undefined });
  };

  const missing = keys.find(k => {
    const v = r.variables[k];
    return !v || (v.from === 'text' && !v.text?.trim()) || (v.from === 'attribute' && !v.attribute?.trim());
  });
  const needsLink = !!t && isMediaHeader(t.headerFormat) && !t.hasSampleMedia && !r.headerMediaUrl?.trim();
  const ready = !!t && !missing && !needsLink && r.name.trim().length > 0 && (!later || !!r.scheduledAt);

  const request = (): WaBroadcastRequest => ({ ...r, name: r.name.trim(), scheduledAt: later && r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null, headerMediaUrl: r.headerMediaUrl?.trim() || undefined });

  const check = async () => {
    setBusy(true);
    try { setPreview(await waService.preview(request())); setPreviewError(null); } catch (e) { setPreviewError(waError(e)); } finally { setBusy(false); }
  };

  const create = async () => {
    setBusy(true);
    try {
      const b = await waService.createBroadcast(request());
      toast.success(b.status === 'AwaitingApproval' ? 'Saved: it passes this month\'s budget, so it waits for approval' : later ? 'Scheduled' : 'Sending now');
      onCreated();
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="wa-editor">
      <div className="wa-editor-form">
        <div className="wa-row wa-between">
          <h2 className="wa-h2">New broadcast</h2>
          <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
        </div>
        <label className="wa-field">
          <span>Name (only your team sees it)</span>
          <input type="text" value={r.name} maxLength={150} placeholder="December health camp · Pune hospitals" onChange={e => set({ name: e.target.value })} />
        </label>
        <label className="wa-field">
          <span>Approved template</span>
          <select value={r.templateId} onChange={e => pickTemplate(e.target.value)} aria-label="Template">
            <option value="">{templates == null ? 'Loading…' : templates.length ? 'Choose a template' : 'No approved templates yet: write one in Templates'}</option>
            {templates?.map(x => <option key={x.templateId} value={x.templateId}>{x.name} · {x.language} · {x.category.toLowerCase()}</option>)}
          </select>
        </label>

        {keys.length > 0 && (
          <fieldset className="wa-field">
            <legend>Fill the variables for each person</legend>
            {keys.map(k => {
              const v = r.variables[k] ?? { from: 'text' };
              return (
                <div key={k} className="wa-var">
                  <span className="wa-var-key">{keyLabel(k)}</span>
                  <select value={v.from} onChange={e => setVar(k, { ...v, from: e.target.value as WaVariableValue['from'] })} aria-label={`${keyLabel(k)} from`}>
                    <option value="name">Their first name</option>
                    <option value="phone">Their number</option>
                    <option value="attribute">A detail from the contact</option>
                    <option value="text">The same text for everyone</option>
                  </select>
                  {v.from === 'attribute' && <input type="text" placeholder="detail, e.g. city" value={v.attribute ?? ''} onChange={e => setVar(k, { ...v, attribute: e.target.value })} aria-label="Detail" />}
                  <input type="text" placeholder={v.from === 'text' ? 'Text' : 'If missing, use…'} value={v.text ?? ''} onChange={e => setVar(k, { ...v, text: e.target.value })} aria-label={v.from === 'text' ? 'Text' : 'Fallback'} />
                </div>
              );
            })}
          </fieldset>
        )}
        {t && isMediaHeader(t.headerFormat) && (
          <label className="wa-field">
            <span>Header {t.headerFormat.toLowerCase()} {t.hasSampleMedia ? '(optional: the template\'s sample is sent)' : ''}</span>
            <input type="text" placeholder="https://… link to the file" value={r.headerMediaUrl ?? ''} onChange={e => set({ headerMediaUrl: e.target.value })} />
          </label>
        )}

        <fieldset className="wa-field">
          <legend><Users size={14} /> Who gets it</legend>
          <div className="wa-checks">
            {SOURCES.map(s => (
              <label key={s.id} className="wa-check"><input type="checkbox" checked={r.audience.sources.includes(s.id)} onChange={() => set({ audience: { ...r.audience, sources: toggle(r.audience.sources, s.id) } })} /> {s.label}</label>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="wa-checks">
              <span className="hw-muted wa-small">With any of these tags:</span>
              {allTags.map(tag => (
                <label key={tag} className="wa-check wa-tagcheck"><input type="checkbox" checked={r.audience.tags.includes(tag)} onChange={() => set({ audience: { ...r.audience, tags: toggle(r.audience.tags, tag) } })} /> {tag}</label>
              ))}
            </div>
          )}
          <small className="hw-muted">Nothing ticked: every contact. Either way, only people who opted in receive it.</small>
        </fieldset>

        <fieldset className="wa-field">
          <legend>When</legend>
          <label className="wa-radio"><input type="radio" checked={!later} onChange={() => { setLater(false); set({ scheduledAt: null }); }} /> Now</label>
          <label className="wa-radio"><input type="radio" checked={later} onChange={() => setLater(true)} /> Later</label>
          {later && <input type="datetime-local" value={r.scheduledAt ?? ''} onChange={e => set({ scheduledAt: e.target.value })} aria-label="Send at" />}
        </fieldset>

        {preview && (
          <div className={`wa-estimate${preview.overBudget ? ' over' : ''}`} role="status">
            <div><b>{preview.willSend}</b> of {preview.matched} will get it{preview.notOptedIn ? ` · ${preview.notOptedIn} not asked yet` : ''}{preview.optedOut ? ` · ${preview.optedOut} opted out` : ''}</div>
            <div>Estimated cost <b>{money(preview.estimatedCost, preview.currency)}</b> <span className="hw-muted wa-small">(charged only when delivered; GST extra)</span></div>
            <div className="wa-small">
              This month: {money(preview.spentThisMonth, preview.currency)} spent{preview.committed ? ` + ${money(preview.committed, preview.currency)} already planned` : ''}
              {preview.monthlyBudget ? ` of ${money(preview.monthlyBudget, preview.currency)}` : ' (no budget set)'}
            </div>
            {preview.overBudget && <div className="wa-small"><b>Over the monthly budget:</b> it will wait for someone who may approve WhatsApp spending.</div>}
          </div>
        )}
        {previewError && <p className="wa-problem">{previewError}</p>}
        <div className="wa-row">
          <button type="button" className="hw-btn" disabled={!ready || busy} onClick={check}>Check audience and cost</button>
          <button type="button" className="hw-btn hw-btn-primary" disabled={!ready || busy || !preview || preview.willSend === 0} onClick={create}>
            {preview?.overBudget ? 'Save for approval' : later ? 'Schedule' : 'Send now'}
          </button>
        </div>
        {!preview && ready && <small className="hw-muted">Check the audience and cost first.</small>}
      </div>
      <div className="wa-editor-side">
        {t ? (
          <>
            <div className="hw-muted wa-small">The template</div>
            <TemplatePreview headerFormat={t.headerFormat} headerText={t.headerText} body={t.body} footer={t.footer} buttons={t.buttons} />
            {preview && preview.samples.length > 0 && (
              <>
                <div className="hw-muted wa-small">What the first people will read</div>
                <div className="wa-phone">
                  {preview.samples.map((text, i) => <div key={i} className="wa-bubble wa-out"><div className="wa-b-text">{text}</div></div>)}
                </div>
              </>
            )}
          </>
        ) : <p className="hw-muted wa-small">Choose a template to see it.</p>}
      </div>
    </div>
  );
}
