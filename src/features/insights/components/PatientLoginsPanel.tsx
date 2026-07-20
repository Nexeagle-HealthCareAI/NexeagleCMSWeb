import React, { useEffect, useState, useCallback } from 'react';
import { getPatientLogins, type PatientLoginItem } from '../services/insightsService';
import { InsightsExplainer } from './InsightsExplainer';

const formatDateTime = (iso: string | null): string => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const PatientLoginsPanel: React.FC = () => {
    const [items, setItems] = useState<PatientLoginItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'lastloginat', direction: 'desc' });
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

    const fetchLogins = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getPatientLogins(currentPage, itemsPerPage, search, sortConfig.key, sortConfig.direction);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, sortConfig]);

    useEffect(() => { fetchLogins(); }, [fetchLogins]);

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
                    <strong>What this is:</strong> every mobile number that has successfully completed
                    WhatsApp OTP login at least once, with when they last returned and how many times
                    they've logged in total.
                </p>
                <p>
                    <strong>How to use it:</strong> a rising <strong>Total Logins</strong> count per number
                    means patients trust the platform enough to keep coming back rather than booking as a
                    guest each time. A number with only one login and an old <strong>Last Login</strong> may
                    be a one-time visitor — useful context when deciding whether WhatsApp login is actually
                    driving repeat engagement or just a one-off convenience.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search by mobile number…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="insights-search-input"
                />
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalItems} numbers have logged in</span>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Mobile Number</th>
                                <th onClick={() => handleSort('lastloginat')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Last Login <SortIcon columnKey="lastloginat" /></div>
                                </th>
                                <th onClick={() => handleSort('logincount')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Total Logins <SortIcon columnKey="logincount" /></div>
                                </th>
                                <th onClick={() => handleSort('firstseenat')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>First Seen <SortIcon columnKey="firstseenat" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No logins recorded yet.</td></tr>
                            ) : items.map((item, i) => (
                                <tr key={i} className="premium-row">
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.mobileMasked}</td>
                                    <td>{formatDateTime(item.lastLoginAt)}</td>
                                    <td>{item.loginCount}</td>
                                    <td>{formatDateTime(item.firstSeenAt)}</td>
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

export default PatientLoginsPanel;
