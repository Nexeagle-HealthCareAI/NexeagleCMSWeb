import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { getSearchLog, type SearchLogItem } from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';

type DateFilterMode = 'today' | 'all' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatRegion = (i: { city: string | null; region: string | null; country: string | null }): string =>
    [i.city, i.region, i.country].filter(Boolean).join(', ') || '—';

export const SearchLogPanel: React.FC = () => {
    const [items, setItems] = useState<SearchLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'occurredat', direction: 'desc' });
    const [dateMode, setDateMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 15;

    useEffect(() => {
        const handle = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const fetchSearches = useCallback(async () => {
        if (dateMode === 'custom' && (!customFrom || !customTo)) return;
        const today = toDateInputValue(new Date());
        const from = dateMode === 'today' ? today : dateMode === 'custom' ? customFrom : undefined;
        const to = dateMode === 'today' ? today : dateMode === 'custom' ? customTo : undefined;

        try {
            setLoading(true);
            const response = await getSearchLog(currentPage, itemsPerPage, from, to, search, sortConfig.key, sortConfig.direction);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, sortConfig, dateMode, customFrom, customTo]);

    useEffect(() => { fetchSearches(); }, [fetchSearches]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setCurrentPage(1);
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <span className="sort-icon inactive">↕</span>;
        return <span className="sort-icon active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> a raw, real-time log of every single search a visitor
                    performs on Doctor Dekho — free-text queries (a symptom or doctor name) and/or a
                    specialty filter — along with how many results it returned, whether the AI fallback
                    kicked in (meaning the plain keyword match found nothing), and the visitor's region.
                </p>
                <p>
                    <strong>How to use it:</strong> this is your rawest trend data for onboarding decisions.
                    Recurring queries with few or zero results are a direct signal of unmet demand — either
                    a doctor/specialty you don't have listed yet in that area, or a search term your
                    platform doesn't recognize as a synonym for an existing specialty. The AI fallback badge
                    flags exactly those "found nothing obvious" cases worth reviewing first.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search by query text or specialty…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="insights-search-input"
                />
                <div className="insights-filter-toggle">
                    {(['all', 'today', 'custom'] as const).map(m => (
                        <button key={m} className={`insights-filter-btn ${dateMode === m ? 'active' : ''}`} onClick={() => { setDateMode(m); setCurrentPage(1); }}>
                            {m === 'all' ? 'All time' : m === 'today' ? 'Today' : 'Custom range'}
                        </button>
                    ))}
                </div>
                {dateMode === 'custom' && (
                    <>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="insights-date-input" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="insights-date-input" />
                    </>
                )}
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalItems} searches recorded</span>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('occurredat')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Date &amp; Time <SortIcon columnKey="occurredat" /></div>
                                </th>
                                <th>Search Query</th>
                                <th onClick={() => handleSort('specialtyid')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Specialty Filter <SortIcon columnKey="specialtyid" /></div>
                                </th>
                                <th onClick={() => handleSort('resultscount')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Results <SortIcon columnKey="resultscount" /></div>
                                </th>
                                <th>Region</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No searches match these filters.</td></tr>
                            ) : items.map((item, i) => (
                                <tr key={i} className="premium-row">
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.occurredAt)}</td>
                                    <td>
                                        {item.query ? (
                                            <span style={{ fontWeight: 600 }}>&ldquo;{item.query}&rdquo;</span>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                        {item.aiUsed && (
                                            <span className="insights-badge insights-badge-loggedin" style={{ marginLeft: 8 }}>
                                                <Sparkles size={11} /> AI fallback
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{item.specialtyId || '—'}</td>
                                    <td>{item.resultsCount ?? '—'}</td>
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

export default SearchLogPanel;
