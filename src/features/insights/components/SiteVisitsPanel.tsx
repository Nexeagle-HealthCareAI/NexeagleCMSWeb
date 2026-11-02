import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Users, MapPin, Bot, Hospital, CalendarCheck } from 'lucide-react';
import {
    getSiteVisitStats, type SiteVisitStats, type SiteKey, type LocationCount,
} from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';
import { todayIst, istDaysAgo } from '../utils/istDate';

type RangeKey = 'today' | '7d' | '30d' | '90d' | '365d' | 'custom';
type SiteChoice = SiteKey | 'all';

const RANGES: { key: RangeKey; label: string; days?: number }[] = [
    { key: 'today', label: 'Today', days: 0 },
    { key: '7d', label: '7 days', days: 6 },
    { key: '30d', label: '30 days', days: 29 },
    { key: '90d', label: '90 days', days: 89 },
    { key: '365d', label: '12 months', days: 364 },
    { key: 'custom', label: 'Custom' },
];

const SITES: { key: SiteChoice; label: string }[] = [
    { key: 'doctordekho', label: 'Doctor Dekho' },
    { key: 'nexeagle', label: 'NexEagle website' },
    { key: 'all', label: 'Both' },
];

const SITE_NAMES: Record<string, string> = { doctordekho: 'Doctor Dekho', nexeagle: 'NexEagle website', unknown: 'Not recorded (older visits)' };

const fmt = (n: number) => n.toLocaleString('en-IN');
// Geo databases use official names; show the everyday one.
const shortPlace = (name: string) => name.replace(/^National Capital Territory of /i, '');
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);
const formatDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Ranked list with a share bar behind each row. */
const ShareList: React.FC<{
    title: string;
    icon?: React.ReactNode;
    rows: LocationCount[];
    total: number;
    empty: string;
    note?: string;
    unit?: string;
}> = ({ title, icon, rows, total, empty, note, unit = 'visits' }) => (
    <div className="insights-mini-table-card">
        <h3 className="insights-mini-table-title">{icon}{title}</h3>
        {note && <p className="insights-card-note">{note}</p>}
        {rows.length === 0 ? (
            <div className="insights-empty">{empty}</div>
        ) : rows.map(r => {
            const share = pct(r.visits, total);
            return (
                <div key={`${r.name}|${r.parent ?? ''}`} className="insights-share-row" title={`${fmt(r.visits)} ${unit} · ${share}%`}>
                    <div className="insights-share-bar" style={{ width: `${Math.max(share, 1)}%` }} />
                    <span className="insights-mini-row-label">
                        {shortPlace(r.name)}
                        {r.parent && <span className="insights-share-parent">, {shortPlace(r.parent)}</span>}
                    </span>
                    <span className="insights-mini-row-value">
                        {fmt(r.visits)} <span className="insights-share-pct">{share}%</span>
                    </span>
                </div>
            );
        })}
    </div>
);

export const SiteVisitsPanel: React.FC = () => {
    const [site, setSite] = useState<SiteChoice>('doctordekho');
    const [range, setRange] = useState<RangeKey>('30d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    // The query this view needs; null while a custom range is incomplete.
    const query = useMemo(() => {
        if (range === 'custom') {
            if (!customFrom || !customTo) return null;
            return { from: customFrom, to: customTo, site };
        }
        return { from: istDaysAgo(RANGES.find(r => r.key === range)?.days ?? 29), to: todayIst(), site };
    }, [site, range, customFrom, customTo]);
    const queryKey = query ? `${query.site}|${query.from}|${query.to}` : null;

    // Last response, tagged with the query it answers: "loading" is simply "the answer is for another query".
    const [result, setResult] = useState<{ key: string; stats: SiteVisitStats | null } | null>(null);

    useEffect(() => {
        if (!query || !queryKey) return;
        let cancelled = false;
        getSiteVisitStats(query.from, query.to, query.site === 'all' ? undefined : query.site)
            .then(s => { if (!cancelled) setResult({ key: queryKey, stats: s }); })
            .catch(() => { if (!cancelled) setResult({ key: queryKey, stats: null }); });
        return () => { cancelled = true; };
    }, [query, queryKey]);

    const loading = !!queryKey && result?.key !== queryKey;
    const stats = result?.stats ?? null;
    const failed = !loading && !!result && result.stats === null;

    const trend = useMemo(() => (stats ? stats.dailyTrend.slice(-31) : []), [stats]);
    const trendMax = useMemo(() => Math.max(1, ...trend.map(d => d.count)), [trend]);

    const showCare = site !== 'nexeagle';
    const careInterestTotal = stats?.careInterestCities.reduce((n, r) => n + r.visits, 0) ?? 0;
    const bookingTotal = stats?.bookingCities.reduce((n, r) => n + r.visits, 0) ?? 0;
    const countriesTotal = stats ? stats.visits - stats.visitsLocationUnknown : 0;

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>Visits, not page loads.</strong> A visit is one person's browsing session: their page
                    views until they have been away for 30 minutes. One person reading 10 pages is 1 visit and 10
                    page views. Search engines, link previews (WhatsApp, Facebook) and other bots load pages too;
                    they are left out, and the count of what was left out is shown so nothing is hidden.
                </p>
                <p>
                    <strong>Two kinds of location.</strong> <em>Where visitors are</em> comes from their internet
                    address: country and state are reliable, the city is approximate because Indian mobile
                    networks route through a few large hubs (many Bihar visitors appear as Patna, for example).{' '}
                    <em>Where people want care</em> is exact: the city of the hospital whose doctor or page they
                    opened, and of the hospital they booked with. Use the second for onboarding and ad decisions.
                </p>
                <p>All dates are India time (IST).</p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="Website">
                    {SITES.map(s => (
                        <button key={s.key} className={`insights-filter-btn ${site === s.key ? 'active' : ''}`} onClick={() => setSite(s.key)}>
                            {s.label}
                        </button>
                    ))}
                </div>
                <div className="insights-filter-toggle" role="group" aria-label="Date range">
                    {RANGES.map(r => (
                        <button key={r.key} className={`insights-filter-btn ${range === r.key ? 'active' : ''}`} onClick={() => setRange(r.key)}>
                            {r.label}
                        </button>
                    ))}
                </div>
                {range === 'custom' && (
                    <>
                        <input type="date" value={customFrom} max={customTo || todayIst()} onChange={e => setCustomFrom(e.target.value)} className="insights-date-input" aria-label="From" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} min={customFrom || undefined} max={todayIst()} onChange={e => setCustomTo(e.target.value)} className="insights-date-input" aria-label="To" />
                    </>
                )}
            </div>

            {range === 'custom' && (!customFrom || !customTo) ? (
                <div className="insights-empty">Pick a start and end date.</div>
            ) : loading && !stats ? (
                <div className="insights-empty">Loading…</div>
            ) : failed || !stats ? (
                <div className="insights-empty">Could not load site visits. Try again in a moment.</div>
            ) : (
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <p className="insights-range-note">
                        {formatDay(stats.from)} – {formatDay(stats.to)} · {SITES.find(s => s.key === site)?.label}
                    </p>

                    <div className="insights-stat-grid">
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{fmt(stats.visits)}</div>
                            <div className="insights-stat-label"><Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Visits</div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{fmt(stats.pageViews)}</div>
                            <div className="insights-stat-label">
                                <Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Page views{stats.visits > 0 && ` · ${(stats.pageViews / stats.visits).toFixed(1)} per visit`}
                            </div>
                        </div>
                        <div className="insights-stat-card">
                            <div className="insights-stat-value">{pct(stats.visitsInIndia, stats.visits)}%</div>
                            <div className="insights-stat-label">
                                <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Visits from India ({fmt(stats.visitsInIndia)})
                            </div>
                        </div>
                        <div className="insights-stat-card insights-stat-card-muted" title="Search-engine crawlers, link previews, monitoring tools and data-centre addresses. Not included in any number on this page.">
                            <div className="insights-stat-value">{fmt(stats.automatedVisitsExcluded)}</div>
                            <div className="insights-stat-label">
                                <Bot size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Bot visits left out ({fmt(stats.automatedPageViewsExcluded)} page views)
                            </div>
                        </div>
                    </div>

                    {showCare && (
                        <>
                            <h3 className="insights-section-title">Where people want care</h3>
                            <div className="insights-panels-grid">
                                <ShareList
                                    title="Cities people look at"
                                    icon={<Hospital size={14} className="insights-title-icon" />}
                                    rows={stats.careInterestCities}
                                    total={careInterestTotal}
                                    note="Hospital city of the doctors and hospital pages visitors opened."
                                    empty="No doctor or hospital pages opened in this period."
                                />
                                <ShareList
                                    title="Cities people booked in"
                                    icon={<CalendarCheck size={14} className="insights-title-icon" />}
                                    rows={stats.bookingCities}
                                    total={bookingTotal}
                                    unit="bookings"
                                    note="Hospital city of appointments booked on Doctor Dekho."
                                    empty="No online bookings in this period."
                                />
                            </div>
                        </>
                    )}

                    <h3 className="insights-section-title">Where visitors are</h3>
                    <div className="insights-panels-grid">
                        <ShareList
                            title="Indian states"
                            rows={stats.indiaStates}
                            total={stats.visitsInIndia}
                            empty="No visits from India in this period."
                        />
                        <ShareList
                            title="Indian cities (approximate)"
                            rows={stats.indiaCities}
                            total={stats.visitsInIndia}
                            note="Based on the network the visitor used; mobile users often show as the nearest big city."
                            empty="No city data in this period."
                        />
                        <ShareList
                            title="Countries"
                            rows={stats.countries}
                            total={countriesTotal}
                            note={stats.visitsLocationUnknown > 0 ? `${fmt(stats.visitsLocationUnknown)} visits had no location (private network or lookup unavailable).` : undefined}
                            empty="No location data in this period."
                        />
                    </div>

                    <div className="insights-panels-grid">
                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title">Visits per day</h3>
                            {trend.length === 0 ? (
                                <div className="insights-empty">No visits in this period.</div>
                            ) : (
                                <div className="insights-trend" role="img" aria-label="Visits per day">
                                    {trend.map(d => (
                                        <div key={d.date} className="insights-trend-col" title={`${formatDay(d.date)}: ${fmt(d.count)} visits, ${fmt(d.pageViews)} page views`}>
                                            <div className="insights-trend-bar" style={{ height: `${Math.max(2, (d.count / trendMax) * 100)}%` }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {trend.length > 0 && (
                                <div className="insights-trend-axis">
                                    <span>{formatDay(trend[0].date)}</span>
                                    <span>{formatDay(trend[trend.length - 1].date)}</span>
                                </div>
                            )}
                            {stats.dailyTrend.length > trend.length && <p className="insights-card-note">Showing the last 31 days of the range.</p>}
                        </div>

                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title">Most visited pages</h3>
                            {stats.topPages.length === 0 ? (
                                <div className="insights-empty">No page data in this period.</div>
                            ) : (
                                <>
                                    <div className="insights-mini-row insights-mini-row-head">
                                        <span>Page</span><span>Visits · views</span>
                                    </div>
                                    {stats.topPages.map(p => (
                                        <div key={p.pagePath ?? '—'} className="insights-mini-row">
                                            <span className="insights-mini-row-label" title={p.pagePath ?? ''}>{p.pagePath || '—'}</span>
                                            <span className="insights-mini-row-value">{fmt(p.visits)} <span className="insights-share-pct">· {fmt(p.count)}</span></span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {site === 'all' && stats.sites.length > 0 && (
                            <ShareList
                                title="By website"
                                rows={stats.sites.map(s => ({ ...s, name: SITE_NAMES[s.name] ?? s.name }))}
                                total={stats.visits}
                                empty="No visits."
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteVisitsPanel;
