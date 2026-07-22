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
                    <strong>What this is:</strong> the currently-deployed symptom router model's version,
                    when it was last retrained, and how it scored on the frozen validation set (never
                    trained on, so these numbers stay comparable across retrains).
                </p>
                <p>
                    <strong>How to use it:</strong> a retrain only ever replaces the live model if it
                    doesn't score worse than what's already deployed — "Retrain now" is safe to click
                    any time; it either promotes an improved model or silently does nothing.
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
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Top-1 Accuracy</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{pct(info.validationMetrics?.top1Accuracy)}</div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Top-K Accuracy</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{pct(info.validationMetrics?.topKAccuracy)}</div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Confidently Wrong</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{pct(info.validationMetrics?.confidentlyWrongRate)}</div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Training Rows</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{info.trainingRowCount ?? '—'}</div>
                        </div>
                    </div>

                    <button className="approve-btn" onClick={handleRetrain} disabled={triggering}>
                        <RefreshCw size={14} className={triggering ? 'spin' : ''} /> {triggering ? 'Triggering…' : 'Retrain now'}
                    </button>
                    {triggerMessage && (
                        <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>{triggerMessage}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelInfoPanel;
