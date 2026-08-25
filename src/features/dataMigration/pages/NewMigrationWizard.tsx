import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StepperHeader, { type WizardStep } from '../components/StepperHeader';
import UploadStep from '../components/UploadStep';
import DetectStep from '../components/DetectStep';
import TransformStep from '../components/TransformStep';
import PreviewStep from '../components/PreviewStep';
import { getBatch, getDoctorMap, type BatchDetail, type DoctorMapEntry } from '../services/dataMigrationService';
import '../../dashboard/pages/Dashboard.css';
import '../../dashboard/pages/PremiumHospitals.css';
import './DataMigration.css';

const stepForStatus = (status: string): WizardStep => {
    switch (status) {
        case 'Ready':
        case 'Committing':
        case 'Committed':
        case 'RolledBack':
            return 'preview';
        case 'Failed':
        case 'Uploaded':
        case 'Detected':
        default:
            return 'detect';
    }
};

const NewMigrationWizard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [step, setStep] = useState<WizardStep>('upload');
    const [batch, setBatch] = useState<BatchDetail | null>(null);
    const [doctorMap, setDoctorMap] = useState<DoctorMapEntry[]>([]);
    const [loading, setLoading] = useState(!!id);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        getBatch(id)
            .then(async (loaded) => {
                setBatch(loaded);
                setStep(stepForStatus(loaded.status));
                if (loaded.status === 'Ready') {
                    const map = await getDoctorMap(loaded.batchId).catch(() => []);
                    setDoctorMap(map);
                }
            })
            .catch(() => setError('Could not load this migration batch.'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleUploaded = (uploaded: BatchDetail) => {
        setBatch(uploaded);
        navigate(`/data-migration/${uploaded.batchId}`, { replace: true });
        setStep('detect');
    };

    const handleDetectConfirmed = () => {
        setStep('transform');
    };

    const handleTransformDone = async (transformed: BatchDetail) => {
        setBatch(transformed);
        const map = await getDoctorMap(transformed.batchId).catch(() => []);
        setDoctorMap(map);
        setStep('preview');
    };

    const handleTransformError = (message: string) => {
        setError(message);
        setStep('detect');
    };

    const handlePreviewBatchUpdated = async (updated: BatchDetail) => {
        setBatch(updated);
        const map = await getDoctorMap(updated.batchId).catch(() => []);
        setDoctorMap(map);
    };

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">New Migration</h1>
                    <p className="premium-subtitle">Upload a CSV, review every step, then hand it off for approval.</p>
                </div>
            </header>

            <div className="dm-wizard-card">
                <StepperHeader current={step} />

                {error && <div className="dm-warning-list">{error}</div>}

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
                ) : (
                    <>
                        {step === 'upload' && <UploadStep onUploaded={handleUploaded} />}
                        {step === 'detect' && batch && <DetectStep batch={batch} onConfirmed={handleDetectConfirmed} />}
                        {step === 'transform' && batch && (
                            <TransformStep batchId={batch.batchId} onDone={handleTransformDone} onError={handleTransformError} />
                        )}
                        {step === 'preview' && batch && (
                            <PreviewStep batch={batch} doctorMap={doctorMap} onBatchUpdated={handlePreviewBatchUpdated} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default NewMigrationWizard;
