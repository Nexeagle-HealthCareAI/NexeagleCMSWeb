import React from 'react';
import { Coins, TrendingDown, Database, Layers } from 'lucide-react';
import '../../dashboard/pages/Dashboard.css'; // reuse dashboard styles for consistency
import { getRadAiUsage, type RadAiUsage } from '../services/radaiUsageService';

const fmtNum = (n: number) => (Number.isFinite(n) ? n : 0);
const fmtTokens = (n: number) => fmtNum(n).toLocaleString();
const fmtUsd = (n: number) => {
    const v = fmtNum(n);
    return '$' + (Math.abs(v) < 1 ? v.toFixed(4) : v.toFixed(2));
};

const StatCard: React.FC<{ label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: string }> =
    ({ label, value, sub, icon, accent = '#0f172a' }) => (
        <div className="table-card" style={{ padding: '20px 22px', flex: '1 1 200px', minWidth: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
                {icon}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: accent, letterSpacing: '-0.5px' }}>{value}</div>
            {sub && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{sub}</div>}
        </div>
    );

const RadAiCost: React.FC = () => {
    const [data, setData] = React.useState<RadAiUsage | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [days, setDays] = React.useState(30);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getRadAiUsage(days)
            .then((d) => { if (!cancelled) setData(d); })
            .catch(() => { if (!cancelled) setError('Failed to load RadAI usage'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days]);

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        <Coins size={28} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                        RadAI Cost &amp; Savings
                    </h1>
                    <p className="dashboard-subtitle">Token usage and what response + prompt caching are saving.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            style={{
                                padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                                border: '1px solid ' + (days === d ? '#0f52ba' : '#e2e8f0'),
                                background: days === d ? '#0f52ba' : 'white',
                                color: days === d ? 'white' : '#475569',
                            }}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </header>

            {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading usage…</div>}
            {error && <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>{error}</div>}

            {!loading && !error && data && (
                <>
                    {/* Headline row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                        <StatCard
                            label="Requests"
                            value={fmtTokens(data.totalRequests)}
                            sub={`${fmtTokens(data.cacheHits)} served from cache`}
                            icon={<Layers size={18} color="#94a3b8" />}
                        />
                        <StatCard
                            label="Cache hit rate"
                            value={`${fmtNum(data.cacheHitRatePct)}%`}
                            sub="repeats that skipped the model"
                            icon={<Database size={18} color="#94a3b8" />}
                            accent="#0f52ba"
                        />
                        <StatCard
                            label="Would-be cost"
                            value={fmtUsd(data.baselineCostUsd)}
                            sub="without any caching"
                        />
                        <StatCard
                            label="Actual cost"
                            value={fmtUsd(data.actualCostUsd)}
                            sub="what RadAI billed"
                        />
                        <StatCard
                            label="Saved"
                            value={fmtUsd(data.savedCostUsd)}
                            sub={`${fmtNum(data.savedPct)}% lower`}
                            icon={<TrendingDown size={18} color="#16a34a" />}
                            accent="#16a34a"
                        />
                    </div>

                    {/* Savings split */}
                    <div className="table-card" style={{ padding: '24px', marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a' }}>Where the savings come from</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                            <div style={{ flex: '1 1 240px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Response cache</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', margin: '4px 0' }}>{fmtUsd(data.responseCacheSavedUsd)}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    {fmtTokens(data.responseCacheSavedInputTokens + data.responseCacheSavedOutputTokens)} tokens avoided (repeated questions)
                                </div>
                            </div>
                            <div style={{ flex: '1 1 240px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Prompt cache</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', margin: '4px 0' }}>{fmtUsd(data.promptCacheSavedUsd)}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    {fmtTokens(data.promptCacheReadTokens)} system-prompt tokens billed at ~10%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Token detail */}
                    <div className="table-card" style={{ padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a' }}>Tokens (window: {data.windowDays} days)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                            {[
                                ['Billed input', fmtTokens(data.billedInputTokens)],
                                ['Billed output', fmtTokens(data.billedOutputTokens)],
                                ['Prompt-cache reads', fmtTokens(data.promptCacheReadTokens)],
                                ['Response-cache saved', fmtTokens(data.responseCacheSavedInputTokens + data.responseCacheSavedOutputTokens)],
                            ].map(([k, v]) => (
                                <div key={k} style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{k}</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155', marginTop: '4px' }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px', lineHeight: 1.6 }}>
                            {data.note} Rate used: ${fmtNum(data.inputRatePerMTok)}/1M in, ${fmtNum(data.outputRatePerMTok)}/1M out.
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RadAiCost;
