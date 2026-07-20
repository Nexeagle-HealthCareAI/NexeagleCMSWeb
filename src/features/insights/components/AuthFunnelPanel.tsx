import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
    getAuthFunnelStats, getAuthFunnelAttempts,
    type AuthFunnelStats, type AuthFunnelAttemptItem
} from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';

type DateFilterMode = 'today' | 'all' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDateTime = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatRegion = (a: { city: string | null; region: string | null; country: string | null }): string =>
    [a.city, a.region, a.country].filter(Boolean).join(', ') || '—';

const formatSeconds = (s: number | null): string => {
    if (s == null) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export const AuthFunnelPanel: React.FC = () => {
    const [mode, setMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [stats, setStats] = useState<AuthFunnelStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [items, setItems] = useState<AuthFunnelAttemptItem[]>([]);
    const [tableLoading, setTableLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;

    useEffect(() => {
        const handle = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const effectiveRange = useCallback((): { from?: string; to?: string } => {
        if (mode === 'custom' && (!customFrom || !customTo)) return {};
        const today = toDateInputValue(new Date());
        const from = mode === 'today' ? today : mode === 'custom' ? customFrom : undefined;
        const to = mode === 'today' ? today : mode === 'custom' ? customTo : undefined;
        return { from, to };
    }, [mode, customFrom, customTo]);

    useEffect(() => {
        if (mode === 'custom' && (!customFrom || !customTo)) return;
        const { from, to } = effectiveRange();
        let cancelled = false;
        setStatsLoading(true);
        getAuthFunnelStats(from, to)
            .then(s => { if (!cancelled) setStats(s); })
            .catch(() => { if (!cancelled) setStats(null); })
            .finally(() => { if (!cancelled) setStatsLoading(false); });
        return () => { cancelled = true; };
    }, [mode, customFrom, customTo, effectiveRange]);

    useEffect(() => {
        if (mode === 'custom' && (!customFrom || !customTo)) return;
        const { from, to } = effectiveRange();
        let cancelled = false;
        setTableLoading(true);
        getAuthFunnelAttempts(currentPage, itemsPerPage, from, to, search)
            .then(r => {
                if (cancelled) return;
                setItems(r.data);
                setTotalPages(r.pagination.totalPages);
                setTotalItems(r.pagination.totalItems);
            })
            .catch(() => { if (!cancelled) setItems([]); })
            .finally(() => { if (!cancelled) setTableLoading(false); });
        return () => { cancelled = true; };
    }, [mode, customFrom, customTo, currentPage, search, effectiveRange]);

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> WhatsApp is the gatekeeper for booking history and
                    returning-patient recognition — this is the most critical drop-off zone on the site.
                    Every ad rupee spent is wasted if this funnel leaks.
                </p>
                <p>
                    <strong>Login Initiation Rate</strong> = visitors who opened the login form ÷ all
                    visitor sessions. A low rate usually means the login prompt isn't visible or
                    compelling enough — not that the OTP flow itself is broken.
                </p>
                <p>
                    <strong>Auth Completion Rate</strong> = OTP verified ÷ OTP sent. A low completion rate
                    (people bouncing at the verification step) usually points to one of: the WhatsApp
                    message arriving late or not at all, the user mistyping the code, or the code expiring
                    before they act on it.
                </p>
                <p>
                    <strong>Avg Time-to-Authenticate</strong> is how long the WhatsApp handshake takes for
                    people who succeed — a rising average is an early warning sign of delivery delays from
                    the OTP/WhatsApp provider, even before completion rate itself drops.
                </p>
                <p>
                    Every row below is a real attempt, mobile number included, so you can see exactly who
                    bounced and when — not just an aggregate percentage.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle">
                    {(['all', 'today', 'custom'] as const).map(m => (
                        <button key={m} className={`insights-filter-btn ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setCurrentPage(1); }}>
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

            {statsLoading ? (
                <div className="insights-empty">Loading…</div>
            ) : !stats ? (
                <div className="insights-empty">Failed to load auth funnel stats.</div>
            ) : (
                <div className="insights-stat-grid">
                    <div className="insights-stat-card">
                        <div className="insights-stat-value">{stats.totalVisitorSessions.toLocaleString()}</div>
                        <div className="insights-stat-label">Total Visitor Sessions</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value">{stats.loginInitiatedSessions.toLocaleString()}</div>
                        <div className="insights-stat-label">Login Initiated</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value" style={{ color: '#1d4ed8' }}>{stats.loginInitiationRatePct}%</div>
                        <div className="insights-stat-label">Login Initiation Rate</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value">{stats.otpSentSessions.toLocaleString()}</div>
                        <div className="insights-stat-label">OTP Sent</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value">{stats.otpVerifiedSessions.toLocaleString()}</div>
                        <div className="insights-stat-label">OTP Verified</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value" style={{ color: '#16a34a' }}>{stats.authCompletionRatePct}%</div>
                        <div className="insights-stat-label">Auth Completion Rate</div>
                    </div>
                    <div className="insights-stat-card">
                        <div className="insights-stat-value">{formatSeconds(stats.avgTimeToAuthenticateSeconds)}</div>
                        <div className="insights-stat-label">Avg Time-to-Authenticate</div>
                    </div>
                </div>
            )}

            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search by mobile number…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="insights-search-input"
                />
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Mobile Number</th>
                                <th>OTP Sent At</th>
                                <th>Verified At</th>
                                <th>Outcome</th>
                                <th>Time to Authenticate</th>
                                <th>Region</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableLoading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No login attempts recorded yet.</td></tr>
                            ) : items.map((item, i) => (
                                <tr key={i} className="premium-row">
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.mobileMasked}</td>
                                    <td>{formatDateTime(item.otpSentAt)}</td>
                                    <td>{formatDateTime(item.verifiedAt)}</td>
                                    <td>
                                        {item.outcome === 'Verified' ? (
                                            <span className="insights-badge insights-badge-loggedin"><CheckCircle2 size={12} /> Verified</span>
                                        ) : (
                                            <span className="insights-badge insights-badge-guest"><XCircle size={12} /> Bounced</span>
                                        )}
                                    </td>
                                    <td>{formatSeconds(item.timeToAuthenticateSeconds)}</td>
                                    <td>{formatRegion(item)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="premium-pagination">
                    <div className="premium-page-info">
                        Showing <span style={{ fontWeight: 600 }}>{totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span style={{ fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span style={{ fontWeight: 600 }}>{totalItems}</span>
                    </div>
                    <div className="premium-page-controls">
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="premium-page-btn">Previous</button>
                        <span style={{ margin: '0 12px', fontSize: 14, color: '#64748b' }}>Page {currentPage} of {totalPages || 1}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="premium-page-btn">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthFunnelPanel;
