import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { waService, waError } from '../services/waService';
import type { WaMetaSpendDay, WaSpend, WaSpendDay } from '../types';
import { money } from '../waUtils';

// What WhatsApp cost: per day, per kind of message and per broadcast, against the monthly budget.
// Our figures come from Meta's delivery reports (charged when delivered); Meta's own daily figures sit beside
// them, as Meta's invoice is what counts. GST is on top of both.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const RANGES = [
  { id: 'month', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
] as const;
type Range = (typeof RANGES)[number]['id'];

const rangeOf = (r: Range, now = new Date()): [string, string] => {
  const y = now.getFullYear(), m = now.getMonth();
  if (r === 'month') return [iso(new Date(Date.UTC(y, m, 1))), iso(now)];
  if (r === 'last') return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
  return [iso(new Date(now.getTime() - (Number(r) - 1) * 86_400_000)), iso(now)];
};

const SERIES: { key: keyof Pick<WaSpendDay, 'marketing' | 'utility' | 'authentication'>; label: string; cls: string }[] = [
  { key: 'marketing', label: 'Marketing', cls: 'wa-s1' },
  { key: 'utility', label: 'Utility', cls: 'wa-s2' },
  { key: 'authentication', label: 'Authentication', cls: 'wa-s3' },
];

export default function BillingTab() {
  const [range, setRange] = useState<Range>('month');
  const [spend, setSpend] = useState<WaSpend | null>(null);
  const [meta, setMeta] = useState<WaMetaSpendDay[] | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const [from, to] = rangeOf(range);

  useEffect(() => {
    let live = true;
    waService.spend(from, to).then(s => { if (live) { setSpend(s); setError(null); } }).catch(e => { if (live) setError(waError(e)); });
    return () => { live = false; };
  }, [from, to]);

  const [metaVersion, setMetaVersion] = useState(0);
  const loadMeta = () => { setMeta(null); setMetaError(null); setMetaVersion(v => v + 1); };
  useEffect(() => {
    let live = true;
    waService.metaSpend(from, to)
      .then(m => { if (live) { setMeta(m); setMetaError(null); } })
      .catch(e => { if (live) setMetaError(waError(e)); });
    return () => { live = false; };
  }, [from, to, metaVersion]);

  const max = useMemo(() => Math.max(0.01, ...(spend?.days ?? []).map(d => d.total)), [spend]);
  const metaTotal = (meta ?? []).reduce((s, x) => s + x.cost, 0);
  const cur = spend?.currency ?? 'INR';
  const budget = spend?.monthlyBudget ?? null;
  const used = spend ? spend.spentThisMonth + spend.committed : 0;
  const usedPct = budget ? Math.min(100, (used / budget) * 100) : 0;
  const shownSeries = SERIES.filter(s => (spend?.days ?? []).some(d => d[s.key] > 0));

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush">
        <div className="wa-pills" role="tablist" aria-label="Period">
          {RANGES.map(r => <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={`wa-pill${range === r.id ? ' on' : ''}`} onClick={() => setRange(r.id)}>{r.label}</button>)}
        </div>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!spend && !error && <p className="hw-muted">Loading…</p>}
      {spend && (
        <>
          <div className="wa-tiles">
            <div className="wa-tile"><span>Spent in this period</span><b>{money(spend.total, cur)}</b><small className="hw-muted">GST extra</small></div>
            <div className="wa-tile">
              <span>This month</span>
              <b>{money(spend.spentThisMonth, cur)}</b>
              <small className="hw-muted">{spend.committed > 0 ? `+ ${money(spend.committed, cur)} planned in broadcasts` : 'nothing more planned'}</small>
            </div>
            <div className="wa-tile">
              <span>Monthly budget</span>
              <b>{budget ? money(budget, cur) : 'Not set'}</b>
              {budget ? (
                <div className="wa-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)} aria-label="Budget used">
                  <div className={`wa-meter-fill${usedPct >= 100 ? ' over' : usedPct >= 80 ? ' near' : ''}`} style={{ width: `${usedPct}%` }} />
                </div>
              ) : <small className="hw-muted">Set one in Settings</small>}
              {budget ? <small className="hw-muted">{Math.round(usedPct)}% used or planned</small> : null}
            </div>
            <div className="wa-tile">
              <span>Messages charged / free</span>
              <b>{spend.days.reduce((s, d) => s + d.charged, 0)} / {spend.days.reduce((s, d) => s + d.free, 0)}</b>
              <small className="hw-muted">replies inside 24 h are free</small>
            </div>
          </div>

          <section className="wa-chart-card">
            <div className="wa-row wa-between">
              <h3 className="wa-h3">Spend per day</h3>
              <button type="button" className="wa-link" onClick={() => setAsTable(t => !t)}>{asTable ? 'Show chart' : 'Show as table'}</button>
            </div>
            {shownSeries.length > 1 && (
              <div className="wa-legend">{shownSeries.map(s => <span key={s.key}><i className={s.cls} /> {s.label}</span>)}</div>
            )}
            {spend.total === 0 ? <p className="hw-muted">Nothing charged in this period.</p> : asTable ? (
              <div className="hw-tbl">
                <table>
                  <thead><tr><th>Day</th>{SERIES.map(s => <th key={s.key}>{s.label}</th>)}<th>Total</th><th>Charged</th><th>Free</th></tr></thead>
                  <tbody>{spend.days.filter(d => d.total > 0 || d.free > 0).map(d => (
                    <tr key={d.date} className="hw-static"><td>{d.date}</td>{SERIES.map(s => <td key={s.key}>{money(d[s.key], cur)}</td>)}<td>{money(d.total, cur)}</td><td>{d.charged}</td><td>{d.free}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <div className="wa-bars" role="img" aria-label={`Spend per day, highest ${money(max, cur)}`}>
                {spend.days.map(d => (
                  <div key={d.date} className="wa-bar-col" tabIndex={0}>
                    <div className="wa-bar-stack" style={{ height: `${(d.total / max) * 100}%` }}>
                      {SERIES.filter(s => d[s.key] > 0).map(s => <div key={s.key} className={s.cls} style={{ flexGrow: d[s.key] }} />)}
                    </div>
                    <div className="wa-tip" role="tooltip">
                      <b>{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b>
                      {SERIES.filter(s => d[s.key] > 0).map(s => <span key={s.key}>{s.label}: {money(d[s.key], cur)}</span>)}
                      <span>Total: {money(d.total, cur)} · {d.charged} charged, {d.free} free</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!asTable && spend.total > 0 && (
              <div className="wa-axis"><span>{spend.days[0]?.date}</span><span>highest day {money(max, cur)}</span><span>{spend.days[spend.days.length - 1]?.date}</span></div>
            )}
          </section>

          <div className="wa-grid2">
            <section className="wa-chart-card">
              <h3 className="wa-h3">By kind of message</h3>
              {Object.keys(spend.byCategory).length === 0 ? <p className="hw-muted">Nothing yet.</p> : (
                <table className="wa-mini">
                  <tbody>{Object.entries(spend.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <tr key={k}><td>{k[0].toUpperCase() + k.slice(1)}</td><td className="wa-num">{money(v, cur)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="wa-chart-card">
              <h3 className="wa-h3">By broadcast</h3>
              {spend.byBroadcast.length === 0 ? <p className="hw-muted">No broadcasts charged in this period.</p> : (
                <table className="wa-mini">
                  <thead><tr><th>Broadcast</th><th className="wa-num">Delivered</th><th className="wa-num">Cost</th></tr></thead>
                  <tbody>{spend.byBroadcast.map(b => (
                    <tr key={b.broadcastId}><td>{b.name}</td><td className="wa-num">{b.delivered}</td><td className="wa-num">{money(b.cost, cur)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>

          <section className="wa-chart-card">
            <div className="wa-row wa-between">
              <h3 className="wa-h3">Meta's own figures</h3>
              <button type="button" className="hw-btn" onClick={loadMeta}><RefreshCw size={13} /> Refresh</button>
            </div>
            {metaError && <p className="hw-muted">{metaError}</p>}
            {meta == null && !metaError && <p className="hw-muted">Asking Meta…</p>}
            {meta && (
              <>
                <p className="wa-small">
                  Meta: <b>{money(metaTotal, cur)}</b> · ours: <b>{money(spend.total, cur)}</b>
                  {Math.abs(metaTotal - spend.total) > 0.5 && <span className="hw-muted"> · Meta's figures can lag by a day and decide the invoice.</span>}
                </p>
                {meta.length > 0 && (
                  <table className="wa-mini">
                    <thead><tr><th>Day</th><th>Kind</th><th className="wa-num">Messages</th><th className="wa-num">Cost</th></tr></thead>
                    <tbody>{meta.map((m, i) => (
                      <tr key={i}><td>{m.date}</td><td>{m.category.toLowerCase()}</td><td className="wa-num">{m.volume}</td><td className="wa-num">{money(m.cost, cur)}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
