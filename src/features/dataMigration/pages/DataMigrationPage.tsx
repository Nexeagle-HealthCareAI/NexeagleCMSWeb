import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHospitalById } from '../../dashboard/services/hospitalService';
import { getBatches, type BatchListItem } from '../services/dataMigrationService';
import '../../dashboard/pages/Dashboard.css';
import '../../dashboard/pages/PremiumHospitals.css';
import './DataMigration.css';

const DataMigrationPage: React.FC = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<BatchListItem[]>([]);
    const [hospitalNames, setHospitalNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchBatches = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getBatches(undefined, page, 20);
            setBatches(result.data);
            setTotalPages(result.pagination.totalPages || 1);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to load migration batches.');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    useEffect(() => {
        const missing = [...new Set(batches.map((b) => b.hospitalId))].filter((id) => !(id in hospitalNames));
        if (missing.length === 0) return;
        missing.forEach((id) => {
            getHospitalById(id)
                .then((h) => setHospitalNames((prev) => ({ ...prev, [id]: h.name })))
                .catch(() => setHospitalNames((prev) => ({ ...prev, [id]: id })));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batches]);

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Data Migration</h1>
                    <p className="premium-subtitle">Import legacy hospital data with a step-by-step, reviewable pipeline.</p>
                </div>
                <button className="dm-btn-primary" onClick={() => navigate('/data-migration/new')}>
                    New Migration
                </button>
            </header>

            <div className="premium-table-card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
                ) : error ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
                ) : batches.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No migration batches yet. Start one with "New Migration".
                    </div>
                ) : (
                    <div className="premium-responsive-wrapper premium-desktop-table">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Hospital</th>
                                    <th>Data type</th>
                                    <th>File</th>
                                    <th>Rows</th>
                                    <th>Status</th>
                                    <th>Started</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map((batch) => (
                                    <tr
                                        className="premium-row"
                                        key={batch.batchId}
                                        onClick={() => navigate(`/data-migration/${batch.batchId}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{hospitalNames[batch.hospitalId] ?? '...'}</td>
                                        <td>{batch.dataType}</td>
                                        <td>{batch.sourceFileName}</td>
                                        <td>{batch.sourceRowCount ?? '--'}</td>
                                        <td><span className={`dm-status-chip ${batch.status}`}>{batch.status}</span></td>
                                        <td>{new Date(batch.createdAt).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="dm-actions-row" style={{ justifyContent: 'center' }}>
                    <button className="dm-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span style={{ alignSelf: 'center', fontSize: '13px', color: '#64748b' }}>Page {page} of {totalPages}</span>
                    <button className="dm-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
};

export default DataMigrationPage;
