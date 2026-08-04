import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Plus, X } from 'lucide-react';
import {
    getFeedbackLog, addTrainingExample, SYMPTOM_ROUTER_SPECIALISTS,
    type FeedbackLogItem,
} from '../services/symptomRouterService';
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
    const [addModalItem, setAddModalItem] = useState<FeedbackLogItem | null>(null);
    const [addSpecialist, setAddSpecialist] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
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

    // Opens a modal to add this row's ACTUAL outcome (what the patient booked, for a
    // correction; what was predicted, for a silent accept) as a new training example — the
    // bridge between "here's a real mistake/confirmation" and "here's a fix in the training
    // set". Feedback rows carry a specialtyId slug (e.g. "cardiology"), not our internal label
    // — the training set's Specialist column works in internal labels, so this can't
    // preselect the right one without duplicating the NLP repo's reverse mapping here; the
    // reviewer picks it from the same constrained dropdown TrainingDataPanel uses (never
    // free-text — a mistyped label used to fail server-side validation with no visible error).
    const openAddModal = (item: FeedbackLogItem) => {
        setSaveError(null);
        setAddSpecialist(SYMPTOM_ROUTER_SPECIALISTS[0]);
        setAddModalItem(item);
    };

    const closeAddModal = () => {
        if (saving) return;
        setAddModalItem(null);
    };

    const handleConfirmAdd = async () => {
        if (!addModalItem) return;
        const item = addModalItem;
        try {
            setSaving(true);
            setSaveError(null);
            await addTrainingExample({ text: item.query, specialist: addSpecialist });
            setAddedQueries(prev => new Set(prev).add(`${item.occurredAt}-${item.query}`));
            setAddModalItem(null);
        } catch (err: any) {
            setSaveError(err.response?.data?.message || err.response?.data || 'Failed to save.');
        } finally {
            setSaving(false);
        }
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
                                                <button className="doctor-edit-btn" onClick={() => openAddModal(item)}>
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

            {addModalItem && (
                <div className="reject-modal-overlay" onClick={closeAddModal}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 18 }}>Add to training data</h3>
                            <button onClick={closeAddModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Text</div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>&ldquo;{addModalItem.query}&rdquo;</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                            {addModalItem.wasCorrection
                                ? `Patient booked: ${addModalItem.actualBookedSpecialtyId ?? '—'}`
                                : `Router predicted: ${addModalItem.predictedSpecialtyId ?? '—'}`}
                            {' '}(specialtyId — pick the matching label below)
                        </div>

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Specialist</label>
                        <select
                            value={addSpecialist}
                            onChange={e => setAddSpecialist(e.target.value)}
                            className="doctor-form-input premium-input"
                            style={{ width: '100%' }}
                        >
                            {SYMPTOM_ROUTER_SPECIALISTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        {saveError && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
                                {saveError}
                            </div>
                        )}

                        <div className="form-actions" style={{ marginTop: 20 }}>
                            <button className="cancel-btn" onClick={closeAddModal} disabled={saving}>Cancel</button>
                            <button className="approve-btn" onClick={handleConfirmAdd} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeedbackLogPanel;
