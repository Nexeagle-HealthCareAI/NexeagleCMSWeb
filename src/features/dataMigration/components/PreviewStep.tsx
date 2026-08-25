import React, { useEffect, useState } from 'react';
import { getHospitalById, type Doctor } from '../../dashboard/services/hospitalService';
import {
    getRows,
    transformBatch,
    updateDoctorMap,
    type BatchDetail,
    type DoctorMapEntry,
    type MigrationRow,
} from '../services/dataMigrationService';

interface Props {
    batch: BatchDetail;
    doctorMap: DoctorMapEntry[];
    onBatchUpdated: (batch: BatchDetail) => void;
}

const PAGE_SIZE = 50;

const PreviewStep: React.FC<Props> = ({ batch, doctorMap, onBatchUpdated }) => {
    const [rows, setRows] = useState<MigrationRow[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [hospitalDoctors, setHospitalDoctors] = useState<Doctor[]>([]);
    const [mapEdits, setMapEdits] = useState<Record<string, string>>({});
    const [retransforming, setRetransforming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getHospitalById(batch.hospitalId)
            .then((h) => setHospitalDoctors(h.doctors ?? []))
            .catch(() => setHospitalDoctors([]));
    }, [batch.hospitalId]);

    useEffect(() => {
        setLoading(true);
        getRows(batch.batchId, page, PAGE_SIZE, statusFilter || undefined)
            .then((result) => {
                setRows(result.data);
                setTotalPages(result.pagination.totalPages || 1);
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [batch.batchId, page, statusFilter]);

    const unmapped = doctorMap.filter((d) => !d.mappedDoctorId);

    const mapKey = (d: DoctorMapEntry) => `${d.sourceDoctorName}|${d.sourceDepartment ?? ''}`;

    const handleSaveDoctorMap = async () => {
        const updated = doctorMap.map((d) => {
            const chosen = mapEdits[mapKey(d)];
            if (!chosen) return d;
            const doctor = hospitalDoctors.find((h) => h.id === chosen);
            return { ...d, mappedDoctorId: chosen, mappedDoctorName: doctor?.name ?? null };
        });

        setRetransforming(true);
        setError(null);
        try {
            await updateDoctorMap(batch.batchId, updated);
            const refreshed = await transformBatch(batch.batchId);
            onBatchUpdated(refreshed);
            setMapEdits({});
            setPage(1);
        } catch (err) {
            console.error(err);
            setError('Could not re-run the transform with the updated doctor mapping.');
        } finally {
            setRetransforming(false);
        }
    };

    const summary = batch.summary;

    return (
        <div>
            {summary && (
                <div className="dm-summary-cards">
                    <div className="dm-summary-card"><div className="value">{summary.totalRows}</div><div className="label">Total rows</div></div>
                    <div className="dm-summary-card"><div className="value">{summary.newPatients}</div><div className="label">New patients</div></div>
                    <div className="dm-summary-card"><div className="value">{summary.matchedExistingDbPatients}</div><div className="label">Matched existing</div></div>
                    <div className="dm-summary-card"><div className="value">{summary.reusedWithinBatch}</div><div className="label">Reused in batch</div></div>
                    <div className="dm-summary-card"><div className="value">{summary.flaggedRows}</div><div className="label">Flagged</div></div>
                    <div className="dm-summary-card"><div className="value">{summary.excludedRows}</div><div className="label">Excluded</div></div>
                </div>
            )}

            {summary?.narrative && (
                <div className="dm-narrative-card">
                    <div className="dm-narrative-title">AI summary{summary.narrative.groqUsed ? '' : ' (template)'}</div>
                    <div>{summary.narrative.outlook}</div>
                    <ul>
                        {summary.narrative.insights.map((insight, i) => <li key={i}>{insight}</li>)}
                    </ul>
                    <div className="dm-narrative-disclaimer">AI-generated -- verify before acting on it.</div>
                </div>
            )}

            {unmapped.length > 0 && (
                <div className="dm-doctor-map-panel">
                    <strong>{unmapped.length} doctor(s) from the file need mapping</strong> -- rows for
                    these doctors are excluded until mapped.
                    {unmapped.map((d) => (
                        <div className="dm-doctor-map-row" key={mapKey(d)}>
                            <span style={{ minWidth: '220px' }}>{d.sourceDoctorName} {d.sourceDepartment ? `(${d.sourceDepartment})` : ''}</span>
                            <select
                                value={mapEdits[mapKey(d)] ?? ''}
                                onChange={(e) => setMapEdits((prev) => ({ ...prev, [mapKey(d)]: e.target.value }))}
                            >
                                <option value="">-- select doctor --</option>
                                {hospitalDoctors.map((doc) => (
                                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="dm-actions-row">
                        <button
                            className="dm-btn-secondary"
                            disabled={Object.keys(mapEdits).length === 0 || retransforming}
                            onClick={handleSaveDoctorMap}
                        >
                            {retransforming ? 'Re-running...' : 'Save mapping & re-run transform'}
                        </button>
                    </div>
                </div>
            )}

            {error && <div className="dm-warning-list">{error}</div>}

            <div className="dm-field-group" style={{ maxWidth: '260px' }}>
                <label>Filter by status</label>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="">All</option>
                    <option value="Ready">Ready</option>
                    <option value="Flagged">Flagged</option>
                    <option value="Excluded">Excluded</option>
                </select>
            </div>

            <div className="premium-table-card">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Patient</th>
                            <th>Doctor</th>
                            <th>Status</th>
                            <th>Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5}>Loading...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={5}>No rows.</td></tr>
                        ) : rows.map((row) => (
                            <tr className="premium-row" key={row.rowId}>
                                <td>{row.sourceRowNumber}</td>
                                <td>{row.transformed?.patient_name ?? row.raw['patient_name'] ?? '--'}</td>
                                <td>{row.transformed?.doctor_name ?? '--'}</td>
                                <td><span className={`dm-status-chip ${row.rowStatus}`}>{row.rowStatus}</span></td>
                                <td>
                                    {row.flags.map((flag, i) => <span className="dm-flag-chip" key={i} title={flag}>{flag.split(':')[0]}</span>)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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

export default PreviewStep;
