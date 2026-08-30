import React, { useEffect, useState } from 'react';
import { getHospitals, type Hospital } from '../../dashboard/services/hospitalService';
import { uploadBatch, type BatchDetail } from '../services/dataMigrationService';

interface Props {
    onUploaded: (batch: BatchDetail) => void;
}

const UploadStep: React.FC<Props> = ({ onUploaded }) => {
    const [hospitalSearch, setHospitalSearch] = useState('');
    const [hospitalOptions, setHospitalOptions] = useState<Hospital[]>([]);
    const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
    const [dataType, setDataType] = useState('AppointmentsRegister');
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hospitalSearch || selectedHospital) {
            setHospitalOptions([]);
            return;
        }
        const handle = setTimeout(async () => {
            try {
                const result = await getHospitals(1, 8, hospitalSearch);
                setHospitalOptions(result.data);
            } catch {
                setHospitalOptions([]);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [hospitalSearch, selectedHospital]);

    const handleSubmit = async () => {
        if (!selectedHospital || !file) return;
        setUploading(true);
        setError(null);
        try {
            const batch = await uploadBatch(selectedHospital.id, dataType, file);
            if (batch.status === 'Failed') {
                setError(batch.errorMessage || 'Upload failed.');
                setUploading(false);
                return;
            }
            onUploaded(batch);
        } catch (err) {
            console.error(err);
            setError('Could not process the file -- the migration service may be unavailable.');
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="dm-field-group">
                <label>Target hospital</label>
                {selectedHospital ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 600 }}>{selectedHospital.name}</span>
                        <button className="dm-btn-secondary" onClick={() => { setSelectedHospital(null); setHospitalSearch(''); }}>
                            Change
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Search hospitals by name..."
                            value={hospitalSearch}
                            onChange={(e) => setHospitalSearch(e.target.value)}
                        />
                        {hospitalOptions.length > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                                {hospitalOptions.map((h) => (
                                    <div
                                        key={h.id}
                                        onClick={() => { setSelectedHospital(h); setHospitalOptions([]); }}
                                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                    >
                                        <div style={{ fontWeight: 600 }}>{h.name}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{[h.city, h.state].filter(Boolean).join(', ')}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="dm-field-group">
                <label>Data type</label>
                <select value={dataType} onChange={(e) => setDataType(e.target.value)}>
                    <option value="AppointmentsRegister">Appointments Register</option>
                    <option value="PatientMaster" disabled>Patient Master (coming soon)</option>
                </select>
            </div>

            <div className="dm-field-group">
                <label>CSV file</label>
                <div
                    className={`dm-dropzone ${dragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) setFile(dropped);
                    }}
                    onClick={() => document.getElementById('dm-file-input')?.click()}
                >
                    {file ? (
                        <span>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                    ) : (
                        <span>Click to browse, or drag a CSV file here</span>
                    )}
                    <input
                        id="dm-file-input"
                        type="file"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                </div>
            </div>

            {error && <div className="dm-warning-list">{error}</div>}

            <div className="dm-actions-row">
                <button
                    className="dm-btn-primary"
                    disabled={!selectedHospital || !file || uploading}
                    onClick={handleSubmit}
                >
                    {uploading ? 'Uploading...' : 'Upload & Detect'}
                </button>
            </div>
        </div>
    );
};

export default UploadStep;
