import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Plus, Upload, X } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { OptIn, WaContact, WaContactPage, WaContactQuery, WaImportResult, WaSaveContact } from '../types';
import { OPTIN_LABEL, csvToContacts, when, type CsvImport } from '../waUtils';

// Everyone the marketing number may message, and whether they agreed. WhatsApp requires opt-in before a
// business starts a chat; whoever says STOP (or blocks marketing messages) is opted out automatically.

const SOURCE_LABEL: Record<string, string> = { Lead: 'Lead', DoctorDekho: 'Doctor Dekho', Import: 'Imported', Inbound: 'Wrote to us', Manual: 'Added by hand' };
// CmsSalesLead.Stage values (CMSAPI.Domain/Entities/CmsSalesLead.cs).
const LEAD_STAGES = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won', 'Closed Lost'];
const PAGE = 50;

export default function ContactsTab({ can }: { can: WaCan }) {
  const [q, setQ] = useState<WaContactQuery>({ page: 1, pageSize: PAGE });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<WaContactPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WaContact | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(cur => ({ ...cur, search: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    waService.contacts(q).then(p => { if (live) { setPage(p); setError(null); } }).catch(e => { if (live) setError(waError(e)); });
    return () => { live = false; };
  }, [q, version]);

  const reload = () => setVersion(v => v + 1);
  const pages = page ? Math.max(1, Math.ceil(page.total / PAGE)) : 1;

  return (
    <div>
      <div className="hw-bar wa-bar">
        <input type="text" placeholder="Search name or number" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search contacts" />
        <select value={q.optIn ?? ''} onChange={e => setQ({ ...q, optIn: e.target.value || undefined, page: 1 })} aria-label="Opt-in">
          <option value="">Any opt-in</option>
          {(['OptedIn', 'Unknown', 'OptedOut'] as OptIn[]).map(o => <option key={o} value={o}>{OPTIN_LABEL[o]}</option>)}
        </select>
        <select value={q.source ?? ''} onChange={e => setQ({ ...q, source: e.target.value || undefined, page: 1 })} aria-label="Source">
          <option value="">Any source</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {page && page.allTags.length > 0 && (
          <select value={q.tag ?? ''} onChange={e => setQ({ ...q, tag: e.target.value || undefined, page: 1 })} aria-label="Tag">
            <option value="">Any tag</option>
            {page.allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span className="wa-grow" />
        {can.contacts && <button type="button" className="hw-btn" onClick={() => setImporting(true)}><Upload size={14} /> Import</button>}
        {can.contacts && <button type="button" className="hw-btn hw-btn-primary" onClick={() => setEditing('new')}><Plus size={14} /> Add contact</button>}
      </div>
      {error && <p className="hw-err wa-pad">{error}</p>}
      {page == null && !error && <p className="hw-muted wa-pad">Loading…</p>}
      {page?.total === 0 && <div className="hw-empty"><b>No contacts</b><span>Import a CSV, your leads or Doctor Dekho patients, or add one by hand.</span></div>}
      {page && page.items.length > 0 && (
        <div className="hw-tbl">
          <table>
            <thead><tr><th>Name</th><th>Number</th><th>Source</th><th>Opt-in</th><th>Tags</th><th>Last message</th></tr></thead>
            <tbody>
              {page.items.map(c => (
                <tr key={c.contactId} onClick={() => can.contacts && setEditing(c)} className={can.contacts ? undefined : 'hw-static'}>
                  <td className="hw-title">{c.name || c.profileName || '—'}</td>
                  <td>{c.displayPhone}</td>
                  <td>{SOURCE_LABEL[c.source] ?? c.source}</td>
                  <td>
                    <span className={`wa-opt wa-opt-${c.optIn.toLowerCase()}`}>{OPTIN_LABEL[c.optIn]}</span>
                    {c.optIn === 'OptedIn' && c.optInSource && <div className="wa-small hw-muted">{c.optInSource}</div>}
                    {c.optIn === 'OptedOut' && c.optOutReason && <div className="wa-small hw-muted">{c.optOutReason}</div>}
                  </td>
                  <td>{c.tags.map(t => <span key={t} className="wa-chip">{t}</span>)}</td>
                  <td className="wa-small">{when(c.lastMessageAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page && page.total > PAGE && (
        <div className="hw-bar wa-bar">
          <button type="button" className="hw-btn" disabled={(q.page ?? 1) <= 1} onClick={() => setQ({ ...q, page: (q.page ?? 1) - 1 })}>Previous</button>
          <span className="hw-muted">Page {q.page ?? 1} of {pages} · {page.total} contacts</span>
          <button type="button" className="hw-btn" disabled={(q.page ?? 1) >= pages} onClick={() => setQ({ ...q, page: (q.page ?? 1) + 1 })}>Next</button>
        </div>
      )}
      {editing && <ContactForm contact={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {importing && <ImportDialog can={can} onClose={() => setImporting(false)} onDone={reload} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="wa-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wa-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="wa-row wa-between"><h2 className="wa-h2">{title}</h2><button type="button" className="hw-btn" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        {children}
      </div>
    </div>
  );
}

function ContactForm({ contact, onClose, onSaved }: { contact: WaContact | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<WaSaveContact>({
    phone: contact?.phone ?? '', name: contact?.name ?? '', tags: contact?.tags ?? [], attributes: contact?.attributes ?? {},
    optIn: contact?.optIn ?? 'Unknown', optInSource: '',
  });
  const [tagText, setTagText] = useState((contact?.tags ?? []).join(', '));
  const [attrText, setAttrText] = useState(Object.entries(contact?.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'));
  const [busy, setBusy] = useState(false);
  const optingIn = f.optIn === 'OptedIn' && contact?.optIn !== 'OptedIn';

  const save = async () => {
    const attributes: Record<string, string> = {};
    for (const line of attrText.split('\n')) {
      const i = line.indexOf(':');
      if (i > 0 && line.slice(i + 1).trim()) attributes[line.slice(0, i).trim().toLowerCase().replace(/\s+/g, '_')] = line.slice(i + 1).trim();
    }
    const p: WaSaveContact = { ...f, tags: tagText.split(',').map(t => t.trim()).filter(Boolean), attributes, optInSource: optingIn ? f.optInSource : undefined };
    setBusy(true);
    try {
      if (contact) await waService.updateContact(contact.contactId, p); else await waService.createContact(p);
      toast.success('Contact saved');
      onSaved();
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title={contact ? (contact.name || contact.displayPhone) : 'Add contact'} onClose={onClose}>
      <label className="wa-field"><span>WhatsApp number</span>
        <input type="text" value={f.phone} disabled={!!contact} placeholder="98765 43210 or +44 …" onChange={e => setF({ ...f, phone: e.target.value })} />
        {!contact && <small className="hw-muted">Indian numbers can be written without +91.</small>}
      </label>
      <label className="wa-field"><span>Name</span><input type="text" value={f.name ?? ''} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label className="wa-field"><span>Tags (comma separated)</span><input type="text" value={tagText} placeholder="hospital, pune" onChange={e => setTagText(e.target.value)} /></label>
      <label className="wa-field"><span>Details for template variables (one per line, “detail: value”)</span>
        <textarea rows={3} value={attrText} placeholder={'city: Pune\nbeds: 50'} onChange={e => setAttrText(e.target.value)} />
      </label>
      <fieldset className="wa-field">
        <legend>Agreed to WhatsApp messages?</legend>
        {(['OptedIn', 'Unknown', 'OptedOut'] as OptIn[]).map(o => (
          <label key={o} className="wa-radio"><input type="radio" checked={f.optIn === o} onChange={() => setF({ ...f, optIn: o })} /> {OPTIN_LABEL[o]}</label>
        ))}
        {optingIn && (
          <input type="text" value={f.optInSource ?? ''} placeholder="How they agreed, e.g. signed the form at the Pune camp" onChange={e => setF({ ...f, optInSource: e.target.value })} aria-label="How they agreed" />
        )}
        {contact?.optIn === 'OptedIn' && contact.optInSource && <small className="hw-muted">Opted in: {contact.optInSource}{contact.optInBy ? ` · recorded by ${contact.optInBy}` : ''}{contact.optInAt ? ` · ${when(contact.optInAt)}` : ''}</small>}
        {contact?.optIn === 'OptedOut' && <small className="hw-muted">Opted out {when(contact.optOutAt)}{contact.optOutReason ? `: ${contact.optOutReason}` : ''}. Only opt them in again if they asked.</small>}
      </fieldset>
      <div className="wa-row">
        <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="hw-btn hw-btn-primary" disabled={busy || !f.phone.trim() || (optingIn && !f.optInSource?.trim())} onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

type Source = 'csv' | 'leads' | 'dd';

function ImportDialog({ can, onClose, onDone }: { can: WaCan; onClose: () => void; onDone: () => void }) {
  const [source, setSource] = useState<Source>('csv');
  const [csv, setCsv] = useState<CsvImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [from, setFrom] = useState(() => new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [allOptedIn, setAllOptedIn] = useState(false);
  const [optInSource, setOptInSource] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WaImportResult | null>(null);

  const read = async (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setCsv(csvToContacts(await file.text()));
  };

  const sampleCsv = () => {
    const blob = new Blob(['phone,name,tags,city,opted_in\n9876543210,Example Hospital,hospital|pune,Pune,yes\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'whatsapp-contacts-example.csv';
    a.click();
  };

  const go = async () => {
    const common = { allOptedIn, optInSource: allOptedIn ? optInSource.trim() : undefined, tags: tags.split(',').map(t => t.trim()).filter(Boolean) };
    setBusy(true);
    try {
      const r = source === 'csv' ? await waService.importRows(csv?.rows ?? [], common)
        : source === 'leads' ? await waService.importLeads(stages, common)
          : await waService.importDoctorDekho(from, to, common);
      setResult(r);
      onDone();
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  const ready = (source === 'csv' ? (csv?.rows.length ?? 0) > 0 : source === 'dd' ? !!from && !!to : true) && (!allOptedIn || optInSource.trim().length > 0);

  return (
    <Modal title="Import contacts" onClose={onClose}>
      {result ? (
        <>
          <p><b>{result.added}</b> added · <b>{result.updated}</b> updated · <b>{result.skipped}</b> skipped</p>
          {result.problems.length > 0 && <ul className="wa-problems">{result.problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}</ul>}
          <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <>
          <div className="wa-pills" role="tablist">
            <button type="button" role="tab" aria-selected={source === 'csv'} className={`wa-pill${source === 'csv' ? ' on' : ''}`} onClick={() => setSource('csv')}>CSV file</button>
            <button type="button" role="tab" aria-selected={source === 'leads'} className={`wa-pill${source === 'leads' ? ' on' : ''}`} onClick={() => setSource('leads')}>Hospital & doctor leads</button>
            {can.patients && <button type="button" role="tab" aria-selected={source === 'dd'} className={`wa-pill${source === 'dd' ? ' on' : ''}`} onClick={() => setSource('dd')}>Doctor Dekho patients</button>}
          </div>

          {source === 'csv' && (
            <div className="wa-field">
              <span>CSV with a phone column; name, tags and opted_in are optional. Other columns become details for variables.</span>
              <input type="file" accept=".csv,text/csv" onChange={e => read(e.target.files?.[0])} aria-label="CSV file" />
              <button type="button" className="wa-link" onClick={sampleCsv}><Download size={12} /> Example file</button>
              {csv && (
                <div className="wa-small">
                  {fileName}: <b>{csv.rows.length}</b> contacts{csv.phoneColumn ? ` (phone from “${csv.phoneColumn}”)` : ''}
                  {csv.attributeColumns.length > 0 && <> · details: {csv.attributeColumns.join(', ')}</>}
                  {csv.problems.length > 0 && <ul className="wa-problems">{csv.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                </div>
              )}
            </div>
          )}
          {source === 'leads' && (
            <fieldset className="wa-field">
              <legend>Leads with a mobile number, in these stages (none ticked: all)</legend>
              <div className="wa-checks">
                {LEAD_STAGES.map(s => (
                  <label key={s} className="wa-check"><input type="checkbox" checked={stages.includes(s)} onChange={() => setStages(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]))} /> {s}</label>
                ))}
              </div>
            </fieldset>
          )}
          {source === 'dd' && (
            <div className="wa-grid2">
              <label className="wa-field"><span>Wrote to the Doctor Dekho bot from</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
              <label className="wa-field"><span>to</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
              <small className="hw-muted">Writing to the booking bot is not agreement to marketing. Opt them in only if they agreed separately.</small>
            </div>
          )}

          <label className="wa-field"><span>Add these tags (comma separated)</span><input type="text" value={tags} placeholder="pune-camp-dec" onChange={e => setTags(e.target.value)} /></label>
          <label className="wa-check"><input type="checkbox" checked={allOptedIn} onChange={e => setAllOptedIn(e.target.checked)} /> They all agreed to get WhatsApp messages from us</label>
          {allOptedIn && <input type="text" value={optInSource} placeholder="How they agreed, e.g. ticked the WhatsApp box on the camp form" onChange={e => setOptInSource(e.target.value)} aria-label="How they agreed" />}
          <small className="hw-muted">People who opted out stay opted out, whatever the file says.</small>
          <div className="wa-row">
            <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="hw-btn hw-btn-primary" disabled={!ready || busy} onClick={go}>{busy ? 'Importing…' : 'Import'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
