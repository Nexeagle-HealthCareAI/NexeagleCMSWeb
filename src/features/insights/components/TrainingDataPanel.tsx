import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
    getTrainingExamples, addTrainingExample, updateTrainingExample, deleteTrainingExample,
    SYMPTOM_ROUTER_SPECIALISTS, type TrainingExampleItem, type UpsertTrainingExampleRequest,
} from '../services/symptomRouterService';
import { InsightsExplainer } from './InsightsExplainer';

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

interface EditState {
    id: string | null; // null = adding a new row
    text: string;
    specialist: string;
}

export const TrainingDataPanel: React.FC = () => {
    const [items, setItems] = useState<TrainingExampleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [specialistFilter, setSpecialistFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    const [editState, setEditState] = useState<EditState | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        const handle = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getTrainingExamples(currentPage, itemsPerPage, specialistFilter || undefined, search || undefined);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, specialistFilter]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const openAdd = () => {
        setSaveError(null);
        setEditState({ id: null, text: '', specialist: SYMPTOM_ROUTER_SPECIALISTS[0] });
    };

    const openEdit = (item: TrainingExampleItem) => {
        setSaveError(null);
        setEditState({ id: item.id, text: item.text, specialist: item.specialist });
    };

    const closeEdit = () => {
        if (saving) return;
        setEditState(null);
    };

    const handleSave = async () => {
        if (!editState) return;
        if (!editState.text.trim()) {
            setSaveError('Text is required.');
            return;
        }

        const payload: UpsertTrainingExampleRequest = { text: editState.text.trim(), specialist: editState.specialist };
        try {
            setSaving(true);
            setSaveError(null);
            if (editState.id) {
                await updateTrainingExample(editState.id, payload);
            } else {
                await addTrainingExample(payload);
            }
            setEditState(null);
            await fetchItems();
        } catch (err: any) {
            setSaveError(err.response?.data?.message || err.response?.data || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setDeletingId(id);
            await deleteTrainingExample(id);
            await fetchItems();
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> the live training set for the Hinglish symptom router —
                    every row here is a phrase mapped to the specialist it should route to. This is what
                    actually gets retrained on (plus real search→booking feedback, see the Feedback Log tab).
                </p>
                <p>
                    <strong>How to use it:</strong> add new phrasing you've seen patients actually use, fix a
                    row that's mapped to the wrong specialist, or remove noisy/duplicate entries. Changes here
                    take effect on the next retrain (nightly, or "Retrain now" in the Model Info tab).
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <input
                    type="text"
                    placeholder="Search phrase text…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="insights-search-input"
                />
                <select
                    value={specialistFilter}
                    onChange={e => { setSpecialistFilter(e.target.value); setCurrentPage(1); }}
                    className="insights-search-input"
                    style={{ maxWidth: 260 }}
                >
                    <option value="">All specialists</option>
                    {SYMPTOM_ROUTER_SPECIALISTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalItems} examples</span>
                <button className="doctor-edit-btn" style={{ marginLeft: 'auto' }} onClick={openAdd}>
                    <Plus size={14} /> Add phrase
                </button>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Text</th>
                                <th>Specialist</th>
                                <th>Source</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No training examples match these filters.</td></tr>
                            ) : items.map((item) => (
                                <tr key={item.id} className="premium-row">
                                    <td>{item.text}</td>
                                    <td>{item.specialist}</td>
                                    <td style={{ color: '#64748b', fontSize: 12 }}>{item.source}</td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDateTime(item.updatedAt)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="doctor-edit-btn" onClick={() => openEdit(item)}>
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className="doctor-edit-btn"
                                                style={{ color: '#dc2626' }}
                                                disabled={deletingId === item.id}
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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

            {editState && (
                <div className="reject-modal-overlay" onClick={closeEdit}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 18 }}>{editState.id ? 'Edit training phrase' : 'Add training phrase'}</h3>
                            <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Text</label>
                        <textarea
                            value={editState.text}
                            onChange={e => setEditState({ ...editState, text: e.target.value })}
                            rows={3}
                            className="doctor-form-input premium-input"
                            style={{ width: '100%', resize: 'vertical' }}
                            placeholder="e.g. pet mein dard hai aur sar bhi dukh raha hai"
                        />

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', margin: '16px 0 8px' }}>Specialist</label>
                        <select
                            value={editState.specialist}
                            onChange={e => setEditState({ ...editState, specialist: e.target.value })}
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
                            <button className="cancel-btn" onClick={closeEdit} disabled={saving}>Cancel</button>
                            <button className="approve-btn" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingDataPanel;
