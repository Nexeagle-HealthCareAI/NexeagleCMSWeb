import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GoogleAccount, GoogleOverview } from '../types';
import { googleService, googleError } from '../services/googleService';
import { ago, change, channelLabel, day, n, pct, periodRange } from '../googleUtils';
import { Bars } from '../../social/components/shared';
import { NotChosen, PeriodPicker, Share } from './shared';

// Google → Overview: visitors, visits and leads from Google Analytics for the chosen period, where they came from,
// tagged campaigns (also WhatsApp broadcasts and Social posts), and what visitors did on the site.

const CONTACT_EVENTS = ['whatsapp_click', 'phone_click', 'email_click'];

export default function OverviewTab({ account }: { account: GoogleAccount }) {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<GoogleOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (!account.hasAnalytics) return;
    let live = true;
    googleService.overview({ accountId: account.accountId, ...periodRange(period) })
      .then(o => { if (live) { setData(o); setError(null); } })
      .catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [account.accountId, account.hasAnalytics, period]);

  const bars = useMemo(() => (data?.days ?? []).map(d => ({ key: d.day, label: day(d.day), value: d.sessions })), [data]);
  if (!account.hasAnalytics) return <NotChosen>No Google Analytics property is chosen for {account.name}. Choose one in Setup.</NotChosen>;

  const lead = data?.events.find(e => e.isLead);
  const contacts = data?.events.filter(e => CONTACT_EVENTS.includes(e.name)).reduce((s, e) => s + e.count, 0) ?? 0;
  const usersChange = data ? change(data.users, data.previousUsers) : null;
  const topChannel = Math.max(0, ...(data?.channels ?? []).map(c => c.sessions));

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush">
        <PeriodPicker value={period} onChange={setPeriod} />
        <span className="hw-muted wa-small">From Google Analytics, refreshed every 10 minutes{data ? ` (read ${ago(data.readAt)} ago)` : ''} · only visitors who accepted tracking</span>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!data && !error && <p className="hw-muted">Reading from Google…</p>}
      {data && (
        <>
          <div className="wa-tiles">
            <div className="wa-tile"><span>Visitors</span><b>{n(data.users)}</b><span>{usersChange == null ? 'No earlier period to compare' : `${usersChange > 0 ? '+' : usersChange < 0 ? '−' : ''}${Math.abs(usersChange)}% on the period before`}</span></div>
            <div className="wa-tile"><span>Visits</span><b>{n(data.sessions)}</b><span>{pct(data.engagedSessions, data.sessions)} stayed and read</span></div>
            <div className="wa-tile"><span>{lead?.label ?? 'Leads'}</span><b>{n(data.keyEvents)}</b><span>{pct(data.keyEvents, data.sessions)} of visits</span></div>
            {contacts > 0 && <div className="wa-tile"><span>WhatsApp and call clicks</span><b>{n(contacts)}</b><span>from the site's buttons</span></div>}
            {data.ownVisits != null && <div className="wa-tile"><span>The CMS's own count</span><b>{n(data.ownVisits)}</b><span>Site Visits, all visitors</span></div>}
          </div>

          <section className="wa-chart-card">
            <div className="wa-row wa-between">
              <h3 className="wa-h3">Visits per day</h3>
              <button type="button" className="wa-link" onClick={() => setAsTable(v => !v)}>{asTable ? 'Show as chart' : 'Show as table'}</button>
            </div>
            {asTable ? (
              <div className="sc-scroll sc-daytable">
                <table className="wa-mini">
                  <thead><tr><th>Day</th><th className="wa-num">Visits</th><th className="wa-num">{lead?.label ?? 'Leads'}</th></tr></thead>
                  <tbody>{data.days.map(d => <tr key={d.day}><td>{day(d.day)}</td><td className="wa-num">{d.sessions.toLocaleString('en-IN')}</td><td className="wa-num">{d.keyEvents}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <Bars items={bars} label="Visits per day" format={v => `${v.toLocaleString('en-IN')} visits`} />}
          </section>

          <div className="gg-two">
            <section className="wa-chart-card">
              <h3 className="wa-h3">Where visitors came from</h3>
              {data.channels.length === 0 ? <p className="hw-empty">No visits in this period.</p> : (
                <div className="sc-scroll">
                  <table className="wa-mini gg-table">
                    <thead><tr><th>Channel</th><th className="wa-num">Visits</th><th className="wa-num">Leads</th><th className="wa-num">Rate</th></tr></thead>
                    <tbody>
                      {data.channels.map(c => (
                        <tr key={c.name}>
                          <td><b>{channelLabel(c.name)}</b><Share value={c.sessions} max={topChannel} /></td>
                          <td className="wa-num">{c.sessions.toLocaleString('en-IN')}</td>
                          <td className="wa-num">{c.keyEvents}</td>
                          <td className="wa-num">{pct(c.keyEvents, c.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="wa-chart-card">
              <div className="wa-row wa-between">
                <h3 className="wa-h3">Campaigns (from link tags)</h3>
                {account.hasAds && <Link to="/google/ads" className="wa-small">Google Ads spend</Link>}
              </div>
              {data.campaigns.length === 0 ? <p className="hw-empty">No tagged links were visited in this period.</p> : (
                <div className="sc-scroll">
                  <table className="wa-mini gg-table">
                    <thead><tr><th>Campaign</th><th>Source</th><th className="wa-num">Visits</th><th className="wa-num">Leads</th></tr></thead>
                    <tbody>{data.campaigns.map(c => <tr key={`${c.name}|${c.sourceMedium}`}><td><b>{c.name}</b></td><td className="hw-muted">{c.sourceMedium}</td><td className="wa-num">{c.sessions.toLocaleString('en-IN')}</td><td className="wa-num">{c.keyEvents}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <p className="hw-muted wa-small">Links from WhatsApp broadcasts and Social posts carry campaign tags, so they show up here by name.</p>
            </section>
          </div>

          <section className="wa-chart-card">
            <h3 className="wa-h3">What visitors did</h3>
            <div className="wa-tiles gg-events">
              {data.events.map(e => <div key={e.name} className="wa-tile"><span>{e.label}</span><b>{n(e.count)}</b>{e.isLead && <span>counted as a lead</span>}</div>)}
            </div>
          </section>
          <p className="hw-muted wa-small">“Leads” are {lead ? `${lead.label.toLowerCase()}` : 'the actions counted as leads'} on the site. Google Analytics counts only visitors who accepted tracking in the site's banner, so it is lower than the CMS's own Site Visits count. Nothing that identifies a person, and no health details, is sent to Google.</p>
        </>
      )}
    </div>
  );
}
