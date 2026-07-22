import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { getFeedbackLog, addTrainingExample, type FeedbackLogItem } from '../services/symptomRouterService';
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

export const FeedbackLogPanel: React.FC = () => {
    const [items, setItems] = useState<FeedbackLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateMode, setDateMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [correctionsOnly, setCorrectionsOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [addedQueries, setAddedQueries] = useState<Set<string>>(new Set());
    const itemsPerPage = 15;

    const fetchFeedback = useCallback(async () => {
        if (dateMode === 'custom' && (!customFrom || !customTo)) return;
        const today = toDateInputValue(new Date());
        const from = dateMode === 'today' ? today : dateMode === 'custom' ? customFrom : undefined;
        const to = dateMode === 'today' ? today : dateMode === 'custom' ? customTo : undefined;

        try {
            setLoading(true);
            const response = await getFeedbackLog(currentPage, itemsPerPage, from, to, correctionsOnly || undefined);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, dateMode, customFrom, customTo, correctionsOnly]);

    useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

    // Adds this row's ACTUAL outcome (what the patient booked, for a correction; what was
    // predicted, for a silent accept) as a new training example — the one-click bridge between
    // "here's a real mistake/confirmation" and "here's a fix in the training set".
    const handleAddToTraining = async (item: FeedbackLogItem) => {
        const specialistId = item.wasCorrection ? item.actualBookedSpecialtyId : item.predictedSpecialtyId;
        if (!specialistId) return;
        // Feedback rows carry a specialtyId slug (e.g. "cardiology"), not our internal label —
        // the CMS editor's dropdown works in internal labels, so this quick-add can't map it
        // without duplicating the NLP repo's reverse mapping here; simplest correct behavior is
        // to prompt the reviewer to pick the label themselves rather than guess silently wrong.
        const label = window.prompt(
            `Add "${item.query}" to training data.\nWhich specialist should it map to? (specialtyId seen: ${specialistId})`,
            ''
        );
        if (!label) return;
        await addTrainingExample({ text: item.query, specialist: label.trim() });
        setAddedQueries(prev => new Set(prev).add(`${item.occurredAt}-${item.query}`));
    };

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> every search that went through the NLP symptom router,
                    correlated with whatever the patient actually booked in that same visit (if anything).
                    A "Correction" means the router suggested one specialty but the patient booked a doctor
                    in a different one — the strongest signal available that the router got it wrong.
                </p>
                <p>
                    <strong>How to use it:</strong> review corrections first — they're the highest-value
                    signal for improving the model. Use "Add to training data" to feed a real example
                    straight into the training set for the next retrain.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
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
                <button
                    className={`insights-filter-btn ${correctionsOnly ? 'active' : ''}`}
                    onClick={() => { setCorrectionsOnly(v => !v); setCurrentPage(1); }}
                >
                    Corrections only
                </button>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalItems} rows</span>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Query</th>
                                <th>Predicted</th>
                                <th>Method / Confidence</th>
                                <th>Actual (booked)</th>
                                <th>Outcome</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No router-driven searches in this range.</td></tr>
                            ) : items.map((item, i) => {
                                const key = `${item.occurredAt}-${item.query}`;
                                return (
                                    <tr key={i} className="premium-row">
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(item.occurredAt)}</td>
                                        <td><span style={{ fontWeight: 600 }}>&ldquo;{item.query}&rdquo;</span></td>
                                        <td style={{ textTransform: 'capitalize' }}>{item.predictedSpecialtyId || '—'}</td>
                                        <td style={{ fontSize: 12, color: '#64748b' }}>
                                            {item.method || '—'}{item.confidence != null ? ` (${(item.confidence * 100).toFixed(0)}%)` : ''}
                                        </td>
                                        <td style={{ textTransform: 'capitalize' }}>{item.actualBookedSpecialtyId || (item.hasBooking ? '—' : <span style={{ color: '#94a3b8' }}>no booking</span>)}</td>
                                        <td>
                                            {!item.hasBooking ? (
                                                <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                                            ) : item.wasCorrection ? (
                                                <span className="insights-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                                    <AlertTriangle size={11} /> Correction
                                                </span>
                                            ) : (
                                                <span className="insights-badge insights-badge-loggedin">
                                                    <CheckCircle2 size={11} /> Confirmed
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {item.hasBooking && !addedQueries.has(key) && (
                                                <button className="doctor-edit-btn" onClick={() => handleAddToTraining(item)}>
                                                    <Plus size={12} /> Add to training data
                                                </button>
                                            )}
                                            {addedQueries.has(key) && <span style={{ fontSize: 12, color: '#16a34a' }}>Added ✓</span>}
                                        </td>
                                    </tr>
                                );
                            })}
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

export default FeedbackLogPanel;
