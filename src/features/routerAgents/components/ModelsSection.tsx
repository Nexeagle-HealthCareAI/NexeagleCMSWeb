import React from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { routerAgentsService, errorText, type AgentServiceStatus, type ModelVersion } from '../services/routerAgentsService';
import { num, pct, useLoad, when } from '../../vitaAgents/components/format';
import { Card, Empty, ErrorBox, Pill, Tile } from '../../vitaAgents/components/shared';
import { versionLabel } from './labels';

const POLL_MS = 5000;

const delta = (now: number | null, before: number | null, lowerIsBetter = false) => {
    if (now == null || before == null) return null;
    const d = now - before;
    if (Math.abs(d) < 0.0005) return <span className="vita-muted vita-small"> ±0</span>;
    const good = lowerIsBetter ? d < 0 : d > 0;
    return <span className={`vita-small ${good ? 'vita-good' : 'vita-bad'}`}> {d > 0 ? '+' : '−'}{Math.abs(d * 100).toFixed(1)} pts</span>;
};

export const ModelsSection: React.FC<{ status: AgentServiceStatus | null; reloadStatus: () => void; canManage: boolean }> = ({ status, reloadStatus, canManage }) => {
    const models = useLoad(() => routerAgentsService.models(50), []);
    const [starting, setStarting] = React.useState(false);
    const running = status?.rebuild?.state === 'running';
    const { reload } = models;

    // While a rebuild runs, follow its progress; when it finishes, load the new row.
    React.useEffect(() => {
        if (!running) return;
        const id = setInterval(reloadStatus, POLL_MS);
        return () => {
            clearInterval(id);
            reload();
        };
    }, [running, reloadStatus, reload]);

    const rebuild = async () => {
        setStarting(true);
        try {
            toast.success((await routerAgentsService.rebuild()).message);
            reloadStatus();
        } catch (e) {
            toast.error(errorText(e, 'Could not start the rebuild.'));
        } finally {
            setStarting(false);
        }
    };

    const rows = models.data ?? [];
    const live = rows.filter(r => r.promoted && r.top1 != null).slice().reverse();
    const chart = live.map(r => ({
        name: new Date(r.builtAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        version: r.modelVersion,
        top1: r.top1,
        answeredAccuracy: r.answeredAccuracy,
        confidentlyWrong: r.confidentlyWrong,
    }));
    // Scores of the model in service: the router's own report, else the rebuild record of that version.
    const ownRow = rows.find(r => r.modelVersion && r.modelVersion === status?.modelVersion);
    const v = (status?.validation as Record<string, number> | null | undefined)
        ?? (ownRow && ownRow.top1 != null ? {
            top1: ownRow.top1, top3: ownRow.top3 ?? NaN, answeredAccuracy: ownRow.answeredAccuracy ?? NaN,
            confidentlyWrong: ownRow.confidentlyWrong ?? NaN,
        } as Record<string, number> : null);

    return (
        <div className="vita-stack">
            <Card title="Model answering patients now" right={canManage && (
                <button className="vita-btn ra-primary" onClick={rebuild} disabled={starting || running}>
                    <RefreshCw size={14} className={running ? 'vita-spin' : ''} /> {running ? `Rebuilding: ${status?.rebuild?.step ?? '…'}` : 'Rebuild and test now'}
                </button>
            )}>
                {!status ? <Empty>Loading…</Empty> : !status.reachable ? (
                    <ErrorBox message={`Router not reachable: ${status.error ?? 'unknown error'}`} onRetry={reloadStatus} />
                ) : (
                    <>
                        <div className="vita-tiles">
                            <Tile label="Version" value={status.modelVersion?.split('-').pop() ?? '—'} sub={status.modelBuiltAt ? `built ${when(status.modelBuiltAt)}` : status.modelVersion ?? undefined} title={status.modelVersion ?? undefined} />
                            <Tile label="Training sentences" value={num(status.trainingRows)} />
                            <Tile label="Right first time" value={pct(v?.top1, 1)} sub="top-1 on held-out test" title="Share of test sentences whose first specialty was correct" />
                            <Tile label="Right in top 3" value={pct(Number.isNaN(v?.top3) ? null : v?.top3, 1)} />
                            <Tile label="Accuracy when it answers" value={pct(Number.isNaN(v?.answeredAccuracy) ? null : v?.answeredAccuracy, 1)} title="Of the test sentences it answered without asking, how many were right" />
                            <Tile label="Confidently wrong" value={pct(v?.confidentlyWrong, 1)} tone={v?.confidentlyWrong == null ? 'neutral' : v.confidentlyWrong > 0.05 ? 'bad' : v.confidentlyWrong > 0.025 ? 'warn' : 'good'} title="Answered without asking AND wrong: the costly mistake" />
                            <Tile label="LLM reasoner" value={status.reasoner === 'NoReasoner' ? 'Off' : status.reasoner ?? '—'} />
                        </div>
                        {!v && <p className="vita-muted vita-small">This model was built before testing was added. Test scores appear after the first rebuild.</p>}
                    </>
                )}
            </Card>

            <Card title="Is it getting better? (models that went live)">
                {chart.length < 2 ? (
                    <Empty>{chart.length === 0 ? 'No tested model yet. Run a rebuild to start the history.' : 'One tested model so far. The trend appears after the next rebuild.'}</Empty>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} tickFormatter={x => `${Math.round(x * 100)}%`} />
                            <Tooltip formatter={(x) => pct(typeof x === 'number' ? x : null, 1)} labelFormatter={(_, p) => p?.[0]?.payload?.version ?? ''} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line dataKey="top1" isAnimationActive={false} dot={{ r: 3 }} name="Right first time" stroke="#2a78d6" strokeWidth={2} />
                            <Line dataKey="answeredAccuracy" isAnimationActive={false} dot={{ r: 3 }} name="Accuracy when it answers" stroke="#1baf7a" strokeWidth={2} />
                            <Line dataKey="confidentlyWrong" isAnimationActive={false} dot={{ r: 3 }} name="Confidently wrong" stroke="#e34948" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Card>

            <Card title="Every rebuild">
                {models.error && !models.data ? <ErrorBox message={errorText(models.error, 'Could not load model history.')} onRetry={reload} />
                    : !models.data ? <Empty>Loading…</Empty>
                    : rows.length === 0 ? <Empty>No rebuilds recorded yet.</Empty>
                    : (
                        <div className="vita-scroll">
                            <table className="vita-table">
                                <thead>
                                    <tr>
                                        <th>Built</th>
                                        <th>Result</th>
                                        <th className="num">Right first time</th>
                                        <th className="num">Confidently wrong</th>
                                        <th className="num">Corrections learned</th>
                                        <th>Why</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r: ModelVersion) => (
                                        <tr key={r.id}>
                                            <td className="vita-nowrap">
                                                {when(r.builtAt)}
                                                <div className="vita-muted vita-small" title={r.modelVersion ?? ''}>{r.modelVersion ? versionLabel(r.modelVersion).split(' · ')[1] : 'failed'} · {r.triggerReason === 'deploy' ? 'after deploy' : 'manual'}</div>
                                            </td>
                                            <td>{r.modelVersion == null ? <Pill tone="bad">Failed</Pill> : r.promoted ? <Pill tone="good">Went live</Pill> : <Pill tone="warn">Kept old model</Pill>}</td>
                                            <td className="num">{pct(r.top1, 1)}{delta(r.top1, r.prevTop1)}</td>
                                            <td className="num">{pct(r.confidentlyWrong, 1)}{delta(r.confidentlyWrong, r.prevConfidentlyWrong, true)}</td>
                                            <td className="num">{num(r.learnedItems)}<div className="vita-muted vita-small">{num(r.cmsRows)} CMS rows</div></td>
                                            <td className="vita-wrap vita-small">{r.verdict ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </Card>
        </div>
    );
};

export default ModelsSection;
