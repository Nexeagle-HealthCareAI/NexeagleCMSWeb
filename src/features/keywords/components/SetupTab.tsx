import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import type { KeywordsCan } from '../access';
import type { KeywordSetup, KeywordWeights, Site } from '../types';
import { keywordsService, keywordsError } from '../services/keywordsService';
import { istTime, n } from '../keywordUtils';

// Keywords → Setup: where keywords come from and how this morning's collection went (Run now with keywords.connect),
// seed lists and sites Keyword Planner reads, extra city names, how priority is weighed, and the site-search privacy
// threshold (never below 5). Search Console and Google Ads accounts are chosen in Google → Setup.

const STATE = {
  ok: { icon: <CheckCircle2 size={15} className="wa-ck-ok" />, label: 'Collected' },
  warn: { icon: <AlertTriangle size={15} className="wa-ck-warn" />, label: 'Needs attention' },
  off: { icon: <Circle size={15} className="wa-ck-todo" />, label: 'Not yet' },
};

const WEIGHTS: { id: keyof KeywordWeights; name: string; note: string }[] = [
  { id: 'demand', name: 'Demand', note: 'Searches a month, times shown, site searches' },
  { id: 'fit', name: 'Can we serve it', note: 'Doctors in that city and specialty, or a NexEagle module' },
  { id: 'close', name: 'Close to page one', note: 'Positions 5 to 20 are the quickest wins' },
  { id: 'value', name: 'Business value', note: 'Bookings and demo requests such searches bring' },
];

const lines = (v: string) => v.split(/[\n,]/).map(x => x.trim()).filter(Boolean);

export default function SetupTab({ can, onChanged }: { can: KeywordsCan; onChanged: () => void }) {
  const [setup, setSetup] = useState<KeywordSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    keywordsService.setup().then(s => { if (live) { setSetup(s); setError(null); } }).catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [version]);

  const run = async (source: string) => {
    setRunning(source); setNote(null);
    try { const r = await keywordsService.run(source); setNote(r.message ?? 'Collected.'); setVersion(v => v + 1); onChanged(); }
    catch (e) { setError(keywordsError(e)); } finally { setRunning(null); }
  };

  if (error && !setup) return <p className="hw-err wa-pad">{error}</p>;
  if (!setup) return <p className="hw-muted wa-pad">Loading…</p>;
  const canEdit = can.connect && setup.canEdit;

  return (
    <div className="wa-pad gg-setup">
      <div className="wa-settings">
        <section className="wa-chart-card">
          <div className="wa-row wa-between">
            <h3 className="wa-h3">Sources</h3>
            <span className="wa-row kw-gap6">
              <span className="hw-muted wa-small">Collected every morning at 05:30 IST</span>
              {canEdit && <button type="button" className="hw-btn" disabled={!!running} onClick={() => run('all')}><RefreshCw size={13} /> {running === 'all' ? 'Collecting…' : 'Run all now'}</button>}
            </span>
          </div>
          {note && <p className="wa-small gg-ok" role="status">{note}</p>}
          {error && <p className="hw-err">{error}</p>}
          <div className="sc-scroll">
            <table className="wa-mini gg-table">
              <thead><tr><th>Source</th><th>How often</th><th>Last run</th><th>Status</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {setup.sources.map(s => (
                  <tr key={s.key}>
                    <td><b>{s.name}</b><div className="hw-muted wa-small">{s.what}</div></td>
                    <td className="wa-small">{s.often}</td>
                    <td className="wa-small">{s.lastRunAt ? istTime(s.lastRunAt) : '—'}{s.lastOkAt && s.state === 'ok' && <div className="hw-muted">{n(s.lastCount)} rows</div>}</td>
                    <td className="wa-small"><span className="gg-check">{STATE[s.state].icon}{STATE[s.state].label}</span><div className={s.state === 'warn' ? 'kw-warn' : 'hw-muted'}>{s.state === 'warn' ? s.error : s.detail}</div></td>
                    {canEdit && <td>{s.canRun && <button type="button" className="hw-btn" disabled={!!running} onClick={() => run(s.key)}>{running === s.key ? 'Collecting…' : 'Run now'}</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hw-muted wa-small">Search Console sites and Google Ads accounts are chosen in <Link to="/google/setup">Google → Setup</Link>. Keyword Planner is asked through the Google Ads account, at most about 150 times a day.</p>
        </section>

        <Lists setup={setup} canEdit={canEdit} onSaved={s => { setSetup(s); onChanged(); }} />
      </div>

      <aside className="wa-settings">
        <section className="wa-chart-card">
          <h3 className="wa-h3">Google accounts</h3>
          {setup.googleAccounts.length === 0 ? <p className="hw-muted wa-small">No website is connected to Google yet. <Link to="/google/setup">Open Google → Setup</Link></p> : (
            <ul className="kw-list">
              {setup.googleAccounts.map(a => (
                <li key={a.site}>
                  <b>{a.name}</b>
                  <span className="wa-small hw-muted">{!a.signedIn ? 'Not signed in' : [a.hasSearchConsole ? 'Search Console ✓' : 'No Search Console', a.hasAds ? 'Google Ads ✓' : 'No Google Ads'].join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="wa-chart-card">
          <h3 className="wa-h3">Rules we follow</h3>
          <ul className="gg-notes wa-small">
            <li>No scraping of Google; positions come from Search Console.</li>
            <li>No page is made only because a keyword exists; city pages need real doctors on Doctor Dekho.</li>
            <li>Health content is written or reviewed by a named doctor.</li>
            <li>No “best doctor” claims, guarantees or testimonials; AI-assisted parts are checked and labelled.</li>
          </ul>
        </section>
        <section className="wa-chart-card">
          <h3 className="wa-h3">Who can change this</h3>
          <p className="hw-muted wa-small">People allowed to “Change keyword sources, seed lists and scoring”. Everyone who can open Keywords can see this page.</p>
        </section>
      </aside>
    </div>
  );
}

function Lists({ setup, canEdit, onSaved }: { setup: KeywordSetup; canEdit: boolean; onSaved: (s: KeywordSetup) => void }) {
  const [dd, setDd] = useState((setup.seeds.doctordekho ?? []).join(', '));
  const [ne, setNe] = useState((setup.seeds.nexeagle ?? []).join(', '));
  const [cdd, setCdd] = useState((setup.competitorSites.doctordekho ?? []).join('\n'));
  const [cne, setCne] = useState((setup.competitorSites.nexeagle ?? []).join('\n'));
  const [cities, setCities] = useState(setup.extraCities.join(', '));
  const [weights, setWeights] = useState<KeywordWeights>(setup.weights);
  const [min, setMin] = useState(String(setup.minVisitors));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const s = await keywordsService.saveSetup({
        seeds: { doctordekho: lines(dd), nexeagle: lines(ne) } as Record<Site, string[]>,
        competitorSites: { doctordekho: lines(cdd), nexeagle: lines(cne) } as Record<Site, string[]>,
        extraCities: lines(cities), weights, minVisitors: Number(min),
      });
      onSaved(s);
      setMsg({ ok: true, text: 'Saved. The next collection uses it.' });
    } catch (e) { setMsg({ ok: false, text: keywordsError(e) }); } finally { setBusy(false); }
  };
  const minOk = /^\d+$/.test(min) && Number(min) >= 5 && Number(min) <= 100;

  return (
    <>
      <section className="wa-chart-card">
        <h3 className="wa-h3">Seed lists for Keyword Planner</h3>
        <p className="hw-muted wa-small">Keyword Planner is asked for ideas from these each day, five at a time in rotation, for India: Doctor Dekho in English, Hindi and Bengali, nexeagle.com in English. Separate with commas.</p>
        <fieldset disabled={!canEdit || busy} className="kw-fs">
          <label className="wa-field"><span>Doctor Dekho: conditions, symptoms and specialties</span><textarea rows={3} value={dd} onChange={e => setDd(e.target.value)} /></label>
          <label className="wa-field"><span>nexeagle.com: products and problems they solve</span><textarea rows={3} value={ne} onChange={e => setNe(e.target.value)} /></label>
          <div className="gg-grid2">
            <label className="wa-field"><span>Sites to learn from, Doctor Dekho (one per line)</span><textarea rows={3} value={cdd} onChange={e => setCdd(e.target.value)} placeholder="[competitor site]" /></label>
            <label className="wa-field"><span>Sites to learn from, nexeagle.com (one per line)</span><textarea rows={3} value={cne} onChange={e => setCne(e.target.value)} placeholder="[competitor site]" /></label>
          </div>
          <p className="hw-muted wa-small">Keyword Planner reads these sites’ pages for ideas on Mondays. Up to 10 per website, written like example.com.</p>
          <label className="wa-field"><span>More city and area names to recognise</span><input value={cities} onChange={e => setCities(e.target.value)} placeholder="Forbesganj, Araria" /></label>
          <p className="hw-muted wa-small">Already recognised: {setup.cities.join(', ')}.</p>
        </fieldset>
      </section>

      <section className="wa-chart-card">
        <h3 className="wa-h3">How priority is worked out</h3>
        <fieldset disabled={!canEdit || busy} className="kw-fs">
          {WEIGHTS.map(w => (
            <label key={w.id} className="kw-weight">
              <span><b>{w.name}</b><span className="hw-muted wa-small">{w.note}</span></span>
              <input type="range" min={0} max={10} value={weights[w.id]} onChange={e => setWeights(cur => ({ ...cur, [w.id]: Number(e.target.value) }))} aria-label={`${w.name} weight`} />
              <b className="kw-wv">{weights[w.id]}</b>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="wa-chart-card">
        <h3 className="wa-h3">Privacy</h3>
        <fieldset disabled={!canEdit || busy} className="kw-fs">
          <label className="wa-field"><span>Show a Doctor Dekho site-search phrase once this many different visitors typed it</span>
            <input className="gg-num" inputMode="numeric" value={min} onChange={e => setMin(e.target.value)} aria-invalid={!minOk} />
          </label>
        </fieldset>
        <p className="hw-muted wa-small">Never lower than 5. Who searched is never kept here, phrases that look like a phone number or email are dropped, and doctor-name searches are left out.</p>
      </section>

      {msg && <p className={msg.ok ? 'wa-small gg-ok' : 'hw-err'} role="status">{msg.text}</p>}
      {canEdit && <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" disabled={busy || !minOk} onClick={save}>{busy ? 'Saving…' : 'Save Setup'}</button></div>}
    </>
  );
}
