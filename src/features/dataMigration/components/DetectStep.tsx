import React, { useState } from 'react';
import { updateColumnMapping, type BatchDetail, type ColumnMappingEntry } from '../services/dataMigrationService';

interface Props {
    batch: BatchDetail;
    onConfirmed: (mapping: ColumnMappingEntry[]) => void;
}

const FIELD_LABELS: Record<string, string> = {
    appointment_id: 'Appointment ID',
    appointment_date: 'Appointment date',
    appointment_time: 'Appointment time',
    patient_name: 'Patient name',
    relation: 'Guardian relation',
    guardian_name: 'Guardian name',
    age_years: 'Age (years)',
    age_display: 'Age (display)',
    gender: 'Gender',
    doctor_name: 'Doctor name',
    department: 'Department',
};

const REQUIRED_FIELDS = new Set([
    'appointment_id', 'appointment_date', 'appointment_time', 'patient_name',
    'age_years', 'age_display', 'gender', 'doctor_name', 'department',
]);

const DetectStep: React.FC<Props> = ({ batch, onConfirmed }) => {
    const [mapping, setMapping] = useState<ColumnMappingEntry[]>(batch.columnMapping);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setHeader = (targetField: string, sourceHeader: string) => {
        setMapping((prev) =>
            prev.map((entry) =>
                entry.targetField === targetField
                    ? { ...entry, sourceHeader: sourceHeader || null, source: 'manual' as const }
                    : entry
            )
        );
    };

    const missingRequired = mapping.filter((m) => REQUIRED_FIELDS.has(m.targetField) && !m.sourceHeader);

    const handleContinue = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateColumnMapping(batch.batchId, mapping);
            onConfirmed(mapping);
        } catch (err) {
            console.error(err);
            setError('Could not save the column mapping. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {batch.warnings.length > 0 && (
                <div className="dm-warning-list">
                    {batch.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
            )}

            <table className="dm-mapping-table">
                <thead>
                    <tr>
                        <th>Target field</th>
                        <th>CSV column</th>
                    </tr>
                </thead>
                <tbody>
                    {mapping.map((entry) => (
                        <tr key={entry.targetField}>
                            <td>
                                {FIELD_LABELS[entry.targetField] ?? entry.targetField}
                                {REQUIRED_FIELDS.has(entry.targetField) && !entry.sourceHeader && (
                                    <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>
                                )}
                                {entry.source === 'groq' && <span className="dm-badge-ai">AI suggested</span>}
                            </td>
                            <td>
                                <select
                                    value={entry.sourceHeader ?? ''}
                                    onChange={(e) => setHeader(entry.targetField, e.target.value)}
                                >
                                    <option value="">-- not mapped --</option>
                                    {batch.rawHeaders.map((h) => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {batch.sampleRawRows.length > 0 && (
                <>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', margin: '20px 0 8px' }}>
                        Sample rows from your file
                    </label>
                    <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                        <table className="dm-mapping-table">
                            <thead>
                                <tr>{batch.rawHeaders.map((h) => <th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {batch.sampleRawRows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {batch.rawHeaders.map((h) => <td key={h}>{row[h] ?? ''}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {missingRequired.length > 0 && (
                <div className="dm-warning-list">
                    Map every required field (*) before continuing: {missingRequired.map((m) => FIELD_LABELS[m.targetField] ?? m.targetField).join(', ')}.
                </div>
            )}

            {error && <div className="dm-warning-list">{error}</div>}

            <div className="dm-actions-row">
                <button
                    className="dm-btn-primary"
                    disabled={missingRequired.length > 0 || saving}
                    onClick={handleContinue}
                >
                    {saving ? 'Saving...' : 'Continue to Transform'}
                </button>
            </div>
        </div>
    );
};

export default DetectStep;
