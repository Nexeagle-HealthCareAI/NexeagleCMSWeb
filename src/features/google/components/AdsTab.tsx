import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdsLevel, GoogleAccount, GoogleAds } from '../types';
import { googleService, googleError } from '../services/googleService';
import { ago, change, day, money, n, pct, periodRange } from '../googleUtils';
import { Bars } from '../../social/components/shared';
import { NotChosen } from './shared';

// Google → Ads: spend, clicks and cost per lead from Google Ads, with leads and customers counted from the CRM, and
// the same numbers for Meta (Social) beside it. Campaigns, keywords and budgets are changed in Google Ads.

const PERIODS = [
  { id: 'this', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: '90', label: 'Last 90 days' },
];
const LEVELS: { id: AdsLevel; label: string; name: string }[] = [
  { id: 'campaign', label: 'Campaigns', name: 'Campaign' }, { id: 'adgroup', label: 'Ad groups', name: 'Ad group' },
  { id: 'keyword', label: 'Keywords', name: 'Keyword' }, { id: 'search', label: 'Search terms', name: 'What people searched' },
];
const ON = new Set(['Active', 'Added']);

export default function AdsTab({ account }: { account: GoogleAccount }) {
  const [period, setPeriod] = useState('this');
  const [level, setLevel] = useState<AdsLevel>('campaign');
  const [ads, setAds] = useState<GoogleAds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (!account.hasAds) return;
    let live = true;
    googleService.ads({ accountId: account.accountId, ...periodRange(period), level })
      .then(a => { if (live) { setAds(a); setError(null); } })
      .catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [account.accountId, account.hasAds, period, level]);

  const bars = useMemo(() => (ads?.days ?? []).map(d => ({ key: d.day, label: day(d.day), value: d.spend })), [ads]);
  if (!account.hasAds) return <NotChosen>No Google Ads account is chosen for {account.name}. Choose one in Setup.</NotChosen>;
  const cur = ads?.currency ?? account.currency;
  const cplChange = ads?.costPerLead != null ? change(ads.costPerLead, ads.previousCostPerLead) : null;
  const levelName = LEVELS.find(l => l.id === level)!.name;
  const google = ads?.platforms.find(p => p.platform === 'google');
  const meta = ads?.platforms.find(p => p.platform === 'meta');

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush">
        <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span className="hw-muted wa-small">From Google Ads, refreshed every 10 minutes{ads ? ` (read ${ago(ads.readAt)} ago)` : ''}. Amounts before GST.</span>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!ads && !error && <p className="hw-muted">Reading from Google…</p>}
      {ads && (
        <>
          <div className="wa-tiles">
            <div className="wa-tile"><span>Spend</span><b>{money(ads.spend, cur)}</b><span>{ads.dailyBudgets != null ? `daily budgets ${money(ads.dailyBudgets, cur)} in all` : 'no budget read'}</span></div>
            <div className="wa-tile"><span>Clicks</span><b>{ads.clicks.toLocaleString('en-IN')}</b><span>{pct(ads.clicks, ads.impressions)} of {n(ads.impressions)} times shown</span></div>
            <div className="wa-tile"><span>Leads</span><b>{ads.crmLeads}</b><span>website forms {ads.webLeads} · lead forms {ads.formLeads}</span></div>
            <div className="wa-tile"><span>Cost per lead</span><b>{money(ads.costPerLead, cur)}</b><span>{cplChange == null ? 'No earlier period to compare' : `${cplChange > 0 ? '+' : cplChange < 0 ? '−' : ''}${Math.abs(cplChange)}% on the period before`}</span></div>
            <div className="wa-tile"><span>Leads that became customers</span><b>{ads.customers}</b><span>from the CRM{google?.costPerCustomer != null ? ` · ${money(google.costPerCustomer, cur)} each` : ''}</span></div>
          </div>

          {google && (
            <section className="wa-chart-card">
              <div className="wa-row wa-between">
                <h3 className="wa-h3">Google and Meta, same period</h3>
                <Link to="/social/ads" className="wa-small">Meta ads in Social</Link>
              </div>
              <div className="sc-scroll">
                <table className="wa-mini gg-table">
                  <thead><tr><th>Platform</th><th className="wa-num">Spend</th><th className="wa-num">Leads</th><th className="wa-num">Cost per lead</th><th className="wa-num">Reached demo</th><th className="wa-num">Customers</th><th className="wa-num">Cost per customer</th></tr></thead>
                  <tbody>
                    {[google, meta].filter(Boolean).map(p => (
                      <tr key={p!.platform}>
                        <td><span className="gg-plat"><i className={`sc-dot ${p!.platform === 'google' ? 'gg-ads' : 'sc-ig'}`} />{p!.platform === 'google' ? 'Google Ads' : 'Meta (Facebook, Instagram)'}</span></td>
                        <td className="wa-num">{money(p!.spend, cur)}</td>
                        <td className="wa-num">{p!.leads}</td>
                        <td className="wa-num">{money(p!.costPerLead, cur)}</td>
                        <td className="wa-num">{p!.reachedDemo}</td>
                        <td className="wa-num">{p!.customers}</td>
                        <td className="wa-num">{money(p!.costPerCustomer, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hw-muted wa-small">{meta ? 'Cost per customer counts CRM leads that reached “Closed Won”, so it shows which platform brings paying customers, not just form fills.' : 'Meta shows here once a Social account with the same name has an ad account.'}</p>
            </section>
          )}

          <section className="wa-chart-card">
            <div className="wa-row wa-between">
              <h3 className="wa-h3">Spend per day</h3>
              <button type="button" className="wa-link" onClick={() => setAsTable(v => !v)}>{asTable ? 'Show as chart' : 'Show as table'}</button>
            </div>
            {asTable ? (
              <div className="sc-scroll sc-daytable">
                <table className="wa-mini">
                  <thead><tr><th>Day</th><th className="wa-num">Spend</th></tr></thead>
                  <tbody>{ads.days.map(d => <tr key={d.day}><td>{day(d.day)}</td><td className="wa-num">{money(d.spend, cur)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <Bars items={bars} label="Spend per day" format={v => money(v, cur)} />}
          </section>

          <div className="hw-bar wa-bar wa-flush">
            <div className="sc-seg" role="group" aria-label="Level">
              {LEVELS.map(l => <button key={l.id} type="button" className={level === l.id ? 'on' : ''} aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.label}</button>)}
            </div>
            {level === 'search' && <span className="hw-muted wa-small">Searches that spent money but brought no lead are worth adding as negative keywords in Google Ads.</span>}
          </div>
          {ads.rows.length === 0 ? <p className="hw-empty">No ad spend in this period.</p> : (
            <div className="hw-tbl">
              <table>
                <thead><tr><th>{levelName}</th><th>Status</th><th className="wa-num">Spend</th><th className="wa-num">Clicks</th><th className="wa-num">{level === 'campaign' ? 'Leads (CRM)' : 'Conversions'}</th><th className="wa-num">Cost per lead</th></tr></thead>
                <tbody>
                  {[...ads.rows].sort((a, b) => b.spend - a.spend).map(r => {
                    const leads = level === 'campaign' ? r.crmLeads ?? 0 : r.conversions;
                    const cpl = level === 'campaign' ? r.costPerLead : leads > 0 ? r.spend / leads : null;
                    return (
                      <tr key={r.id}>
                        <td><b>{r.name}</b>{r.sub && <div className="hw-muted wa-small">{r.sub}</div>}</td>
                        <td>{r.status ? <span className={`wa-st ${ON.has(r.status) ? 'wa-st-ok' : ''}`}>{r.status}</span> : '—'}</td>
                        <td className="wa-num">{money(r.spend, cur)}</td>
                        <td className="wa-num">{r.clicks.toLocaleString('en-IN')}</td>
                        <td className="wa-num">{Math.round(leads * 10) / 10}</td>
                        <td className="wa-num">{money(cpl ?? null, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="hw-muted wa-small">Campaigns, keywords and budgets are changed in Google Ads; the CMS reads them and links each lead to its campaign and keyword.</p>
        </>
      )}
    </div>
  );
}
