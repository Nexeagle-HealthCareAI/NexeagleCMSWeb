import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { waService, waError } from '../services/waService';
import type { WaContact, WaTemplate } from '../types';
import { fill, isMediaHeader, keyLabel, requiredKeys } from '../waUtils';
import TemplatePreview from './TemplatePreview';

// Sends one approved template to one person (from the inbox, e.g. after the 24-hour window closed).
export default function TemplateSendForm({ contact, onSent, onCancel }: { contact: WaContact; onSent: () => void; onCancel: () => void }) {
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    waService.templates().then(list => setTemplates(list.filter(t => t.status === 'APPROVED'))).catch(e => toast.error(waError(e)));
  }, []);

  const t = templates?.find(x => x.templateId === templateId);
  const keys = useMemo(() => (t ? requiredKeys(t) : []), [t]);
  const firstName = (contact.name || contact.profileName || '').split(' ')[0];

  const pick = (id: string) => {
    setTemplateId(id);
    const chosen = templates?.find(x => x.templateId === id);
    // The first body variable is usually the name: start it filled in.
    setValues(chosen?.bodyVariables[0] && firstName ? { [chosen.bodyVariables[0]]: firstName } : {});
    setLink('');
  };

  const missing = keys.find(k => !values[k]?.trim());
  const needsLink = !!t && isMediaHeader(t.headerFormat) && !t.hasSampleMedia;

  const send = async () => {
    if (!t) return;
    setBusy(true);
    try {
      await waService.sendTemplate(contact.contactId, { templateId: t.templateId, values, headerMediaUrl: link.trim() || undefined });
      toast.success('Template sent');
      onSent();
    } catch (e) {
      toast.error(waError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wa-tsend">
      <div className="wa-tsend-form">
        <label className="wa-field">
          <span>Approved template</span>
          <select value={templateId} onChange={e => pick(e.target.value)} aria-label="Template">
            <option value="">{templates == null ? 'Loading…' : templates.length ? 'Choose a template' : 'No approved templates yet'}</option>
            {templates?.map(x => <option key={x.templateId} value={x.templateId}>{x.name} · {x.language} · {x.category.toLowerCase()}</option>)}
          </select>
        </label>
        {keys.map(k => (
          <label key={k} className="wa-field">
            <span>{keyLabel(k)}</span>
            <input type="text" value={values[k] ?? ''} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} />
          </label>
        ))}
        {t && isMediaHeader(t.headerFormat) && (
          <label className="wa-field">
            <span>{t.headerFormat.toLowerCase()} link {t.hasSampleMedia ? '(optional: the template\'s sample is used)' : ''}</span>
            <input type="text" placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} />
          </label>
        )}
        <div className="wa-row">
          <button type="button" className="hw-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="hw-btn hw-btn-primary" disabled={!t || !!missing || busy || (needsLink && !link.trim())} onClick={send}>
            {busy ? 'Sending…' : 'Send template'}
          </button>
        </div>
        {t?.category === 'MARKETING' && <p className="hw-muted wa-small">Marketing templates are charged by Meta when delivered.</p>}
      </div>
      {t && (
        <TemplatePreview
          headerFormat={t.headerFormat}
          headerText={fill(t.headerText, values, 'h.')}
          body={fill(t.body, values)}
          footer={t.footer}
          buttons={t.buttons}
        />
      )}
    </div>
  );
}
