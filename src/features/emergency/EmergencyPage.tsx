import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, MapPin, Phone, Plus, RefreshCw, ShieldAlert, Siren, X } from 'lucide-react';
import { toast } from 'sonner';
import '../healthWiki/healthWiki.css';
import './emergency.css';
import {
  emergencyService,
  errorMessage,
  type AlertLogEvent,
  type EmergencyPlace,
  type NewPlace,
  type PlaceList,
  type VerificationStatus,
} from './emergencyService';

// Vita's emergency takeover (vision Phase 3). When a Doctor Dekho patient's message looks like an emergency, Vita shows the nearest
// emergency-ready places with their numbers and alerts them. A hospital's opt-in (1HMS portal -> Settings -> Emergency takeover) is
// shown to patients only after someone here checks it: call the emergency number, look at the map pin. Places that are not on 1HMS
// (a district hospital, an ambulance service) are added here and are live at once. The alert log is the audit of every emergency.

type Tab = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'log';

const CAPABILITIES = ['casualty', 'icu', 'trauma', 'cardiac', 'maternity', 'paediatric', 'ambulance'];
const hours = (p: EmergencyPlace) => (p.is24x7 ? '24x7' : `${p.openTime ?? '?'} to ${p.closeTime ?? '?'}`);
const mapLink = (p: EmergencyPlace) =>
  p.latitude != null && p.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}` : null;
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function EmergencyPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [list, setList] = useState<PlaceList | null>(null);
  const [log, setLog] = useState<AlertLogEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // A change (verify, add, refresh) bumps this; the effect fetches the open tab again.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    const request = tab === 'log'
      ? emergencyService.alerts().then((events) => { if (live) setLog(events); })
      : emergencyService.places(tab).then((places) => { if (live) setList(places); });
    request.then(() => { if (live) setError(null); }).catch((e) => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [tab, version]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'PENDING', label: 'To verify', count: list?.pending },
    { id: 'VERIFIED', label: 'Verified', count: list?.verified },
    { id: 'REJECTED', label: 'Needs changes', count: list?.rejected },
    { id: 'log', label: 'Alert log' },
  ];

  return (
    <div className="hw-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><Siren size={24} /> Emergency takeover</h1>
          <p className="hw-sub">
            Hospitals Vita shows and alerts when a patient's message looks like an emergency. Check a hospital's details (call the
            emergency number, look at the pin) before verifying: patients will call that number.
          </p>
        </div>
        <button type="button" className="hw-btn hw-btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a place not on 1HMS</button>
      </div>

      {adding && <AddPlace onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setTab('VERIFIED'); load(); }} />}

      <div className="hw-panel">
        <div className="hw-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`hw-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}{t.count !== undefined && <span>{t.count}</span>}
            </button>
          ))}
          <button type="button" className="hw-btn hw-sm em-refresh" onClick={load} aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
        {error && <p role="alert" className="hw-err em-pad">{error}</p>}
        {tab === 'log' ? <AlertLog events={log} /> : <Places list={list} status={tab} onChanged={load} />}
      </div>
    </div>
  );
}

function Places({ list, status, onChanged }: { list: PlaceList | null; status: VerificationStatus; onChanged: () => void }) {
  if (!list) return <div className="hw-empty">Loading…</div>;
  if (list.items.length === 0) {
    return <div className="hw-empty">{status === 'PENDING' ? 'Nothing waiting. Hospitals send their details from 1HMS → Settings → Emergency takeover.' : 'None yet.'}</div>;
  }
  return (
    <ul className="em-list">
      {list.items.map((p) => <PlaceRow key={p.settingId} place={p} onChanged={onChanged} />)}
    </ul>
  );
}

function PlaceRow({ place: p, onChanged }: { place: EmergencyPlace; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const map = mapLink(p);

  const decide = async (decision: 'VERIFIED' | 'REJECTED') => {
    setBusy(true);
    try {
      await emergencyService.verify(p.settingId, decision, decision === 'REJECTED' ? note : undefined);
      toast.success(decision === 'VERIFIED' ? `${p.name} is verified${p.isEnabled ? ' and shown to patients' : ''}.` : `${p.name} was sent back to the hospital.`);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await emergencyService.setEnabled(p, !p.isEnabled);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="em-row" aria-label={p.name ?? 'Emergency place'}>
      <div className="em-main">
        <div className="hw-title">
          {p.name}
          <span className="hw-tag">{p.source === 'CMS' ? 'Added in CMS' : '1HMS hospital'}</span>
          {p.kind === 'AMBULANCE' && <span className="hw-tag">Ambulance</span>}
          {p.listed ? <span className="hw-tag em-live">Shown to patients</span> : !p.isEnabled ? <span className="hw-tag">Switched off</span> : null}
        </div>
        <div className="em-facts">
          <span><Phone size={13} /> <a href={`tel:${p.emergencyPhone}`}>{p.emergencyPhone}</a>{p.alternatePhone ? ` / ${p.alternatePhone}` : ''}</span>
          {p.alertWhatsApp && <span>Alerts on WhatsApp: {p.alertWhatsApp}</span>}
          <span>{hours(p)}</span>
          {map && <a href={map} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> Map pin</a>}
        </div>
        <div className="hw-muted">
          {[p.landmark, p.address, p.city].filter(Boolean).join(', ')}
          {p.capabilities.length > 0 && <> · {p.capabilities.join(', ')}</>}
          {p.dutyContactName && <> · Duty: {p.dutyContactName}{p.dutyContactPhone ? ` (${p.dutyContactPhone})` : ''}</>}
        </div>
        <div className="hw-muted">
          {p.source === 'HOSPITAL' && (p.termsAcceptedAt ? `Terms ${p.termsVersion} accepted ${when(p.termsAcceptedAt)}. ` : 'Terms not accepted. ')}
          {p.verifiedBy && `${p.verificationStatus === 'REJECTED' ? 'Sent back' : 'Verified'} by ${p.verifiedBy} ${when(p.verifiedAt)}. `}
          {p.verificationNote && `Note: ${p.verificationNote}`}
        </div>
      </div>
      <div className="em-actions">
        {p.verificationStatus !== 'VERIFIED' && (
          <button type="button" className="hw-btn hw-btn-primary hw-sm" disabled={busy} onClick={() => void decide('VERIFIED')}>
            <BadgeCheck size={14} /> Verify
          </button>
        )}
        {p.source === 'HOSPITAL' && p.verificationStatus !== 'REJECTED' && !rejecting && (
          <button type="button" className="hw-btn hw-sm" disabled={busy} onClick={() => setRejecting(true)}><ShieldAlert size={14} /> Send back</button>
        )}
        {p.source === 'CMS' && (
          <button type="button" className="hw-btn hw-sm" disabled={busy} onClick={() => void toggle()}>{p.isEnabled ? 'Switch off' : 'Switch on'}</button>
        )}
        {rejecting && (
          <div className="em-reject">
            <label htmlFor={`note-${p.settingId}`} className="hw-muted">What should the hospital fix?</label>
            <input id={`note-${p.settingId}`} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the emergency number did not answer" />
            <div className="em-row-btns">
              <button type="button" className="hw-btn hw-sm" onClick={() => setRejecting(false)}>Cancel</button>
              <button type="button" className="hw-btn hw-btn-primary hw-sm" disabled={busy || !note.trim()} onClick={() => void decide('REJECTED')}>Send back</button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function AddPlace({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: '', kind: 'HOSPITAL' as NewPlace['kind'], emergencyPhone: '', alternatePhone: '', alertWhatsApp: '',
    latitude: '', longitude: '', landmark: '', address: '', city: '', is24x7: true, openTime: '', closeTime: '', capabilities: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await emergencyService.add({
        name: f.name, kind: f.kind, emergencyPhone: f.emergencyPhone, alternatePhone: f.alternatePhone || undefined,
        alertWhatsApp: f.alertWhatsApp || undefined, latitude: num(f.latitude), longitude: num(f.longitude), landmark: f.landmark || undefined,
        address: f.address || undefined, city: f.city || undefined, is24x7: f.is24x7, openTime: f.is24x7 ? undefined : f.openTime,
        closeTime: f.is24x7 ? undefined : f.closeTime, capabilities: f.capabilities, isEnabled: true,
      });
      toast.success(`${f.name} added and shown to patients.`);
      onAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="em-field">
      <span>{label}</span>
      <input type="text" value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  );

  return (
    <form className="hw-panel em-add" onSubmit={submit} aria-label="Add a place not on 1HMS">
      <div className="hw-top">
        <strong>Add a place not on 1HMS</strong>
        <button type="button" className="hw-btn hw-sm" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <p className="hw-muted">A district hospital or an ambulance service. It is shown to patients as soon as you add it, so check the number first.</p>
      <div className="em-grid">
        {field('name', 'Name *')}
        <label className="em-field"><span>Kind</span>
          <select value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="HOSPITAL">Hospital</option>
            <option value="AMBULANCE">Ambulance service</option>
          </select>
        </label>
        {field('emergencyPhone', 'Emergency phone *', { inputMode: 'tel' })}
        {field('alternatePhone', 'Alternate phone', { inputMode: 'tel' })}
        {field('alertWhatsApp', 'WhatsApp for alerts', { inputMode: 'tel' })}
        {field('latitude', 'Latitude *', { inputMode: 'decimal' })}
        {field('longitude', 'Longitude *', { inputMode: 'decimal' })}
        {field('landmark', 'Landmark')}
        {field('address', 'Address')}
        {field('city', 'City')}
      </div>
      <label className="em-check"><input type="checkbox" checked={f.is24x7} onChange={(e) => set('is24x7', e.target.checked)} /> Open 24x7</label>
      {!f.is24x7 && <div className="em-grid">{field('openTime', 'Opens (HH:mm)')}{field('closeTime', 'Closes (HH:mm)')}</div>}
      <fieldset className="em-caps">
        <legend className="hw-muted">Can handle</legend>
        {CAPABILITIES.map((c) => (
          <label key={c} className="em-check">
            <input type="checkbox" checked={f.capabilities.includes(c)}
              onChange={() => set('capabilities', f.capabilities.includes(c) ? f.capabilities.filter((x) => x !== c) : [...f.capabilities, c])} /> {c}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="hw-err">{error}</p>}
      <div className="em-row-btns">
        <button type="submit" className="hw-btn hw-btn-primary" disabled={busy || !f.name.trim()}>Add and show to patients</button>
      </div>
    </form>
  );
}

function AlertLog({ events }: { events: AlertLogEvent[] | null }) {
  if (!events) return <div className="hw-empty">Loading…</div>;
  if (events.length === 0) return <div className="hw-empty">No emergency alerts in the last 30 days.</div>;
  return (
    <div className="hw-tbl">
      <table>
        <thead><tr><th>When</th><th>Reason</th><th>Places alerted</th><th>Patient's number</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.eventId}>
              <td>{when(e.at)}<div className="hw-muted">{e.channel === 'whatsapp' ? 'WhatsApp' : 'Website'}</div></td>
              <td>{e.reason}</td>
              <td>
                <ul className="em-log-places">
                  {e.places.map((p) => (
                    <li key={p.settingId}>
                      <strong>{p.name}</strong>{p.distanceKm != null && ` · ${p.distanceKm} km`}
                      {' · '}{p.whatsAppSent ? 'WhatsApp sent' : 'WhatsApp not sent'}{p.inApp && ' · in 1HMS'}
                      {p.callTaps > 0 && ` · ${p.callTaps} call tap${p.callTaps > 1 ? 's' : ''}`}
                      {p.acknowledged && <span className="em-ack"> · Acknowledged: {p.acknowledged}</span>}
                    </li>
                  ))}
                </ul>
              </td>
              <td>{e.sharedMobile ?? <span className="hw-muted">Not shared</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
