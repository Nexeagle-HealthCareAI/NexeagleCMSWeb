import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { ButtonType, HeaderFormat, WaButton, WaSaveTemplate, WaTemplate } from '../types';
import { LIMITS, STATUS_LABEL, checkTemplate, fill, isMediaHeader, variablesIn, when } from '../waUtils';
import TemplatePreview from './TemplatePreview';

// Templates: the only messages WhatsApp lets a business start a chat with. Written here, checked by
// Meta (minutes to a day), then usable in broadcasts and in the inbox after the 24-hour window.

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'en_US', label: 'English (US)' }, { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi' }, { code: 'bn', label: 'Bengali' }, { code: 'mr', label: 'Marathi' }, { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' }, { code: 'gu', label: 'Gujarati' }, { code: 'kn', label: 'Kannada' }, { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' }, { code: 'ur', label: 'Urdu' },
];

const statusClass = (s: string) =>
  s === 'APPROVED' ? 'wa-st-ok' : s === 'REJECTED' || s === 'DISABLED' ? 'wa-st-bad' : s === 'PAUSED' ? 'wa-st-warn' : 'wa-st-wait';

/** Meta's rejection codes in plain words. */
const REJECTION: Record<string, string> = {
  INVALID_FORMAT: 'The format is not allowed (for example variables at the start or end, or too many in a row).',
  ABUSIVE_CONTENT: 'Meta found the content abusive or misleading.',
  INCORRECT_CATEGORY: 'The category does not fit the content (for example an offer sent as utility).',
  TAG_CONTENT_MISMATCH: 'The content does not fit the category.',
  PROMOTIONAL: 'Promotional content in a non-marketing template.',
  SCAM: 'Meta judged it possibly misleading.',
  NONE: 'Meta gave no reason.',
};

export default function TemplatesTab({ can }: { can: WaCan }) {
  const [list, setList] = useState<WaTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async (refresh = false) => {
    setRefreshing(refresh);
    try {
      setList(await waService.templates(refresh));
      setError(null);
    } catch (e) {
      setError(waError(e));
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => { void load(true); }, []);

  const remove = async (t: WaTemplate) => {
    if (!window.confirm(`Delete “${t.name}” at Meta too? Its name cannot be used again for 30 days.`)) return;
    try {
      await waService.deleteTemplate(t.templateId);
      toast.success('Template deleted');
      void load();
    } catch (e) { toast.error(waError(e)); }
  };

  const shown = (list ?? []).filter(t => !filter || t.status === filter);

  if (creating) return <TemplateEditor onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load(); }} />;

  return (
    <div>
      <div className="hw-bar wa-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button type="button" className="hw-btn" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={14} /> {refreshing ? 'Checking Meta…' : 'Check status at Meta'}</button>
        <span className="wa-grow" />
        {can.templates && <button type="button" className="hw-btn hw-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>}
      </div>
      {error && <p className="hw-err wa-pad">{error}</p>}
      {list == null && !error && <p className="hw-muted wa-pad">Loading…</p>}
      {list?.length === 0 && <div className="hw-empty"><b>No templates yet</b><span>Write one and send it to Meta for approval; approval takes minutes to a day.</span></div>}
      <div className="wa-tpl-grid">
        {shown.map(t => (
          <article key={t.templateId} className="wa-tpl">
            <header>
              <b>{t.name}</b>
              <span className={`wa-st ${statusClass(t.status)}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
            </header>
            <div className="hw-muted wa-small">{t.language} · {t.category.toLowerCase()} · updated {when(t.updatedAt)}{t.qualityScore && t.qualityScore !== 'UNKNOWN' ? ` · quality ${t.qualityScore.toLowerCase()}` : ''}</div>
            {t.status === 'REJECTED' && <p className="wa-reject">Rejected: {REJECTION[t.rejectedReason ?? ''] ?? t.rejectedReason ?? 'no reason given'}</p>}
            <TemplatePreview headerFormat={t.headerFormat} headerText={t.headerText} body={t.body} footer={t.footer} buttons={t.buttons} />
            {can.templates && t.status !== 'DELETED' && (
              <div className="wa-row"><button type="button" className="hw-btn" onClick={() => remove(t)}><Trash2 size={14} /> Delete</button></div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const EMPTY: WaSaveTemplate = { name: '', language: 'en', category: 'MARKETING', headerFormat: 'NONE', headerText: '', headerExample: '', body: '', bodyExamples: {}, footer: '', buttons: [] };

function TemplateEditor({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [t, setT] = useState<WaSaveTemplate>(EMPTY);
  const [sample, setSample] = useState<File | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<WaSaveTemplate>) => setT(cur => ({ ...cur, ...p }));

  const bodyVars = useMemo(() => variablesIn(t.body), [t.body]);
  const headerVars = useMemo(() => (t.headerFormat === 'TEXT' ? variablesIn(t.headerText) : []), [t.headerFormat, t.headerText]);
  const problem = checkTemplate(t, sample);

  useEffect(() => {
    if (!sample || !sample.type.startsWith('image/')) { setSampleUrl(null); return; }
    const u = URL.createObjectURL(sample);
    setSampleUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sample]);

  const addVariable = () => set({ body: `${t.body}${t.body && !t.body.endsWith(' ') ? ' ' : ''}{{${bodyVars.filter(v => /^\d+$/.test(v)).length + 1}}}` });
  const setButton = (i: number, p: Partial<WaButton>) => set({ buttons: t.buttons.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const addButton = (type: ButtonType) => set({ buttons: [...t.buttons, { type, text: '' }] });

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const clean: WaSaveTemplate = {
        ...t,
        headerText: t.headerFormat === 'TEXT' ? t.headerText : undefined,
        headerExample: headerVars.length ? t.headerExample : undefined,
        bodyExamples: Object.fromEntries(bodyVars.map(v => [v, t.bodyExamples[v] ?? ''])),
        footer: t.footer?.trim() || undefined,
      };
      const saved = await waService.createTemplate(clean, isMediaHeader(t.headerFormat) ? sample : null);
      toast.success(saved.status === 'APPROVED' ? 'Template approved' : 'Sent to Meta for approval');
      onCreated();
    } catch (e) {
      toast.error(waError(e));
    } finally {
      setBusy(false);
    }
  };

  const examples = Object.fromEntries([...bodyVars.map(v => [v, t.bodyExamples[v] ?? '']), ...headerVars.map(v => [`h.${v}`, t.headerExample ?? ''])]);

  return (
    <div className="wa-editor">
      <div className="wa-editor-form">
        <div className="wa-row wa-between">
          <h2 className="wa-h2">New template</h2>
          <button type="button" className="hw-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="wa-grid2">
          <label className="wa-field">
            <span>Name</span>
            <input type="text" value={t.name} placeholder="camp_invite_dec" onChange={e => set({ name: e.target.value.toLowerCase().replace(/[\s-]+/g, '_') })} />
            <small className="hw-muted">Lower case, digits and _. People never see it.</small>
          </label>
          <label className="wa-field">
            <span>Language</span>
            <select value={t.language} onChange={e => set({ language: e.target.value })}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="wa-field">
          <legend>Category</legend>
          <label className="wa-radio"><input type="radio" checked={t.category === 'MARKETING'} onChange={() => set({ category: 'MARKETING' })} /> Marketing <small className="hw-muted">offers, camps, news, invitations</small></label>
          <label className="wa-radio"><input type="radio" checked={t.category === 'UTILITY'} onChange={() => set({ category: 'UTILITY' })} /> Utility <small className="hw-muted">about something the person asked for: a booking, an order, a reminder</small></label>
          <small className="hw-muted">Meta can move a template to marketing if it reads like one. One-time passwords are not sent from here.</small>
        </fieldset>

        <label className="wa-field">
          <span>Header (optional)</span>
          <select value={t.headerFormat} onChange={e => { set({ headerFormat: e.target.value as HeaderFormat }); setSample(null); }}>
            <option value="NONE">None</option>
            <option value="TEXT">Text</option>
            <option value="IMAGE">Picture</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">Document (PDF)</option>
          </select>
        </label>
        {t.headerFormat === 'TEXT' && (
          <div className="wa-grid2">
            <label className="wa-field">
              <span>Header text <small className="hw-muted">{t.headerText?.length ?? 0}/{LIMITS.headerText}</small></span>
              <input type="text" value={t.headerText ?? ''} maxLength={LIMITS.headerText} onChange={e => set({ headerText: e.target.value })} />
            </label>
            {headerVars.length > 0 && (
              <label className="wa-field"><span>Example for {`{{${headerVars[0]}}}`}</span><input type="text" value={t.headerExample ?? ''} onChange={e => set({ headerExample: e.target.value })} /></label>
            )}
          </div>
        )}
        {isMediaHeader(t.headerFormat) && (
          <label className="wa-field">
            <span>Sample {t.headerFormat === 'IMAGE' ? 'picture (JPG or PNG, up to 5 MB)' : t.headerFormat === 'VIDEO' ? 'video (MP4, up to 16 MB)' : 'document (PDF, up to 100 MB)'}</span>
            <input
              type="file"
              accept={t.headerFormat === 'IMAGE' ? 'image/jpeg,image/png' : t.headerFormat === 'VIDEO' ? 'video/mp4' : 'application/pdf'}
              onChange={e => setSample(e.target.files?.[0] ?? null)}
            />
            <small className="hw-muted">Meta checks the template with it. Broadcasts send it too, unless a link to another one is given.</small>
          </label>
        )}

        <label className="wa-field">
          <span>Message <small className="hw-muted">{t.body.length}/{LIMITS.body}</small></span>
          <textarea rows={6} value={t.body} maxLength={LIMITS.body} onChange={e => set({ body: e.target.value })}
            placeholder="Hello {{1}}, our free health camp is on {{2}}. Reply YES to book a slot." />
        </label>
        <div className="wa-row">
          <button type="button" className="hw-btn" onClick={addVariable}><Plus size={13} /> Add a variable</button>
          <small className="hw-muted">*bold*, _italic_, ~strike~ work as on WhatsApp.</small>
        </div>
        {bodyVars.length > 0 && (
          <div className="wa-grid2">
            {bodyVars.map(v => (
              <label key={v} className="wa-field">
                <span>Example for {`{{${v}}}`}</span>
                <input type="text" value={t.bodyExamples[v] ?? ''} onChange={e => set({ bodyExamples: { ...t.bodyExamples, [v]: e.target.value } })} />
              </label>
            ))}
          </div>
        )}

        <label className="wa-field">
          <span>Footer (optional) <small className="hw-muted">{t.footer?.length ?? 0}/{LIMITS.footer}</small></span>
          <input type="text" value={t.footer ?? ''} maxLength={LIMITS.footer} placeholder="Reply STOP to stop these messages" onChange={e => set({ footer: e.target.value })} />
        </label>

        <div className="wa-field">
          <span>Buttons (optional)</span>
          {t.buttons.map((b, i) => (
            <div key={i} className="wa-btn-row">
              <span className="wa-btn-kind">{b.type === 'QUICK_REPLY' ? 'Quick reply' : b.type === 'URL' ? 'Link' : b.type === 'PHONE_NUMBER' ? 'Call' : 'Copy code'}</span>
              {b.type !== 'COPY_CODE' && <input type="text" placeholder="Button text" maxLength={LIMITS.buttonText} value={b.text ?? ''} onChange={e => setButton(i, { text: e.target.value })} aria-label="Button text" />}
              {b.type === 'URL' && <input type="text" placeholder="https://nexeagle.com/camp or …/{{1}}" value={b.url ?? ''} onChange={e => setButton(i, { url: e.target.value })} aria-label="Link" />}
              {b.type === 'URL' && variablesIn(b.url).length > 0 && <input type="text" placeholder="Example ending" value={b.urlExample ?? ''} onChange={e => setButton(i, { urlExample: e.target.value })} aria-label="Link example" />}
              {b.type === 'PHONE_NUMBER' && <input type="text" placeholder="+91 …" value={b.phone ?? ''} onChange={e => setButton(i, { phone: e.target.value })} aria-label="Phone number" />}
              {b.type === 'COPY_CODE' && <input type="text" placeholder="Example code, e.g. CAMP50" value={b.example ?? ''} onChange={e => setButton(i, { example: e.target.value })} aria-label="Example code" />}
              <button type="button" className="hw-btn" onClick={() => set({ buttons: t.buttons.filter((_, j) => j !== i) })} aria-label="Remove button"><X size={13} /></button>
            </div>
          ))}
          {t.buttons.length < LIMITS.buttons && (
            <div className="wa-row">
              <button type="button" className="hw-btn" onClick={() => addButton('QUICK_REPLY')}>+ Quick reply</button>
              <button type="button" className="hw-btn" onClick={() => addButton('URL')} disabled={t.buttons.filter(b => b.type === 'URL').length >= LIMITS.urlButtons}>+ Link</button>
              <button type="button" className="hw-btn" onClick={() => addButton('PHONE_NUMBER')} disabled={t.buttons.some(b => b.type === 'PHONE_NUMBER')}>+ Call</button>
              <button type="button" className="hw-btn" onClick={() => addButton('COPY_CODE')} disabled={t.buttons.some(b => b.type === 'COPY_CODE')}>+ Copy code</button>
            </div>
          )}
          {t.category === 'MARKETING' && !t.buttons.some(b => b.type === 'QUICK_REPLY' && /stop/i.test(b.text ?? '')) && !/stop/i.test(t.footer ?? '') && (
            <small className="hw-muted">Tip: a “Stop promotions” quick reply or a footer saying how to stop lowers blocks and keeps the number's quality up.</small>
          )}
        </div>

        {problem && <p className="wa-problem" role="status">{problem}</p>}
        <div className="wa-row">
          <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="hw-btn hw-btn-primary" disabled={!!problem || busy} onClick={submit}>{busy ? 'Sending to Meta…' : 'Send for approval'}</button>
        </div>
      </div>
      <div className="wa-editor-side">
        <div className="hw-muted wa-small">Preview with the examples</div>
        <TemplatePreview
          headerFormat={t.headerFormat}
          headerText={fill(t.headerText, examples, 'h.')}
          sampleUrl={sampleUrl}
          body={fill(t.body, examples)}
          footer={t.footer}
          buttons={t.buttons}
        />
      </div>
    </div>
  );
}
