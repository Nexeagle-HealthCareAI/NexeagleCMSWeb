import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { InsightsExplainer } from './InsightsExplainer';
import { channelInsights, shortDay, type WeeklyGrowth } from '../services/channelInsights';

const PERIODS = [8, 12, 26, 52] as const;
type Period = typeof PERIODS[number];

// One colour per channel, the same everywhere on this page.
export const CHANNEL_COLOURS = { whatsapp: '#16a34a', doctordekho: '#2563eb', nexeagle: '#7c3aed' } as const;

const LINES = [
    { key: 'whatsapp', dataKey: 'whatsapp', name: 'WhatsApp bot (people)', colour: CHANNEL_COLOURS.whatsapp },
    { key: 'doctordekho', dataKey: 'doctordekho', name: 'Doctor Dekho (visits)', colour: CHANNEL_COLOURS.doctordekho },
    { key: 'nexeagle', dataKey: 'nexeagle', name: 'nexeagle.com (visits)', colour: CHANNEL_COLOURS.nexeagle },
] as const;
type LineKey = typeof LINES[number]['key'];

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));

/** Change from the last full week to the one before it. */
function change(values: (number | null)[]): string | null {
    const full = values.slice(0, -1).filter((v): v is number => v != null);
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
    const [loadedFor, setLoadedFor] = useState<number | null>(null);
    const [hidden, setHidden] = useState<LineKey[]>([]);

    useEffect(() => {
        let alive = true;
        channelInsights.weeklyGrowth(weeks)
            .then(g => { if (alive) { setGrowth(g); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); })
            .finally(() => { if (alive) setLoadedFor(weeks); });
        return () => { alive = false; };
    }, [weeks]);
    const loading = loadedFor !== weeks;

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

    const summary = LINES.map(l => ({
        ...l,
        last: data.length > 1 ? data[data.length - 2][l.dataKey] : null,
        thisWeek: data.length > 0 ? data[data.length - 1][l.dataKey] : null,
        change: change(data.map(d => d[l.dataKey])),
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
                </div>
            </div>

            {loading && !growth ? <div className="insights-empty">Loading…</div> : failed || !growth ? (
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
                                    <span>This week so far: {fmt(s.thisWeek as number | null)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="insights-mini-table-card">
                        <h3 className="insights-mini-table-title"><TrendingUp size={14} className="insights-title-icon" />Growth by week</h3>
                        <div className="insights-growth-chart" role="img" aria-label={`People and visits per week, last ${weeks} weeks`}>
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
