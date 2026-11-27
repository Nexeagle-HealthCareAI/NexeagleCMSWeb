import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Circle, Copy, Eye, EyeOff, RefreshCw, XCircle } from 'lucide-react';
import type { GoogleCan } from '../access';
import { googleService, googleError } from '../services/googleService';
import type { GoogleAccount, GoogleChecks, GoogleDiscovery, GoogleOutcome, GoogleSetup } from '../types';
import { ago, OUTCOME_STAGES, SITES, validLabel, validTagId, when } from '../googleUtils';

// Google → Setup: connect a website's Google Analytics, Google Ads and Search Console without touching servers.
// Sign-in uses the company's own Google Cloud OAuth client (entered here, the secret stored encrypted). The site's
// tag IDs live here too; nexeagle.com and Doctor Dekho read them from the CMS. One account per website.

const ICON = {
  ok: <CheckCircle2 size={17} className="wa-ck-ok" aria-label="Done" />,
  warn: <AlertTriangle size={17} className="wa-ck-warn" aria-label="Check" />,
  fail: <XCircle size={17} className="wa-ck-fail" aria-label="Problem" />,
  todo: <Circle size={17} className="wa-ck-todo" aria-label="To do" />,
};
const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); } };
const formatId = (id?: string | null) => (id && /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id ?? '');

interface Props { account: GoogleAccount | null; can: GoogleCan; onChanged: () => void; onCreated: (id: string) => void }

export default function SetupTab({ account, can, onChanged, onCreated }: Props) {
  const [params, setParams] = useSearchParams();
  const [setup, setSetup] = useState<GoogleSetup | null>(null);
  const [checks, setChecks] = useState<GoogleChecks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState(0);
  const [found, setFound] = useState<GoogleDiscovery | null>(null);
  const [looking, setLooking] = useState(false);

  // Back from Google's sign-in: say how it went once, then drop it from the address.
  useEffect(() => {
    const back = params.get('google');
    if (!back) return;
    if (back === 'connected') toast.success('Signed in with Google. Now choose the accounts.');
    else if (back === 'partial') toast.warning('Signed in, but Google did not give every permission. Sign in again and tick every box Google shows.');
    else toast.error(`Google sign-in did not finish${params.get('reason') ? `: ${params.get('reason')}` : '.'}`);
    params.delete('google'); params.delete('reason');
    setParams(params, { replace: true });
    onChanged();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!account) return;
    let live = true;
    setChecks(null);
    googleService.setup(account.accountId).then(s => { if (live) { setSetup(s); setError(null); } }).catch(e => { if (live) setError(googleError(e)); });
    googleService.checks(account.accountId).then(c => { if (live) setChecks(c); })
      .catch(e => { if (live) setChecks({ ready: false, items: [{ key: 'x', label: 'Checks', state: 'fail', detail: googleError(e) }] }); });
    return () => { live = false; };
  }, [account, version]);

  // What the signed-in Google account can see (properties, Ads accounts, Search Console sites, conversion actions):
  // one slow call, shared by steps 2 and 5.
  const canDiscover = !!setup && can.connect && setup.canEdit && setup.signedIn;
  const discover = async () => {
    if (!account) return;
    setLooking(true);
    try { setFound(await googleService.discover(account.accountId)); } catch (e) { toast.error(googleError(e)); } finally { setLooking(false); }
  };
  useEffect(() => { if (canDiscover) discover(); else setFound(null); }, [canDiscover, account?.accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = (s: GoogleSetup) => { setSetup(s); setVersion(v => v + 1); onChanged(); };
  const recheck = async () => {
    if (!account) return;
    setChecking(true);
    try { setChecks(await googleService.checks(account.accountId)); } catch (e) { toast.error(googleError(e)); } finally { setChecking(false); }
  };

  if (!account) {
    return (
      <div className="wa-pad wa-settings">
        <section className="wa-chart-card">
          <h3 className="wa-h3">Connect the first website to Google</h3>
          {can.connect ? <AddAccount onCreated={onCreated} /> : <p className="hw-muted wa-small">Someone with “Connect Google accounts” does this.</p>}
        </section>
      </div>
    );
  }
  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!setup) return <p className="hw-muted wa-pad">Loading…</p>;
  const edit = can.connect && setup.canEdit;

  return (
    <div className="wa-pad gg-setup">
      <div className="wa-settings">
        <section className={`wa-chart-card wa-status${checks?.ready ? ' ready' : ''}`}>
          <div className="wa-row wa-between">
            <h3 className="wa-h3">{checks == null ? 'Checking with Google…' : checks.ready ? `${setup.name}: connected` : `${setup.name}: not fully connected yet`}</h3>
            <button type="button" className="hw-btn" onClick={recheck} disabled={checking || checks == null}><RefreshCw size={13} /> {checking ? 'Checking…' : 'Check again'}</button>
          </div>
          <ul className="wa-checklist">
            {(checks?.items ?? []).map(c => <li key={c.key}>{ICON[c.state]}<div><b>{c.label}</b>{c.detail && <div className="hw-muted wa-small">{c.detail}</div>}</div></li>)}
          </ul>
          {setup.lastReadError && <p className="hw-err wa-small">Last read from Google failed: {setup.lastReadError}</p>}
        </section>

        {setup.unreadable && <p className="wa-problem">The saved Google keys cannot be read on this server (the encryption key changed). Enter the client secret again and sign in again.</p>}
        {!setup.canEncrypt && <p className="wa-problem">This server has no encryption key, so Google keys cannot be saved. Ask whoever runs the API to set it.</p>}

        <ClientCard setup={setup} edit={edit} onSaved={saved} />
        <AccountsCard setup={setup} edit={edit && setup.signedIn} found={found} looking={looking} onLook={discover} onSaved={saved} />
        <TagCard setup={setup} edit={edit} onSaved={saved} />
        <LeadFormsCard setup={setup} edit={edit} onSaved={saved} />
        <OutcomesCard setup={setup} edit={edit && setup.signedIn && setup.hasAds} actions={found?.conversionActions ?? null} onSaved={saved} />
      </div>

      <aside className="wa-settings">
        <section className="wa-chart-card">
          <h3 className="wa-h3">Google's approvals</h3>
          <ul className="gg-notes wa-small">
            <li><b>Sign-in screen</b> (Google Cloud → Google Auth Platform → Audience) set to “In production”, or the connection drops every 7 days.</li>
            <li><b>APIs turned on</b> in the same Cloud project: Google Analytics Data, Google Analytics Admin, Google Ads, Search Console and Data Manager.</li>
            <li><b>Google Ads API access</b>: requested in Google Cloud Console once the brand is verified; Basic access is enough.</li>
          </ul>
        </section>
        <section className="wa-chart-card">
          <h3 className="wa-h3">Privacy</h3>
          <p className="hw-muted wa-small">Google's tag loads only after a visitor accepts tracking. No names, phone numbers, symptoms or conditions go to Google. Doctor Dekho sends only counts of searches, profile views and bookings, never what was searched or which doctor, and its audiences stay broad (visited, booked), as Google's ad rules on health require.</p>
        </section>
        <section className="wa-chart-card">
          <h3 className="wa-h3">Who can change this</h3>
          <p className="hw-muted wa-small">Only people with “Connect Google accounts”. Everyone in Google sees this checklist.{setup.updatedBy ? ` Last changed by ${setup.updatedBy}${setup.updatedAt ? `, ${when(setup.updatedAt)}` : ''}.` : ''}</p>
        </section>
        {can.connect && (
          <section className="wa-chart-card">
            <h3 className="wa-h3">Another website</h3>
            <p className="hw-muted wa-small">Each website has its own Analytics property, tag and Ads account. The Account switch at the top then changes every tab.</p>
            <AddAccount onCreated={onCreated} />
          </section>
        )}
      </aside>
    </div>
  );
}

function AddAccount({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { const a = await googleService.createAccount(name.trim(), site || null); setName(''); toast.success(`${a.name} added. Now enter its Google sign-in.`); onCreated(a.accountId); }
    catch (e) { toast.error(googleError(e)); } finally { setBusy(false); }
  };
  return (
    <div className="wa-row wa-flushrow gg-wrap">
      <input aria-label="Name" placeholder="Name (e.g. the website)" value={name} maxLength={100} onChange={e => setName(e.target.value)} />
      <select aria-label="Website" value={site} onChange={e => setSite(e.target.value)}>
        <option value="">Website…</option>
        {SITES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <button type="button" className="hw-btn hw-btn-primary" onClick={add} disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add account'}</button>
    </div>
  );
}

function ClientCard({ setup, edit, onSaved }: { setup: GoogleSetup; edit: boolean; onSaved: (s: GoogleSetup) => void }) {
  const [name, setName] = useState(setup.name);
  const [site, setSite] = useState(setup.site ?? '');
  const [clientId, setClientId] = useState(setup.clientId ?? '');
  const [secret, setSecret] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const changed = name.trim() !== setup.name || (site || null) !== (setup.site ?? null) || clientId.trim() !== (setup.clientId ?? '') || !!secret.trim();

  const save = async (signOut = false) => {
    setBusy(signOut ? 'out' : 'save');
    try {
      const s = await googleService.saveClient(setup.accountId, { name: name.trim(), site: site || null, clientId: clientId.trim() || undefined, clientSecret: secret.trim() || undefined, signOut });
      setSecret('');
      toast.success(signOut ? 'Signed out of Google.' : 'Saved.');
      onSaved(s);
      return s;
    } catch (e) { toast.error(googleError(e)); return null; } finally { setBusy(null); }
  };
  const signIn = async () => {
    if (changed && !(await save())) return;
    setBusy('in');
    try { window.location.assign(await googleService.signIn(setup.accountId, `${window.location.origin}/google/setup`)); }
    catch (e) { toast.error(googleError(e)); setBusy(null); }
  };

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">1 · Sign in with Google</h3>
      <p className="wa-small hw-muted">Uses the company's own Google Cloud project: create an OAuth client of type “Web application” there and give Google the redirect address below. The client secret is stored encrypted and never shown again.</p>
      <fieldset className="wa-plain" disabled={!edit}>
        <div className="gg-grid2">
          <label className="wa-field"><span>Name in the CMS</span><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
          <label className="wa-field"><span>Website</span>
            <select value={site} onChange={e => setSite(e.target.value)}>
              <option value="">None</option>
              {SITES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="wa-field"><span>OAuth client ID</span><input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" autoComplete="off" /></label>
          <label className="wa-field">
            <span>Client secret {setup.hasClientSecret && <span className="hw-muted">· Saved. Leave empty to keep it.</span>}</span>
            <div className="wa-row wa-flushrow">
              <input type={show ? 'text' : 'password'} value={secret} autoComplete="off" onChange={e => setSecret(e.target.value)} />
              <button type="button" className="hw-btn" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide' : 'Show'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </label>
        </div>
      </fieldset>
      <label className="wa-field"><span>Address to give Google as the authorised redirect URI</span>
        <div className="wa-row wa-flushrow">
          <input readOnly value={setup.redirectUrl} className="wa-mono" />
          <button type="button" className="hw-btn" onClick={() => copy(setup.redirectUrl)} aria-label="Copy the redirect address"><Copy size={14} /></button>
        </div>
      </label>
      {edit && (
        <div className="wa-row gg-wrap">
          <button type="button" className="hw-btn hw-btn-primary" onClick={signIn} disabled={!!busy || !clientId.trim() || (!setup.hasClientSecret && !secret.trim())}>
            {busy === 'in' ? 'Opening Google…' : setup.signedIn ? 'Sign in again' : 'Sign in with Google'}
          </button>
          {changed && <button type="button" className="hw-btn" onClick={() => save()} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>}
          {setup.signedIn && <button type="button" className="hw-btn" onClick={() => save(true)} disabled={!!busy}>Sign out</button>}
        </div>
      )}
      <p className={`wa-small ${setup.signedIn ? 'gg-ok' : 'hw-muted'}`}>{setup.signedIn ? `Signed in as ${setup.signedInEmail ?? 'a Google account'}${setup.signedInAt ? ` · ${when(setup.signedInAt)}` : ''}` : 'Not signed in yet.'}</p>
    </section>
  );
}

interface AccountsProps { setup: GoogleSetup; edit: boolean; found: GoogleDiscovery | null; looking: boolean; onLook: () => void; onSaved: (s: GoogleSetup) => void }
function AccountsCard({ setup, edit, found, looking, onLook, onSaved }: AccountsProps) {
  const [ga, setGa] = useState(setup.ga4PropertyId ?? '');
  const [ads, setAds] = useState(setup.adsCustomerId ?? '');
  const [sc, setSc] = useState(setup.searchConsoleSite ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Only one to choose from: choose it.
    if (!found) return;
    if (!ga && found.properties.length === 1) setGa(found.properties[0].propertyId);
    if (!ads && found.adsAccounts.length === 1) setAds(found.adsAccounts[0].customerId);
  }, [found]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    try { const s = await googleService.choose(setup.accountId, { ga4PropertyId: ga || null, adsCustomerId: ads || null, searchConsoleSite: sc || null }); toast.success('Saved.'); onSaved(s); }
    catch (e) { toast.error(googleError(e)); } finally { setBusy(false); }
  };
  const problems = Object.entries(found?.problems ?? {});
  const propertyName = (p: { name: string; accountName?: string | null; propertyId: string }) => `${p.name}${p.accountName ? ` · ${p.accountName}` : ''} (${p.propertyId})`;

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">2 · Choose the accounts</h3>
      {!edit ? (
        <dl className="wa-dl">
          <dt>Google Analytics property</dt><dd>{setup.ga4PropertyName ?? '—'}</dd>
          <dt>Google Ads account</dt><dd>{setup.adsAccountName ? `${setup.adsAccountName} (${formatId(setup.adsCustomerId)})` : '—'}</dd>
          <dt>Search Console site</dt><dd>{setup.searchConsoleSite ?? '—'}</dd>
          {!setup.signedIn && <><dt /><dd className="hw-muted wa-small">Sign in with Google first.</dd></>}
        </dl>
      ) : (
        <>
          <p className="wa-small hw-muted">Listed from what {found?.signedInEmail ?? 'the signed-in account'} can see. <button type="button" className="wa-link" onClick={onLook} disabled={looking}>{looking ? 'Looking…' : 'Look again'}</button></p>
          {problems.length > 0 && <ul className="wa-problems">{problems.map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
          <div className="gg-grid3">
            <label className="wa-field"><span>Google Analytics property</span>
              <select value={ga} onChange={e => setGa(e.target.value)}>
                <option value="">None</option>
                {(found?.properties ?? (setup.ga4PropertyId ? [{ propertyId: setup.ga4PropertyId, name: setup.ga4PropertyName ?? setup.ga4PropertyId }] : [])).map(p => <option key={p.propertyId} value={p.propertyId}>{propertyName(p)}</option>)}
              </select>
            </label>
            <label className="wa-field"><span>Google Ads account</span>
              <select value={ads} onChange={e => setAds(e.target.value)}>
                <option value="">None</option>
                {(found?.adsAccounts ?? (setup.adsCustomerId ? [{ customerId: setup.adsCustomerId, name: setup.adsAccountName ?? setup.adsCustomerId }] : [])).map(a => <option key={a.customerId} value={a.customerId}>{a.name} ({formatId(a.customerId)})</option>)}
              </select>
            </label>
            <label className="wa-field"><span>Search Console site (optional)</span>
              <select value={sc} onChange={e => setSc(e.target.value)}>
                <option value="">None</option>
                {(found?.searchConsoleSites ?? (setup.searchConsoleSite ? [setup.searchConsoleSite] : [])).map(s => <option key={s} value={s}>{s.replace(/^sc-domain:/, '')}</option>)}
              </select>
            </label>
          </div>
          <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={save} disabled={busy || looking}>{busy ? 'Saving…' : 'Save accounts'}</button></div>
        </>
      )}
    </section>
  );
}

function TagCard({ setup, edit, onSaved }: { setup: GoogleSetup; edit: boolean; onSaved: (s: GoogleSetup) => void }) {
  const [g, setG] = useState(setup.measurementId ?? '');
  const [aw, setAw] = useState(setup.adsConversionId ?? '');
  const [labels, setLabels] = useState<Record<string, string>>(setup.eventLabels);
  const [busy, setBusy] = useState(false);
  const G = g.trim().toUpperCase(); const AW = aw.trim().toUpperCase();
  const problem = (G && !validTagId(G, 'G-')) ? 'The measurement ID looks like G-XXXXXXXXXX (Analytics → Admin → Data streams).'
    : (AW && !validTagId(AW, 'AW-')) ? 'The Google Ads conversion ID looks like AW-123456789 (Google Ads → Goals → Conversions → Tag setup).'
      : Object.values(labels).some(v => v.trim() && !validLabel(v.trim())) ? 'A conversion label has letters, digits, - and _ only (the part after the / in AW-123/AbCdEf).'
        : Object.values(labels).some(v => v.trim()) && !AW ? 'Conversion labels need the Google Ads conversion ID too.' : null;
  const save = async () => {
    setBusy(true);
    try { const r = await googleService.saveTag(setup.accountId, { measurementId: G || null, adsConversionId: AW || null, eventLabels: labels }); toast.success(r.message ?? 'Saved.'); onSaved(r.data); }
    catch (e) { toast.error(googleError(e)); } finally { setBusy(false); }
  };
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">3 · Website tag</h3>
      <p className="wa-small hw-muted">{setup.site ? `The website reads these IDs from the CMS and loads Google's tag only after a visitor accepts tracking.` : 'Choose the website in step 1 first; the website reads these IDs from the CMS.'} Changes reach the site within 5 minutes.</p>
      <fieldset className="wa-plain" disabled={!edit}>
        <div className="gg-grid2">
          <label className="wa-field"><span>Analytics measurement ID</span><input value={g} onChange={e => setG(e.target.value)} placeholder="G-…" className="wa-mono" /></label>
          <label className="wa-field"><span>Google Ads conversion ID (optional)</span><input value={aw} onChange={e => setAw(e.target.value)} placeholder="AW-…" className="wa-mono" /></label>
        </div>
        <div className="sc-scroll">
          <table className="wa-mini gg-table">
            <thead><tr><th>Action on the site</th><th>Counted as a lead</th><th>Google Ads conversion label (optional)</th></tr></thead>
            <tbody>
              {setup.siteEvents.map(e => (
                <tr key={e.name}>
                  <td>{e.label}<div className="hw-muted wa-small wa-mono">{e.name}</div></td>
                  <td>{e.isLead ? 'Yes' : 'No'}</td>
                  <td><input aria-label={`Conversion label for ${e.label}`} value={labels[e.name] ?? ''} onChange={x => setLabels(l => ({ ...l, [e.name]: x.target.value }))} className="wa-mono" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {problem && <p className="hw-err wa-small">{problem}</p>}
        {edit && <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={save} disabled={busy || !!problem}>{busy ? 'Saving…' : 'Save the tag'}</button></div>}
      </fieldset>
      <p className="hw-muted wa-small">A label makes that action count as a result in Google Ads straight from the site. Leads are also sent from the CRM (step 5), which also knows when they became customers; use one or the other for the same action so Google does not count it twice.</p>
    </section>
  );
}

function LeadFormsCard({ setup, edit, onSaved }: { setup: GoogleSetup; edit: boolean; onSaved: (s: GoogleSetup) => void }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const renew = async () => {
    setBusy(true);
    try { const s = await googleService.newLeadKey(setup.accountId); toast.success('New key made. Paste it into every lead form in Google Ads; the old key stops working now.'); setShow(true); onSaved(s); }
    catch (e) { toast.error(googleError(e)); } finally { setBusy(false); }
  };
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">4 · Google lead forms</h3>
      <p className="wa-small hw-muted">In Google Ads, open each lead form and paste this address and key under “Lead delivery → Webhook integration”. Leads arrive in the CRM within seconds; use “Send test data” there to try it (test leads are recognised and not kept).</p>
      <label className="wa-field"><span>Webhook address</span>
        <div className="wa-row wa-flushrow">
          <input readOnly value={setup.leadWebhookUrl} className="wa-mono" />
          <button type="button" className="hw-btn" onClick={() => copy(setup.leadWebhookUrl)} aria-label="Copy the webhook address"><Copy size={14} /></button>
        </div>
      </label>
      {setup.leadKey ? (
        <label className="wa-field"><span>Key</span>
          <div className="wa-row wa-flushrow">
            <input readOnly type={show ? 'text' : 'password'} value={setup.leadKey} className="wa-mono" />
            <button type="button" className="hw-btn" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide the key' : 'Show the key'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button type="button" className="hw-btn" onClick={() => copy(setup.leadKey!)} aria-label="Copy the key"><Copy size={14} /></button>
            {edit && <button type="button" className="hw-btn" onClick={renew} disabled={busy}>{busy ? 'Making…' : 'New key'}</button>}
          </div>
        </label>
      ) : <p className="hw-muted wa-small">The key is shown to people with “Connect Google accounts”.</p>}
      <p className="hw-muted wa-small">{setup.lastLeadAt ? `Last lead received ${ago(setup.lastLeadAt)} ago.` : 'No lead received yet.'}</p>
    </section>
  );
}

function OutcomesCard({ setup, edit, actions, onSaved }: { setup: GoogleSetup; edit: boolean; actions: { id: string; name: string }[] | null; onSaved: (s: GoogleSetup) => void }) {
  const [rows, setRows] = useState<GoogleOutcome[]>(setup.outcomes);
  const [busy, setBusy] = useState(false);
  const row = (stage: string) => rows.find(r => r.stage === stage);
  const set = (stage: string, p: Partial<GoogleOutcome> | null) => setRows(rs => {
    const rest = rs.filter(r => r.stage !== stage);
    if (p === null) return rest;
    return [...rest, { ...(row(stage) ?? { stage, conversionActionId: '' }), ...p }];
  });
  const missing = rows.some(r => !r.conversionActionId);
  const save = async () => {
    setBusy(true);
    try {
      const ordered = OUTCOME_STAGES.map(s => rows.find(r => r.stage === s)).filter(Boolean) as GoogleOutcome[];
      const s = await googleService.saveOutcomes(setup.accountId, ordered.map(r => ({ ...r, conversionActionName: actions?.find(a => a.id === r.conversionActionId)?.name ?? r.conversionActionName })));
      toast.success(ordered.length ? 'Saved. Results are sent every 10 minutes.' : 'Saved. Nothing will be sent.');
      onSaved(s);
    } catch (e) { toast.error(googleError(e)); } finally { setBusy(false); }
  };
  const list = actions ?? setup.outcomes.map(o => ({ id: o.conversionActionId, name: o.conversionActionName ?? o.conversionActionId }));

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">5 · Tell Google which leads turned into business</h3>
      <p className="wa-small hw-muted">When a lead from a Google ad reaches one of these CRM stages, the CMS sends Google the ad click and the stage (through Google's Data Manager API), never names or phone numbers, so Google shows the ads to people more like real customers. Each stage needs its own conversion action in Google Ads, of the kind “Import → CRM / clicks”.</p>
      {!setup.hasAds && <p className="hw-muted wa-small">Choose the Google Ads account in step 2 first.</p>}
      <fieldset className="wa-plain" disabled={!edit}>
        <div className="sc-scroll">
          <table className="wa-mini gg-table">
            <thead><tr><th>CRM stage</th><th>Conversion action in Google Ads</th><th className="wa-num">Value (₹)</th></tr></thead>
            <tbody>
              {OUTCOME_STAGES.map(stage => {
                const r = row(stage);
                return (
                  <tr key={stage}>
                    <td><label className="gg-check"><input type="checkbox" checked={!!r} onChange={e => set(stage, e.target.checked ? {} : null)} /> {stage}</label></td>
                    <td>
                      {r && (
                        <select aria-label={`Conversion action for ${stage}`} value={r.conversionActionId} onChange={e => set(stage, { conversionActionId: e.target.value })}>
                          <option value="">Choose…</option>
                          {list.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="wa-num">
                      {r && <input aria-label={`Value for ${stage}`} type="number" min={0} className="gg-num" value={r.value ?? ''} placeholder={stage === 'Closed Won' ? 'deal value' : ''} onChange={e => set(stage, { value: e.target.value === '' ? null : Number(e.target.value) })} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {actions && actions.length === 0 && edit && <p className="hw-muted wa-small">No “import from clicks” conversion action found in this Ads account yet. Make one per stage in Google Ads → Goals → Conversions → New → Import → CRM, then come back.</p>}
        {edit && <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={save} disabled={busy || missing}>{busy ? 'Saving…' : 'Save'}</button>{missing && <span className="hw-muted wa-small">Choose a conversion action for every ticked stage.</span>}</div>}
      </fieldset>
      <p className="hw-muted wa-small">
        Closed Won sends the lead's deal value from the CRM when it has one. Leads not from a Google ad, and clicks older than 90 days, are not sent.
        {setup.lastOutcomeAt && ` Last sent ${ago(setup.lastOutcomeAt)} ago.`}
      </p>
      {setup.lastOutcomeError && <p className="wa-problem">Google refused the last results: {setup.lastOutcomeError}</p>}
    </section>
  );
}
