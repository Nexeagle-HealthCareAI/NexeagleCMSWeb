import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, UserX } from 'lucide-react';
import { getOnlineAppointments, type OnlineAppointmentItem } from '../services/insightsService';
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

export const OnlineAppointmentsPanel: React.FC = () => {
    const [items, setItems] = useState<OnlineAppointmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'bookedat', direction: 'desc' });
    const [dateMode, setDateMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [source, setSource] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const fetchAppointments = useCallback(async () => {
        if (dateMode === 'custom' && (!customFrom || !customTo)) return;
        const today = toDateInputValue(new Date());
        const from = dateMode === 'today' ? today : dateMode === 'custom' ? customFrom : undefined;
        const to = dateMode === 'today' ? today : dateMode === 'custom' ? customTo : undefined;

        try {
            setLoading(true);
            const response = await getOnlineAppointments(currentPage, itemsPerPage, from, to, search, sortConfig.key, sortConfig.direction, source);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, sortConfig, dateMode, customFrom, customTo, source]);

    useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

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
                    <strong>What this is:</strong> every appointment booked through Doctor Dekho (not
                    walk-ins or ones a hospital's own staff created), showing whether the patient had a
                    verified WhatsApp session active at the moment of booking (<strong>Logged in</strong>)
                    or booked without one (<strong>Guest</strong>).
                </p>
                <p>
                    <strong>How to use it:</strong> guest bookings are still fully valid appointments —
                    but a rising share of Logged-in bookings over time means WhatsApp login is becoming
                    trusted, load-bearing infrastructure rather than a hurdle patients skip past.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search patient, doctor, or hospital…"
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
                <select
                    className="premium-filter-select"
                    value={source}
                    onChange={(e) => { setSource(e.target.value); setCurrentPage(1); }}
                >
                    <option value="">All bookings</option>
                    <option value="LoggedIn">Logged-in only</option>
                    <option value="Guest">Guest only</option>
                </select>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('patientname')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Patient <SortIcon columnKey="patientname" /></div>
                                </th>
                                <th onClick={() => handleSort('doctorname')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Doctor <SortIcon columnKey="doctorname" /></div>
                                </th>
                                <th onClick={() => handleSort('hospitalname')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Hospital <SortIcon columnKey="hospitalname" /></div>
                                </th>
                                <th onClick={() => handleSort('apptdate')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Appt Date <SortIcon columnKey="apptdate" /></div>
                                </th>
                                <th onClick={() => handleSort('bookedat')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Booked At <SortIcon columnKey="bookedat" /></div>
                                </th>
                                <th onClick={() => handleSort('status')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Status <SortIcon columnKey="status" /></div>
                                </th>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No online bookings match these filters.</td></tr>
                            ) : items.map((item) => (
                                <tr key={item.apptId} className="premium-row">
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{item.patientName || 'Unnamed'}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{item.patientMobileMasked || '—'}</div>
                                    </td>
                                    <td>{item.doctorName || '—'}</td>
                                    <td>{item.hospitalName || '—'}</td>
                                    <td>{new Date(item.apptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td>{formatDateTime(item.bookedAt)}</td>
                                    <td>{item.status}</td>
                                    <td>
                                        {item.isLoggedIn ? (
                                            <span className="insights-badge insights-badge-loggedin" title={item.bookedByMobileMasked || undefined}>
                                                <CheckCircle2 size={12} /> Logged in
                                            </span>
                                        ) : (
                                            <span className="insights-badge insights-badge-guest">
                                                <UserX size={12} /> Guest
                                            </span>
                                        )}
                                    </td>
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

export default OnlineAppointmentsPanel;
