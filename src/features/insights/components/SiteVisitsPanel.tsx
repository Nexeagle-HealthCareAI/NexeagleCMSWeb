import React, { useEffect, useState } from 'react';
import { Eye, Users } from 'lucide-react';
import { getSiteVisitStats, type SiteVisitStats } from '../services/insightsService';

type DateFilterMode = 'today' | 'all' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatRegionLabel = (r: { country: string | null; region: string | null; city: string | null }): string =>
    [r.city, r.region, r.country].filter(Boolean).join(', ') || 'Unknown';

export const SiteVisitsPanel: React.FC = () => {
    const [mode, setMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [stats, setStats] = useState<SiteVisitStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (mode === 'custom' && (!customFrom || !customTo)) return;

        const today = toDateInputValue(new Date());
        const from = mode === 'today' ? today : mode === 'custom' ? customFrom : undefined;
        const to = mode === 'today' ? today : mode === 'custom' ? customTo : undefined;

        let cancelled = false;
        setLoading(true);
        getSiteVisitStats(from, to)
            .then(s => { if (!cancelled) setStats(s); })
            .catch(() => { if (!cancelled) setStats(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [mode, customFrom, customTo]);

    return (
        <div>
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
                <div className="insights-empty">Failed to load site visit stats.</div>
            ) : (
                <>
                    <div className="insights-stat-grid">
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{stats.totalVisits.toLocaleString()}</div>
                            <div className="insights-stat-label"><Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Total Page Views</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{stats.uniqueVisitors.toLocaleString()}</div>
                            <div className="insights-stat-label"><Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Unique Visitors</div>
                        </div>
                    </div>

                    <div className="insights-panels-grid">
                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title">Top Regions</h3>
                            {stats.topRegions.length === 0 ? (
                                <div className="insights-empty">No region data yet.</div>
                            ) : stats.topRegions.map((r, i) => (
                                <div key={i} className="insights-mini-row">
                                    <span className="insights-mini-row-label">{formatRegionLabel(r)}</span>
                                    <span className="insights-mini-row-value">{r.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title">Top Pages</h3>
                            {stats.topPages.length === 0 ? (
                                <div className="insights-empty">No page data yet.</div>
                            ) : stats.topPages.map((p, i) => (
                                <div key={i} className="insights-mini-row">
                                    <span className="insights-mini-row-label">{p.pagePath || '—'}</span>
                                    <span className="insights-mini-row-value">{p.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title">Daily Trend</h3>
                            {stats.dailyTrend.length === 0 ? (
                                <div className="insights-empty">No visits recorded yet.</div>
                            ) : stats.dailyTrend.slice(-14).reverse().map((d, i) => (
                                <div key={i} className="insights-mini-row">
                                    <span className="insights-mini-row-label">{d.date}</span>
                                    <span className="insights-mini-row-value">{d.count.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SiteVisitsPanel;
