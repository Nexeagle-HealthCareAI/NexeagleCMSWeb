import { useEffect, useMemo, useState } from 'react';
import type { AdLevel, SocialAccount, SocialAds } from '../types';
import { socialService, socialError } from '../services/socialService';
import { ago, change, day, money, n, pct, ymd } from '../socialUtils';
import { Bars } from './shared';

// Social → Ads: spend, leads and cost per lead from Meta's ad account (read every 3 hours), by campaign, ad set
// or ad. Ads are made and changed in Meta Ads Manager; the CMS only reads them and links each lead to its ad.

const PERIODS = [
  { id: 'this', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: '90', label: 'Last 90 days' },
];
const range = (id: string): { from: string; to: string } => {
  const now = new Date();
  if (id === 'this') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  if (id === 'last') return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  return { from: ymd(new Date(now.getTime() - 89 * 86_400_000)), to: ymd(now) };
};
const LEVELS: { id: AdLevel; label: string; name: string }[] = [
  { id: 'campaign', label: 'Campaigns', name: 'Campaign' }, { id: 'adset', label: 'Ad sets', name: 'Ad set' }, { id: 'ad', label: 'Ads', name: 'Ad' },
];

export default function AdsTab({ account }: { account: SocialAccount }) {
  const [period, setPeriod] = useState('this');
  const [level, setLevel] = useState<AdLevel>('campaign');
  const [ads, setAds] = useState<SocialAds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    let live = true;
    socialService.ads({ accountId: account.accountId, ...range(period), level })
      .then(a => { if (live) { setAds(a); setError(null); } })
      .catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [account.accountId, period, level]);

  const bars = useMemo(() => (ads?.days ?? []).map(d => ({ key: d.day, label: day(d.day), value: d.spend })), [ads]);
  if (!account.adAccountId) return <p className="hw-muted wa-pad">No ad account is chosen for {account.name}. Choose one in Setup.</p>;
  const cur = ads?.currency ?? account.currency;
  const cplChange = ads?.costPerLead != null ? change(ads.costPerLead, ads.previousCostPerLead) : null;
  const levelName = LEVELS.find(l => l.id === level)!.name;

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush">
        <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span className="hw-muted wa-small">From Meta's ad account, read every 3 hours{ads?.syncedAt ? ` (last ${ago(ads.syncedAt)} ago)` : ''}. Amounts before GST.</span>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!ads && !error && <p className="hw-muted">Loading…</p>}
      {ads && (
        <>
          <div className="wa-tiles">
            <div className="wa-tile"><span>Spend</span><b>{money(ads.spend, cur)}</b></div>
            <div className="wa-tile"><span>Leads</span><b>{ads.leads}</b><span>{ads.conversations ? `plus ${ads.conversations} conversations started` : 'from lead forms'}</span></div>
            <div className="wa-tile"><span>Cost per lead</span><b>{money(ads.costPerLead, cur)}</b><span>{cplChange == null ? 'No earlier period to compare' : `${cplChange > 0 ? '+' : cplChange < 0 ? '−' : ''}${Math.abs(cplChange)}% on the period before`}</span></div>
            <div className="wa-tile"><span>Clicks</span><b>{ads.clicks.toLocaleString('en-IN')}</b><span>{pct(ads.clicks, ads.impressions)} of {n(ads.impressions)} impressions</span></div>
            <div className="wa-tile"><span>Leads that became customers</span><b>{ads.customers}</b><span>from the CRM</span></div>
          </div>

          <section className="wa-chart-card">
            <div className="wa-row wa-between">
              <h3 className="wa-h3">Spend per day</h3>
              <button type="button" className="wa-link" onClick={() => setAsTable(v => !v)}>{asTable ? 'Show as chart' : 'Show as table'}</button>
            </div>
            {asTable ? (
              <div className="sc-scroll sc-daytable">
                <table className="wa-mini">
                  <thead><tr><th>Day</th><th className="wa-num">Spend</th><th className="wa-num">Leads</th></tr></thead>
                  <tbody>{ads.days.map(d => <tr key={d.day}><td>{day(d.day)}</td><td className="wa-num">{money(d.spend, cur)}</td><td className="wa-num">{d.leads}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <Bars items={bars} label="Spend per day" format={v => money(v, cur)} />}
          </section>

          <div className="sc-seg" role="group" aria-label="Level">
            {LEVELS.map(l => <button key={l.id} type="button" className={level === l.id ? 'on' : ''} aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.label}</button>)}
          </div>
          {ads.rows.length === 0 ? <p className="hw-empty">No ad spend in this period.</p> : (
            <div className="hw-tbl">
              <table className="sc-ads">
                <thead><tr><th>{levelName}</th><th>Status</th><th className="wa-num">Spend</th><th className="wa-num">Impressions</th><th className="wa-num">Clicks</th><th className="wa-num">Leads</th><th className="wa-num">Cost per lead</th></tr></thead>
                <tbody>
                  {[...ads.rows].sort((a, b) => b.spend - a.spend).map(r => (
                    <tr key={r.id}>
                      <td><b>{r.name}</b>{r.parentName && <div className="hw-muted wa-small">{r.parentName}</div>}</td>
                      <td>{r.status ? <span className={`wa-st ${r.status === 'ACTIVE' ? 'wa-st-ok' : ''}`}>{r.status === 'ACTIVE' ? 'Active' : r.status === 'PAUSED' ? 'Paused' : r.status.toLowerCase()}</span> : '—'}</td>
                      <td className="wa-num">{money(r.spend, cur)}</td>
                      <td className="wa-num">{r.impressions.toLocaleString('en-IN')}</td>
                      <td className="wa-num">{r.clicks.toLocaleString('en-IN')}</td>
                      <td className="wa-num">{r.leads}</td>
                      <td className="wa-num">{money(r.costPerLead, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hw-muted wa-small">Ads are made and changed in Meta Ads Manager; the CMS reads them and links each lead to its ad.</p>
        </>
      )}
    </div>
  );
}
