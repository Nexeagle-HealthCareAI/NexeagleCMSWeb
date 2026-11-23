import React, { useEffect, useMemo, useState } from 'react';
import { InsightsExplainer } from './InsightsExplainer';
import { istDaysAgo, todayIst } from '../utils/istDate';
import { channelInsights, dayLabel, type DoctorDekhoDailyStats } from '../services/channelInsights';

const RANGES = [
    { key: 'today', label: 'Today', days: 1 },
    { key: '7', label: '7 days', days: 7 },
    { key: '30', label: '30 days', days: 30 },
    { key: '90', label: '90 days', days: 90 },
] as const;
type RangeKey = typeof RANGES[number]['key'];

const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Doctor Dekho website, day by day: from visit to booking, and how many stopped part-way. */
export const DoctorDekhoDailyPanel: React.FC = () => {
    const [range, setRange] = useState<RangeKey>('7');
    const { from, to } = useMemo(() => ({ from: istDaysAgo(RANGES.find(r => r.key === range)!.days - 1), to: todayIst() }), [range]);
    const [stats, setStats] = useState<DoctorDekhoDailyStats | null>(null);
    const [failed, setFailed] = useState(false);
    const [loadedFor, setLoadedFor] = useState('');

    useEffect(() => {
        let alive = true;
        channelInsights.doctorDekhoDaily(from, to)
            .then(s => { if (alive) { setStats(s); setFailed(false); } })
            .catch(() => { if (alive) setFailed(true); })
            .finally(() => { if (alive) setLoadedFor(`${from}|${to}`); });
        return () => { alive = false; };
    }, [from, to]);
    const loading = loadedFor !== `${from}|${to}`;
    const t = stats?.totals;

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>Doctor Dekho, from visit to booking, each day.</strong> Each number is visits (browsing
                    sessions) that reached that point. <em>Left in between</em> is visits that opened the booking form
                    and did not finish it. The website only knows the phone number of people who logged in or booked;
                    their bookings, with names and numbers, are on the Appointments tab. Bookings made on WhatsApp are not counted here: they are on the
                    WhatsApp bot tab.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="Period">
                    {RANGES.map(r => (
                        <button key={r.key} className={`insights-filter-btn ${range === r.key ? 'active' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>
                    ))}
                </div>
            </div>

            {loading && !stats ? <div className="insights-empty">Loading…</div> : failed || !stats ? (
                <div className="insights-empty">Could not load Doctor Dekho's figures. Try again in a moment.</div>
            ) : (
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <div className="insights-stat-grid">
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.visits)}</div><div className="insights-stat-label">Visits</div></div>
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.searched)}</div><div className="insights-stat-label">Searched</div></div>
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.startedBooking)}</div><div className="insights-stat-label">Opened the booking form</div></div>
                        <div className="insights-stat-card is-good"><div className="insights-stat-value">{fmt(t!.booked)}</div><div className="insights-stat-label">Booked · {pct(t!.booked, t!.startedBooking)} of those who started</div></div>
                        <div className="insights-stat-card is-bad"><div className="insights-stat-value">{fmt(t!.left)}</div><div className="insights-stat-label">Left in between</div></div>
                    </div>
                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table" aria-label="Doctor Dekho by day">
                                <thead>
                                    <tr><th>Day</th><th>Visits</th><th>Searched</th><th>Viewed a doctor</th><th>Opened booking</th><th>Entered details</th><th>Booked</th><th>Left in between</th></tr>
                                </thead>
                                <tbody>
                                    {stats.days.map(d => (
                                        <tr key={d.date} className="premium-row">
                                            <td>{dayLabel(d.date)}</td>
                                            <td>{fmt(d.visits)}</td>
                                            <td>{fmt(d.searched)}</td>
                                            <td>{fmt(d.viewedDoctor)}</td>
                                            <td>{fmt(d.startedBooking)}</td>
                                            <td>{fmt(d.enteredDetails)}</td>
                                            <td className={d.booked ? 'insights-good' : ''}>{fmt(d.booked)}</td>
                                            <td className={d.left ? 'insights-bad' : ''}>{fmt(d.left)}</td>
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

export default DoctorDekhoDailyPanel;
