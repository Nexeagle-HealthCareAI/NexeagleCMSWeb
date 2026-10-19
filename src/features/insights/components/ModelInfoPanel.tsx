import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';
import { getModelInfo, triggerRetrain, type ModelInfo } from '../services/symptomRouterService';
import { InsightsExplainer } from './InsightsExplainer';

const formatDateTime = (iso: string | null): string => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const pct = (n: number | null | undefined): string => n == null ? '—' : `${(n * 100).toFixed(1)}%`;

export const ModelInfoPanel: React.FC = () => {
    const [info, setInfo] = useState<ModelInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [triggering, setTriggering] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

    const fetchInfo = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getModelInfo();
            setInfo(result);
        } catch {
            setError('Could not reach the NLP router service.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchInfo(); }, [fetchInfo]);

    const handleRetrain = async () => {
        try {
            setTriggering(true);
            setTriggerMessage(null);
            const result = await triggerRetrain();
            setTriggerMessage(result.message);
        } catch (err: any) {
            setTriggerMessage(err.response?.data || 'Failed to trigger retrain.');
        } finally {
            setTriggering(false);
        }
    };

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>What this is:</strong> the symptom router model currently answering Doctor Dekho
                    searches: its version, when it was built, and how many example phrases it was built from.
                </p>
                <p>
                    <strong>Accuracy figures</strong> are shown only when the router publishes them. The router in
                    service today does not measure itself against a held-out validation set yet, so no accuracy is
                    shown rather than a made-up one. The model is rebuilt from the 1HMS-NLP-Router repository's
                    training files when that service is redeployed; there is no automatic retrain.
                </p>
            </InsightsExplainer>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div>
            ) : error ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>
            ) : info && (
                <div className="premium-table-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Cpu size={20} color="#6366f1" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{info.modelVersion || 'unknown'}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>Last retrained: {formatDateTime(info.lastRetrainedAt)}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Training phrases</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{info.trainingRowCount?.toLocaleString() ?? '—'}</div>
                        </div>
                        {info.emergencyRows != null && (
                            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Emergency-labelled phrases</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{info.emergencyRows.toLocaleString()}</div>
                            </div>
                        )}
                        {info.validationMetrics && (
                            <>
                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Top-1 Accuracy</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{pct(info.validationMetrics.top1Accuracy)}</div>
                                </div>
                                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Confidently Wrong</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{pct(info.validationMetrics.confidentlyWrongRate)}</div>
                                </div>
                            </>
                        )}
                    </div>
                    {info.sources && Object.keys(info.sources).length > 0 && (
                        <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                            Built from: {Object.entries(info.sources).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' · ')}
                        </div>
                    )}
                    {!info.validationMetrics && (
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                            Accuracy not published by this router version. Retraining from the CMS is turned off: the
                            current router does not read the CMS training table yet.
                        </div>
                    )}
                    {info.validationMetrics && (
                        <button className="approve-btn" style={{ marginTop: 16 }} onClick={handleRetrain} disabled={triggering}>
                            <RefreshCw size={14} className={triggering ? 'spin' : ''} /> {triggering ? 'Triggering…' : 'Retrain now'}
                        </button>
                    )}
                    {triggerMessage && (
                        <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>{triggerMessage}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelInfoPanel;
