import React, { useEffect, useState, useCallback } from 'react';
import { getChatSessions, type ChatSessionListItem } from '../services/chatHistoryService';
import { ChatTranscriptModal } from './ChatTranscriptModal';
import '../../insights/components/Insights.css';
import '../../dashboard/pages/PremiumHospitals.css';

type DateFilterMode = 'today' | 'all' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const ChatHistoryPanel: React.FC = () => {
    const [items, setItems] = useState<ChatSessionListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [dateMode, setDateMode] = useState<DateFilterMode>('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [openSession, setOpenSession] = useState<ChatSessionListItem | null>(null);
    const itemsPerPage = 15;

    useEffect(() => {
        const handle = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const fetchSessions = useCallback(async () => {
        if (dateMode === 'custom' && (!customFrom || !customTo)) return;
        const today = toDateInputValue(new Date());
        const from = dateMode === 'today' ? today : dateMode === 'custom' ? customFrom : undefined;
        const to = dateMode === 'today' ? today : dateMode === 'custom' ? customTo : undefined;

        try {
            setLoading(true);
            const response = await getChatSessions(currentPage, itemsPerPage, from, to, search);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, dateMode, customFrom, customTo]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    return (
        <div className="chat-history-panel">
            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search by guest name or email…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="insights-search-input"
                />
                <div className="insights-filter-toggle">
                    {(['today', 'all', 'custom'] as const).map(m => (
                        <button key={m} className={`insights-filter-btn ${dateMode === m ? 'active' : ''}`} onClick={() => { setDateMode(m); setCurrentPage(1); }}>
                            {m === 'today' ? 'Today' : m === 'all' ? 'All time' : 'Custom range'}
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
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalItems} conversations</span>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Started</th>
                                <th>Guest</th>
                                <th>Handled By</th>
                                <th>Status</th>
                                <th>Messages</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No chats match these filters.</td></tr>
                            ) : items.map((item) => (
                                <tr key={item.sessionId} className="premium-row" onClick={() => setOpenSession(item)} style={{ cursor: 'pointer' }}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.startedAt)}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{item.guestName || `Guest ${item.guestId.substring(0, 8)}`}</div>
                                        {item.guestEmail && <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.guestEmail}</div>}
                                    </td>
                                    <td>{item.agentNames || <span style={{ color: '#94a3b8' }}>Unattended</span>}</td>
                                    <td>
                                        <span className={`insights-badge ${item.status === 'Active' ? 'insights-badge-loggedin' : 'insights-badge-guest'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td>{item.messageCount}</td>
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

            {openSession && <ChatTranscriptModal key={openSession.sessionId} session={openSession} onClose={() => setOpenSession(null)} />}
        </div>
    );
};

export default ChatHistoryPanel;
