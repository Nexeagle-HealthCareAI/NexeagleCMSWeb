import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaAiScenario, VitaAiSuite } from '../types';
import { pct, useLoad, when } from '../components/format';
import { Card, Empty, ErrorBox, Pill } from '../components/shared';
import type { Tone } from '../components/format';

/** AI agents under test (ai-agent skill pack): router /chat and /v1/route-symptom, the WhatsApp bot, any chat endpoint.
 *  Each scenario runs several trials; a cell is green only when every scenario passed every trial (pass^k). Safety-critical
 *  scenarios must never fail. */

const SUITE_ORDER = ['conversation', 'safety', 'injection', 'privacy', 'robustness', 'limits'];
const SEV_TONE: Record<string, Tone> = { critical: 'bad', high: 'warn', medium: 'neutral', low: 'neutral' };
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const passedEvery = (s: VitaAiSuite) => s.scenarios.filter((x) => x.pass_hat_k === true).length;
const conclusive = (s: VitaAiSuite) => s.scenarios.filter((x) => x.conclusive > 0).length;

const Transcript: React.FC<{ sc: VitaAiScenario }> = ({ sc }) => {
    if (sc.transcript.length === 0) return <Empty>{sc.pass_hat_k ? 'Passed every trial.' : 'No transcript recorded.'}</Empty>;
    return (
        <div className="vita-transcript">
            {sc.transcript.map((row, i) =>
                'user' in row ? (
                    <div key={i} className="vita-bubble vita-bubble-user" style={{ alignSelf: 'flex-end' }}>
                        {row.user}
                    </div>
                ) : (
                    <div key={i} className="vita-bubble" style={{ alignSelf: 'flex-start' }}>
                        {row.agent.text || <span className="vita-muted">(no text)</span>}
                        <div className="vita-small vita-muted" style={{ marginTop: 4 }}>
                            {row.agent.kind || '—'} · emergency: {row.agent.emergency ? 'yes' : 'no'}
                            {row.agent.specialties?.length ? ` · ${row.agent.specialties.slice(0, 3).join(', ')}` : ''}
                            {row.agent.status !== 200 ? ` · HTTP ${row.agent.status}` : ''}
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

const VitaAiAgentsPage: React.FC = () => {
    const { data, error, loading, reload } = useLoad(() => vitaApi.aiEvals(), []);
    const [pick, setPick] = React.useState<string | null>(null);   // case_id of the suite shown below the matrix
    const [scenario, setScenario] = React.useState<string | null>(null);

    const suites = data?.suites ?? [];
    const agents = Array.from(new Set(suites.map((s) => s.agent ?? s.adapter ?? '?')));
    const cell = (agent: string, suite: string) => suites.find((s) => (s.agent ?? s.adapter) === agent && s.suite === suite);
    const criticals = suites.flatMap((s) =>
        s.scenarios.filter((x) => x.severity === 'critical' && x.pass_hat_k === false).map((x) => ({ s, x }))
    );
    const shown = suites.find((s) => s.case_id === pick) ?? suites.find((s) => s.status === 'fail') ?? suites[0];
    const scenarios = [...(shown?.scenarios ?? [])].sort(
        (a, b) => Number(a.pass_hat_k !== false) - Number(b.pass_hat_k !== false) || (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
    );
    const sc = scenarios.find((x) => x.id === scenario) ?? scenarios.find((x) => x.pass_hat_k === false) ?? scenarios[0];

    if (error && !data) return <ErrorBox message={vitaApiError(error, 'Could not load the AI agent results.')} onRetry={reload} />;
    if (!data) return <Empty>Loading…</Empty>;
    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <span className="vita-small vita-muted" style={{ maxWidth: 640 }}>
                    Each scenario runs several times. A cell counts the scenarios that passed every trial; safety-critical ones must never fail.
                </span>
                <button className="vita-btn" onClick={reload} disabled={loading} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            {suites.length === 0 ? (
                <Empty>
                    No AI agent has been tested yet. Add <code>ai-agent</code> to a repo's skills (the NLP router and the WhatsApp bot already list it) and run it,
                    or run <code>vita ai-eval</code> from any pipeline.
                </Empty>
            ) : (
                <>
                    {criticals.length > 0 ? (
                        <div className="vita-alert">
                            <AlertTriangle size={20} color="#b91c1c" aria-hidden="true" style={{ flex: 'none' }} />
                            <span>
                                <strong>
                                    {criticals.length} critical scenario{criticals.length === 1 ? '' : 's'} fail
                                </strong>
                                : {criticals.slice(0, 4).map(({ s, x }) => `${s.agent} · ${x.id}`).join('; ')}
                                {criticals.length > 4 ? '…' : ''}
                            </span>
                        </div>
                    ) : (
                        <div className="vita-alert vita-alert-good">
                            <CheckCircle2 size={20} color="#047857" aria-hidden="true" style={{ flex: 'none' }} />
                            <span>No critical scenario fails in the latest results.</span>
                        </div>
                    )}

                    <section className="vita-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="vita-scroll">
                            <table className="vita-table vita-ai-matrix" aria-label="Scenarios passing every trial, per agent and suite">
                                <thead>
                                    <tr>
                                        <th>Agent</th>
                                        {SUITE_ORDER.map((s) => (
                                            <th key={s} style={{ textTransform: 'capitalize' }}>
                                                {s}
                                            </th>
                                        ))}
                                        <th>Last run</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agents.map((a) => {
                                        const last = suites.filter((s) => (s.agent ?? s.adapter) === a).map((s) => s.at).sort().pop();
                                        return (
                                            <tr key={a}>
                                                <th scope="row">{a}</th>
                                                {SUITE_ORDER.map((suite) => {
                                                    const s = cell(a, suite);
                                                    if (!s)
                                                        return (
                                                            <td key={suite}>
                                                                <span className="vita-ai-cell vita-ai-na">—</span>
                                                            </td>
                                                        );
                                                    const n = conclusive(s);
                                                    const ok = passedEvery(s);
                                                    return (
                                                        <td key={suite}>
                                                            <button
                                                                type="button"
                                                                className={`vita-ai-cell ${s.status === 'pass' ? 'vita-ai-ok' : s.status === 'fail' ? 'vita-ai-bad' : 'vita-ai-na'} ${shown?.case_id === s.case_id ? 'on' : ''}`}
                                                                onClick={() => {
                                                                    setPick(s.case_id);
                                                                    setScenario(null);
                                                                }}
                                                                title={s.message}
                                                                aria-pressed={shown?.case_id === s.case_id}
                                                            >
                                                                {n ? `${ok} / ${n}` : s.status}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="vita-nowrap vita-muted">{when(last)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {shown && (
                        <div className="vita-ai-split">
                            <Card
                                title={`${shown.agent} · ${shown.suite}`}
                                right={
                                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {shown.owasp.length > 0 && <Pill tone="neutral">{shown.owasp.map((o) => o.split(' ')[0]).join(' · ')}</Pill>}
                                        <Pill tone="neutral">k = {shown.trials ?? 1}</Pill>
                                        <Link className="vita-link" to={`/vita/runs?repo=${encodeURIComponent(shown.repo)}&run=${encodeURIComponent(shown.run_id)}`}>
                                            run
                                        </Link>
                                    </span>
                                }
                            >
                                <div className="vita-scroll">
                                    <table className="vita-table vita-table-click">
                                        <thead>
                                            <tr>
                                                <th>Scenario</th>
                                                <th>Severity</th>
                                                <th className="num">Trials passed</th>
                                                <th>First failed check</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scenarios.map((x) => (
                                                <tr key={x.id} onClick={() => setScenario(x.id)} aria-selected={sc?.id === x.id} style={sc?.id === x.id ? { background: '#eff6ff' } : undefined}>
                                                    <td className="vita-code" title={x.about ?? ''}>
                                                        {x.id}
                                                    </td>
                                                    <td>
                                                        <Pill tone={SEV_TONE[x.severity] ?? 'neutral'}>{x.severity}</Pill>
                                                    </td>
                                                    <td className={`num ${x.pass_hat_k === false ? 'vita-bad' : ''}`}>
                                                        {x.conclusive ? `${x.passed} / ${x.conclusive}` : 'error'}
                                                    </td>
                                                    <td className="vita-ta-msg vita-muted" title={x.failed[0] ?? x.errors[0] ?? ''}>
                                                        {x.failed[0] ?? x.errors[0] ?? '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="vita-small vita-muted" style={{ marginTop: 8 }}>
                                    pass@1 {pct(shown.summary.pass_at_1)} · every trial {pct(shown.summary.pass_hat_k_rate)}
                                    {shown.model_grader ? ' · model grader on' : ''}
                                    {shown.simulator ? ` · patient simulator: ${shown.simulator}` : ''}
                                </div>
                            </Card>
                            <Card title={sc ? sc.id : 'Transcript'}>
                                {sc ? (
                                    <div className="vita-stack" style={{ gap: 8 }}>
                                        {sc.about && <div className="vita-small vita-muted">{sc.about}</div>}
                                        <Transcript sc={sc} />
                                        {sc.failed.length > 0 && (
                                            <div className="vita-small" style={{ borderTop: '1px solid var(--vita-line)', paddingTop: 8 }}>
                                                <strong>Why it failed:</strong> {Array.from(new Set(sc.failed)).join('; ')}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Empty>Pick a scenario.</Empty>
                                )}
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default VitaAiAgentsPage;
