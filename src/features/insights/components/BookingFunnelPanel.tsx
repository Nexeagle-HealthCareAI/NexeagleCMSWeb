import React, { useEffect, useState } from 'react';
import { getBookingFunnelStats, type BookingFunnelStats } from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';
import { todayIst } from '../utils/istDate';

type DateFilterMode = 'today' | 'all' | 'custom';

const pct = (numerator: number, denominator: number): string =>
    denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : '—';

export const BookingFunnelPanel: React.FC = () => {
    const [mode, setMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [stats, setStats] = useState<BookingFunnelStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (mode === 'custom' && (!customFrom || !customTo)) return;
        const today = todayIst();
        const from = mode === 'today' ? today : mode === 'custom' ? customFrom : undefined;
        const to = mode === 'today' ? today : mode === 'custom' ? customTo : undefined;

        let cancelled = false;
        setLoading(true);
        getBookingFunnelStats(from, to)
            .then(s => { if (!cancelled) setStats(s); })
            .catch(() => { if (!cancelled) setStats(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [mode, customFrom, customTo]);

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> what people do once they start looking for a doctor, from
                    searching, to opening a doctor's profile, to booking.
                </p>
                <p>
                    <strong>How it is counted:</strong> each number is de-duplicated per visit (one browsing
                    session). A search counts once per distinct query in a visit, a profile once per doctor in a
                    visit, and each booking step once per doctor in a visit, however often the page reloaded or the
                    visitor went back and forth.
                </p>
                <p>
                    <strong>Searched → opened a profile</strong> is the share of visits that searched and then
                    opened at least one doctor's profile. A low share means people are not finding a doctor they
                    want in the results: missing doctors or specialties in their area, or results that do not match
                    what they typed.
                </p>
                <p>
                    <strong>Bookings saved</strong> comes from the appointments table and is the real number.
                    "Booked" in the funnel is what tracking saw; it can be lower because ad blockers stop some
                    tracking calls. There is no payment step: patients pay at the hospital counter.
                </p>
                <p>
                    Counts people only: search-engine crawlers, link previews and data-centre traffic are left
                    out. Dates are India time (IST).
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle">
                    {(['all', 'today', 'custom'] as const).map(m => (
                        <button key={m} className={`insights-filter-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                            {m === 'all' ? 'All time' : m === 'today' ? 'Today' : 'Custom range'}
                        </button>
                    ))}
                </div>
                {mode === 'custom' && (
                    <>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="insights-date-input" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="insights-date-input" />
                    </>
                )}
            </div>

            {loading ? (
                <div className="insights-empty">Loading…</div>
            ) : !stats ? (
                <div className="insights-empty">Failed to load booking funnel stats.</div>
            ) : (
                <>
                    <div className="insights-stat-grid">
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{stats.searchCount.toLocaleString()}</div>
                            <div className="insights-stat-label">Searches ({(stats.searchSessionCount ?? 0).toLocaleString()} visits)</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{stats.profileViewCount.toLocaleString()}</div>
                            <div className="insights-stat-label">Doctor profiles opened</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value" style={{ color: '#1d4ed8' }}>{stats.searchToViewRatePct}%</div>
                            <div className="insights-stat-label">Searched → opened a profile</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value" style={{ color: '#16a34a' }}>{(stats.bookingsRecorded ?? 0).toLocaleString()}</div>
                            <div className="insights-stat-label">Bookings saved (appointments table)</div>
                        </div>
                    </div>

                    <div className="insights-mini-table-card" style={{ marginBottom: 16 }}>
                        <h3 className="insights-mini-table-title">From profile to booking</h3>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Opened a doctor's profile</span>
                            <span className="insights-mini-row-value">{stats.profileViewCount.toLocaleString()}</span>
                        </div>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Chose a date and time: {pct(stats.detailsStepCount, stats.profileViewCount)} of profiles opened</span>
                            <span className="insights-mini-row-value">{stats.detailsStepCount.toLocaleString()}</span>
                        </div>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Booked: {pct(stats.doneStepCount, stats.detailsStepCount)} of those</span>
                            <span className="insights-mini-row-value">{stats.doneStepCount.toLocaleString()}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
                            Each row is one doctor per visit. {stats.bookingsRecorded > stats.doneStepCount
                                ? `${(stats.bookingsRecorded - stats.doneStepCount).toLocaleString()} saved bookings were not seen by tracking (ad blockers, or bookings from another page).`
                                : 'Tracking saw every saved booking in this period.'}
                        </p>
                    </div>

                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Specialty</th>
                                        <th>Visits that searched it</th>
                                        <th>Profiles opened</th>
                                        <th>Booked</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.specialtyDemand.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No specialty-tagged activity yet.</td></tr>
                                    ) : stats.specialtyDemand.map((s, i) => (
                                        <tr key={i} className="premium-row">
                                            <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.specialtyId.replace(/[-_]+/g, ' ')}</td>
                                            <td>{s.searchCount.toLocaleString()}</td>
                                            <td>{s.profileViewCount.toLocaleString()}</td>
                                            <td style={{ fontWeight: 700, color: '#16a34a' }}>{s.completedBookingCount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default BookingFunnelPanel;
