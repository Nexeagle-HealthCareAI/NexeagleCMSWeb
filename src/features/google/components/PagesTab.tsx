import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { GoogleAccount, GooglePageDetail, GooglePages } from '../types';
import { googleService, googleError } from '../services/googleService';
import { ago, channelLabel, duration, pct, periodRange, PERIODS } from '../googleUtils';
import { NotChosen, Share } from './shared';

// Google → Pages: the pages visits started on (Google Analytics "landing page"), with how long people stayed and
// what they did; one page opens with how people arrived and, with Search Console, the searches that led there.

export default function PagesTab({ account }: { account: GoogleAccount }) {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<GooglePages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!account.hasAnalytics) return;
    let live = true;
    googleService.pages({ accountId: account.accountId, ...periodRange(period) })
      .then(p => { if (live) { setData(p); setError(null); setPicked(cur => cur ?? p.pages[0]?.path ?? null); } })
      .catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [account.accountId, account.hasAnalytics, period]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.pages ?? []).filter(p => !q || p.path.toLowerCase().includes(q));
  }, [data, search]);
  if (!account.hasAnalytics) return <NotChosen>No Google Analytics property is chosen for {account.name}. Choose one in Setup.</NotChosen>;

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush">
        <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label className="wa-search"><Search size={14} /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages" aria-label="Search pages" /></label>
        <span className="hw-muted wa-small">Where visits started{data ? ` · read ${ago(data.readAt)} ago` : ''}</span>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!data && !error && <p className="hw-muted">Reading from Google…</p>}
      {data && (
        <div className="gg-split">
          <div className="hw-tbl">
            {shown.length === 0 ? <p className="hw-empty">{search ? 'No page matches.' : 'No visits in this period.'}</p> : (
              <table>
                <thead><tr><th>Page</th><th className="wa-num">Visits</th><th className="wa-num">Stayed and read</th><th className="wa-num">Avg. time</th><th className="wa-num">Leads</th><th className="wa-num">WhatsApp / call</th></tr></thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.path} className={p.path === picked ? 'gg-on' : ''}>
                      <td><button type="button" className="gg-rowbtn" onClick={() => setPicked(p.path)} aria-pressed={p.path === picked}>{p.path}</button></td>
                      <td className="wa-num">{p.sessions.toLocaleString('en-IN')}</td>
                      <td className="wa-num">{pct(p.engagedSessions, p.sessions)}</td>
                      <td className="wa-num">{duration(p.avgSeconds)}</td>
                      <td className="wa-num">{p.keyEvents}</td>
                      <td className="wa-num">{p.contacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {picked && <PageDetail key={`${picked}|${period}`} account={account} period={period} path={picked} siteUrl={data.siteUrl} row={data.pages.find(p => p.path === picked)} />}
        </div>
      )}
      <p className="hw-muted wa-small">Page addresses only; nothing a visitor typed is sent to Google.</p>
    </div>
  );
}

function PageDetail({ account, period, path, siteUrl, row }: { account: GoogleAccount; period: string; path: string; siteUrl?: string | null; row?: GooglePages['pages'][number] }) {
  const [detail, setDetail] = useState<GooglePageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    googleService.page({ accountId: account.accountId, ...periodRange(period) }, path)
      .then(d => { if (live) setDetail(d); }).catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [account.accountId, period, path]);
  const total = detail?.sources.reduce((s, x) => s + x.sessions, 0) ?? 0;
  return (
    <aside className="wa-chart-card gg-detail" aria-label="Page details">
      <div>
        <b className="gg-path">{path}</b>
        {siteUrl && <div><a href={`${siteUrl}${path}`} target="_blank" rel="noreferrer" className="wa-small">Open the page</a></div>}
      </div>
      {row && (
        <dl className="gg-mini">
          <div><dt>Visits</dt><dd>{row.sessions.toLocaleString('en-IN')}</dd></div>
          <div><dt>Stayed</dt><dd>{pct(row.engagedSessions, row.sessions)}</dd></div>
          <div><dt>Leads</dt><dd>{row.keyEvents}</dd></div>
        </dl>
      )}
      {error && <p className="hw-err">{error}</p>}
      {!detail && !error && <p className="hw-muted wa-small">Reading…</p>}
      {detail && (
        <>
          <h4 className="gg-h4">How people arrived</h4>
          {detail.sources.length === 0 ? <p className="hw-muted wa-small">No visits.</p> : detail.sources.map(s => (
            <div key={s.name} className="gg-src"><div className="wa-row wa-between wa-small"><span>{channelLabel(s.name)}</span><span className="hw-muted">{pct(s.sessions, total)}</span></div><Share value={s.sessions} max={total} /></div>
          ))}
          <h4 className="gg-h4">Top searches that led here</h4>
          {!detail.searchConsoleConnected ? <p className="hw-muted wa-small">From Google Search Console, once it is chosen in Setup.</p>
            : detail.queries.length === 0 ? <p className="hw-muted wa-small">No searches recorded for this page in this period.</p>
              : detail.queries.map(q => <div key={q.key} className="gg-query wa-small"><span>{q.key}</span><span className="hw-muted">{Math.round(q.clicks)} clicks · pos. {q.position.toFixed(1)}</span></div>)}
        </>
      )}
    </aside>
  );
}
