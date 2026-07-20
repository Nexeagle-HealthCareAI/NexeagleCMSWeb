import React, { useEffect, useState } from 'react';
import { getBookingFunnelStats, type BookingFunnelStats } from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';

type DateFilterMode = 'today' | 'all' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

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
        const today = toDateInputValue(new Date());
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
                    <strong>What this is:</strong> what happens once a visitor starts looking for a
                    doctor — from search, to opening a profile, to actually completing a booking.
                </p>
                <p>
                    <strong>Search-to-View Rate</strong> = profile views ÷ searches. A low rate can mean
                    your doctor/specialty data doesn't match what people are actually searching for, or
                    there simply aren't enough doctors listed in the categories being searched — not
                    necessarily that search itself is broken.
                </p>
                <p>
                    <strong>Booking Funnel Drop-off</strong> shows the exact step people abandon at. A big
                    drop between Confirm Details and Success usually means the details form itself is the
                    problem (too many fields, unclear mobile validation). A drop right after Profile View
                    means people are browsing but not ready to commit to a date yet. There is deliberately
                    no separate payment step — this product is pay-at-hospital-counter, so Success is the
                    final step.
                </p>
                <p>
                    <strong>Specialty Demand</strong> is the most actionable table here: it shows which
                    specialties get the most traffic (searches + views) versus which ones actually convert
                    into completed bookings. High traffic with low completions for a specialty is a strong
                    signal you don't have enough — or the right — doctors onboarded in that category.
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
                            <div className="insights-stat-label">Searches Performed</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{stats.profileViewCount.toLocaleString()}</div>
                            <div className="insights-stat-label">Doctor Profile Views</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value" style={{ color: '#1d4ed8' }}>{stats.searchToViewRatePct}%</div>
                            <div className="insights-stat-label">Search-to-View Rate</div>
                        </div>
                    </div>

                    <div className="insights-mini-table-card" style={{ marginBottom: 16 }}>
                        <h3 className="insights-mini-table-title">Booking Funnel Drop-off</h3>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Profile Viewed</span>
                            <span className="insights-mini-row-value">{stats.profileViewCount.toLocaleString()}</span>
                        </div>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Date/Time Selected — {pct(stats.visitStepCount, stats.profileViewCount)} of views</span>
                            <span className="insights-mini-row-value">{stats.visitStepCount.toLocaleString()}</span>
                        </div>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Confirm Details — {pct(stats.detailsStepCount, stats.visitStepCount)} of prior step</span>
                            <span className="insights-mini-row-value">{stats.detailsStepCount.toLocaleString()}</span>
                        </div>
                        <div className="insights-mini-row">
                            <span className="insights-mini-row-label">Booking Success — {pct(stats.doneStepCount, stats.detailsStepCount)} of prior step</span>
                            <span className="insights-mini-row-value">{stats.doneStepCount.toLocaleString()}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0 }}>
                            No separate payment step — this product is pay-at-hospital-counter, confirmed at the front desk.
                        </p>
                    </div>

                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Specialty</th>
                                        <th>Searches</th>
                                        <th>Profile Views</th>
                                        <th>Completed Bookings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.specialtyDemand.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No specialty-tagged activity yet.</td></tr>
                                    ) : stats.specialtyDemand.map((s, i) => (
                                        <tr key={i} className="premium-row">
                                            <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.specialtyId}</td>
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
