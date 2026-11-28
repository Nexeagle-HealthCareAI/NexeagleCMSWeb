import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import type { KeywordOverview, Site } from '../types';
import { keywordsService, keywordsError } from '../services/keywordsService';
import { OPPORTUNITIES, change, istTime, langLabel, n, pos, short, signed } from '../keywordUtils';
import { Empty, OppTag, SiteTag, SourceList } from './shared';
import { Share } from '../../google/components/shared';

// Keywords → Overview: how much search demand shows us, the best opportunities today (topics first), demand by
// language, what is rising this week, and how this morning's collection went.

const STATE_ICON = {
  ok: <CheckCircle2 size={15} className="wa-ck-ok" aria-label="Collected" />,
  warn: <AlertTriangle size={15} className="wa-ck-warn" aria-label="Needs attention" />,
  off: <Circle size={15} className="wa-ck-todo" aria-label="Not yet" />,
};

export default function OverviewTab({ site }: { site: Site | '' }) {
  const [data, setData] = useState<KeywordOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    keywordsService.overview(site)
      .then(o => { if (live) { setData(o); setError(null); } })
      .catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [site]);

  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!data) return <p className="hw-muted wa-pad">Loading…</p>;

  const shown = change(data.impressions, data.previousImpressions);
  const posMove = data.position != null && data.previousPosition != null ? Math.round((data.previousPosition - data.position) * 10) / 10 : null;
  const langTotal = data.languages.reduce((s, l) => s + Math.max(l.searches, l.impressions), 0);
  const nonEnglish = data.languages.filter(l => l.language !== 'en').reduce((s, l) => s + Math.max(l.searches, l.impressions), 0);
  const live = data.sources.filter(s => s.state !== 'off');

  return (
    <div className="wa-pad">
      <div className="wa-tiles">
        <div className="wa-tile"><span>Keywords tracked</span><b>{n(data.tracked)}</b><span>{n(data.newThisWeek)} new this week</span></div>
        <div className="wa-tile"><span>Times we showed in Google (28 days)</span><b>{short(data.impressions)}</b><span>{shown == null ? 'No earlier period yet' : `${signed(shown)} on the 28 days before`}</span></div>
        <div className="wa-tile"><span>Clicks from Google search</span><b>{short(data.clicks)}</b><span>{data.impressions > 0 ? `${((data.clicks * 100) / data.impressions).toFixed(1)}% of showings` : 'No showings yet'}</span></div>
        <div className="wa-tile"><span>Average position</span><b>{pos(data.position)}</b><span>{posMove == null ? 'From Search Console' : posMove > 0 ? `${posMove} places higher` : posMove < 0 ? `${-posMove} places lower` : 'Same as before'}</span></div>
        <div className="wa-tile"><span>Content</span><b>{data.published} published</b><span>{data.inProgress} in progress · {data.topicsWithPlan} topics planned</span></div>
      </div>

      <section className="wa-chart-card">
        <div className="wa-row wa-between">
          <h3 className="wa-h3">Best opportunities today</h3>
          <Link to="/keywords/topics" className="wa-small">All topics</Link>
        </div>
        {data.opportunities.length === 0 ? <Empty>Nothing stands out yet. Opportunities appear once a few days of Search Console and Keyword Planner data are in.</Empty> : (
          <div className="kw-opps">
            {data.opportunities.map(o => (
              <article key={`${o.topicId ?? o.keywordId}-${o.kind}`} className="kw-oppcard">
                <div className="wa-row kw-gap6"><OppTag kind={o.kind} /><SiteTag site={o.site} /><span className="kw-score" title="Priority, 0 to 100">{o.score}</span></div>
                <b className="kw-opptitle">{o.title}</b>
                {o.keywords.length > 0 && <span className="hw-muted wa-small kw-clip">{o.keywords.join(' · ')}</span>}
                <p className="wa-small kw-why">{o.why}</p>
                <Link className="hw-btn kw-oppbtn" to={o.topicId ? `/keywords/topics?topic=${o.topicId}` : `/keywords/keywords?keyword=${o.keywordId}`}>{OPPORTUNITIES[o.kind]?.action ?? 'Open'}</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="gg-two">
        <section className="wa-chart-card">
          <h3 className="wa-h3">Demand by language</h3>
          {data.languages.length === 0 ? <Empty>No keywords yet.</Empty> : (
            <>
              <table className="wa-mini gg-table">
                <thead><tr><th>Language</th><th className="wa-num">Searches a month</th><th className="wa-num">Showed us (28 d)</th></tr></thead>
                <tbody>
                  {data.languages.map(l => (
                    <tr key={l.language}>
                      <td><b>{langLabel(l.language)}</b><Share value={Math.max(l.searches, l.impressions)} max={langTotal} /></td>
                      <td className="wa-num">{n(l.searches)}</td>
                      <td className="wa-num">{n(l.impressions)}{l.visitors > 0 && <div className="hw-muted wa-small">+{n(l.visitors)} site searches</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {langTotal > 0 && nonEnglish > 0 && <p className="hw-muted wa-small">{Math.round((nonEnglish * 100) / langTotal)}% of the demand is in Hinglish, Hindi or Bengali.</p>}
            </>
          )}
        </section>
        <section className="wa-chart-card">
          <h3 className="wa-h3">Rising this week</h3>
          {data.rising.length === 0 ? <Empty>Nothing is rising sharply this week.</Empty> : (
            <ul className="kw-list">
              {data.rising.map(r => (
                <li key={r.keywordId}>
                  <div><Link to={`/keywords/keywords?keyword=${r.keywordId}`} className="kw-strong">{r.text}</Link><div><SourceList sources={r.sources} /></div></div>
                  <span className="kw-up">{signed(r.changePercent)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="wa-chart-card">
        <div className="wa-row wa-between">
          <h3 className="wa-h3">This morning’s collection</h3>
          <Link to="/keywords/setup" className="wa-small">Sources</Link>
        </div>
        <ul className="kw-list">
          {live.map(s => (
            <li key={s.key}>
              <div className="wa-row kw-gap6">{STATE_ICON[s.state]}<b>{s.name}</b></div>
              <span className={`wa-small ${s.state === 'warn' ? 'kw-warn' : 'hw-muted'}`}>{s.state === 'warn' ? s.error ?? s.detail : `${s.detail ?? ''}${s.lastOkAt ? ` · ${istTime(s.lastOkAt)}` : ''}`}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="hw-muted wa-small">Positions and clicks come from Search Console, monthly searches from Google Keyword Planner (India). Doctor Dekho’s own searches show only phrases typed by at least 5 different visitors, never who typed them.</p>
    </div>
  );
}
