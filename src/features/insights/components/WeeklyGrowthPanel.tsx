import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { InsightsExplainer } from './InsightsExplainer';
import { channelInsights, shortDay, type WeeklyGrowth } from '../services/channelInsights';
import { istDaysAgo, todayIst } from '../utils/istDate';

const PERIODS = [8, 12, 26, 52] as const;
type Period = typeof PERIODS[number] | 'custom';

// One colour per channel, the same everywhere on this page.
export const CHANNEL_COLOURS = { whatsapp: '#16a34a', doctordekho: '#2563eb', nexeagle: '#7c3aed' } as const;

const LINES = [
    { key: 'whatsapp', dataKey: 'whatsapp', name: 'WhatsApp bot (people)', colour: CHANNEL_COLOURS.whatsapp },
    { key: 'doctordekho', dataKey: 'doctordekho', name: 'Doctor Dekho (visits)', colour: CHANNEL_COLOURS.doctordekho },
    { key: 'nexeagle', dataKey: 'nexeagle', name: 'nexeagle.com (visits)', colour: CHANNEL_COLOURS.nexeagle },
] as const;
type LineKey = typeof LINES[number]['key'];

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));

/** Change from the last full week to the one before it (values of full weeks only). */
function change(values: (number | null)[]): string | null {
    const full = values.filter((v): v is number => v != null);
    if (full.length < 2) return null;
    const [before, last] = full.slice(-2);
    if (before === 0) return last > 0 ? 'new this week' : null;
    const pct = Math.round(((last - before) / before) * 100);
    return `${pct > 0 ? '+' : ''}${pct}% on the week before`;
}

/** Week by week: people on the WhatsApp bot, visits to Doctor Dekho and to nexeagle.com. */
export const WeeklyGrowthPanel: React.FC = () => {
    const [weeks, setWeeks] = useState<Period>(12);
    const [growth, setGrowth] = useState<WeeklyGrowth | null>(null);
    const [failed, setFailed] = useState(false);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    // A chosen range: every week (Monday to Sunday) with a day in it, up to two years.
    const [customFrom, setCustomFrom] = useState(istDaysAgo(90));
    const [customTo, setCustomTo] = useState(todayIst());
    const custom = weeks === 'custom';
    const ready = !custom || Boolean(customFrom && customTo);
    const asked = custom ? `${customFrom}|${customTo}` : String(weeks);
    const [hidden, setHidden] = useState<LineKey[]>([]);

    useEffect(() => {
        if (!ready) return;
        let alive = true;
        const key = custom ? `${customFrom}|${customTo}` : String(weeks);
        (custom ? channelInsights.weeklyGrowth(0, customFrom, customTo) : channelInsights.weeklyGrowth(weeks as number))
            .then(g => { if (alive) { setGrowth(g); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); })
            .finally(() => { if (alive) setLoadedFor(key); });
        return () => { alive = false; };
    }, [weeks, custom, customFrom, customTo, ready]);
    const loading = loadedFor !== asked;

    const data = useMemo(() => (growth?.weeks ?? []).map(w => ({
        label: shortDay(w.weekStart) + (w.isPartial ? ' (so far)' : ''),
        weekStart: w.weekStart,
        whatsapp: w.whatsAppPeople,
        doctordekho: w.doctorDekhoVisits,
        nexeagle: w.nexeagleVisits,
        isPartial: w.isPartial,
    })), [growth]);
    // The week in progress would make every line dip at the end; it is in the cards and the table instead.
    const chartData = useMemo(() => data.filter(d => !d.isPartial), [data]);

    const running = data.length > 0 && data[data.length - 1].isPartial ? data[data.length - 1] : null;
    const summary = LINES.map(l => ({
        ...l,
        last: chartData.length > 0 ? chartData[chartData.length - 1][l.dataKey] : null,
        thisWeek: running ? running[l.dataKey] : null,
        change: change(chartData.map(d => d[l.dataKey])),
    }));

    const toggle = (key: LineKey) => setHidden(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>One line per channel, one point per week</strong> (Monday to Sunday, India time). The
                    WhatsApp line counts <em>different phone numbers</em> that wrote to the bot that week. The two
                    website lines count <em>visits</em>: one browsing session each, with search engines and other
                    bots left out. The week in progress is not drawn, so the lines don't dip at the end.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="How many weeks">
                    {PERIODS.map(p => (
                        <button key={p} className={`insights-filter-btn ${weeks === p ? 'active' : ''}`} onClick={() => setWeeks(p)}>
                            {p} weeks
                        </button>
                    ))}
                    <button className={`insights-filter-btn ${custom ? 'active' : ''}`} onClick={() => setWeeks('custom')}>Custom</button>
                </div>
                {custom && (
                    <>
                        <input type="date" value={customFrom} max={customTo || todayIst()} onChange={e => setCustomFrom(e.target.value)} className="insights-date-input" aria-label="From" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} min={customFrom || undefined} max={todayIst()} onChange={e => setCustomTo(e.target.value)} className="insights-date-input" aria-label="To" />
                        <span className="insights-card-note" style={{ margin: 0 }}>Whole weeks, Monday to Sunday · up to 2 years</span>
                    </>
                )}
            </div>

            {!ready ? <div className="insights-empty">Pick a start and end date.</div> : loading && !growth ? <div className="insights-empty">Loading…</div> : failed || !growth ? (
                <div className="insights-empty">Could not load the weekly figures. Try again in a moment.</div>
            ) : (
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    {!growth.whatsAppAvailable && (
                        <p className="insights-warning" role="status">
                            The WhatsApp line is missing: the CMS could not read the WhatsApp bot's database. {growth.whatsAppProblem}
                        </p>
                    )}

                    <div className="insights-stat-grid">
                        {summary.map(s => (
                            <div key={s.key} className="insights-stat-card insights-channel-card" style={{ borderTopColor: s.colour }}>
                                <div className="insights-stat-value">{fmt(s.last as number | null)}</div>
                                <div className="insights-stat-label">{s.name}, last full week</div>
                                <div className="insights-channel-sub">
                                    {s.change && <span>{s.change}</span>}
                                    {running && <span>This week so far: {fmt(s.thisWeek as number | null)}</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="insights-mini-table-card">
                        <h3 className="insights-mini-table-title"><TrendingUp size={14} className="insights-title-icon" />Growth by week</h3>
                        <div className="insights-growth-chart" role="img" aria-label={custom ? `People and visits per week, ${customFrom} to ${customTo}` : `People and visits per week, last ${weeks} weeks`}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid vertical={false} stroke="#eef2f6" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={12}
                                        label={{ value: 'Week starting', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }} height={40} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={48}
                                        label={{ value: 'People / visits', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8', dy: 40 }} />
                                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                                        formatter={(value: unknown, name: unknown) => [fmt(value as number | null), String(name)]} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, cursor: 'pointer', paddingTop: 12 }}
                                        onClick={(entry: { dataKey?: unknown }) => { const k = LINES.find(l => l.dataKey === entry.dataKey)?.key; if (k) toggle(k); }} />
                                    {LINES.map(l => (
                                        <Line key={l.key} type="monotone" dataKey={l.dataKey} name={l.name} stroke={l.colour} strokeWidth={2.5}
                                            hide={hidden.includes(l.key)} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="insights-card-note">The chart shows full weeks only; the week so far is in the cards above and the table below. Click a name under the chart to hide or show its line.</p>
                    </div>

                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table" aria-label="Growth by week">
                                <thead>
                                    <tr><th>Week starting</th><th>WhatsApp bot (people)</th><th>Doctor Dekho (visits)</th><th>nexeagle.com (visits)</th></tr>
                                </thead>
                                <tbody>
                                    {[...data].reverse().map(d => (
                                        <tr key={d.weekStart} className="premium-row">
                                            <td>{d.label}</td><td>{fmt(d.whatsapp)}</td><td>{fmt(d.doctordekho)}</td><td>{fmt(d.nexeagle)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyGrowthPanel;
