import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaAgentCard, VitaAgentStats, VitaCalibration } from '../types';
import { ms, num, pct, useLoad } from '../components/format';
import { Card, Empty, ErrorBox, Pill } from '../components/shared';

/** The Agents tab: one card per agent with its last-7-days health, how the agents help each other, and whether the Judge
 *  still agrees with the people who relabel its verdicts. Each card opens the agent's playground (/vita/agents/:name). */

const MixBar: React.FC<{ s: VitaAgentStats | null | undefined }> = ({ s }) => {
    if (!s || !s.steps) return <div className="vita-mixbar" role="img" aria-label="no steps in the last 7 days" />;
    const part = (n: number) => `${((n / s.steps) * 100).toFixed(1)}%`;
    const label = `last 7 days: ${pct(s.llm / s.steps)} model, ${pct(s.rules / s.steps)} rules, ${pct(s.fallback / s.steps)} fallback`;
    return (
        <div className="vita-mixbar" role="img" aria-label={label} title={label}>
            <span className="vita-mix-llm" style={{ width: part(s.llm) }} />
            <span className="vita-mix-rules" style={{ width: part(s.rules + s.replay) }} />
            <span className="vita-mix-fallback" style={{ width: part(s.fallback) }} />
        </div>
    );
};

const AgentCard: React.FC<{ a: VitaAgentCard }> = ({ a }) => {
    const s = a.stats_7d;
    return (
        <article className="vita-card vita-agent">
            <header className="vita-card-head" style={{ marginBottom: 0 }}>
                <h3>{a.title}</h3>
                <Pill tone={a.uses_llm ? 'neutral' : 'good'}>{a.uses_llm ? 'model + rules' : 'rules'}</Pill>
            </header>
            <p>{a.role}</p>
            <MixBar s={s} />
            <div className="vita-legend">
                <span>{num(s?.steps ?? 0)} steps</span>
                <span className={s?.errors ? 'vita-bad' : ''}>{num(s?.errors ?? 0)} errors</span>
                {s?.steps ? <span>{ms(s.avg_ms)} avg</span> : null}
                {s?.fallback_rate ? <span>{pct(s.fallback_rate)} fell back</span> : null}
            </div>
            <div className="vita-ta-actions">
                {a.playground_api ? (
                    <Link className="vita-btn vita-btn-sm" to={`/vita/agents/${encodeURIComponent(a.name)}`}>
                        Try it
                    </Link>
                ) : (
                    <span className="vita-small vita-muted" title="It reaches real hosts or builds images">
                        Try it from the CLI on the Vita VM
                    </span>
                )}
                <span className="vita-small vita-muted">
                    {a.examples.length} example{a.examples.length === 1 ? '' : 's'}
                </span>
            </div>
        </article>
    );
};

const Confusion: React.FC<{ c: VitaCalibration }> = ({ c }) => {
    const labels = Array.from(new Set([...Object.keys(c.judge.confusion), ...Object.values(c.judge.confusion).flatMap((r) => Object.keys(r))])).sort();
    if (labels.length === 0) return null;
    return (
        <div className="vita-scroll">
            <table className="vita-confusion" aria-label="What a person said (rows) against what the Judge said (columns)">
                <thead>
                    <tr>
                        <th scope="col">person ↓ · Judge →</th>
                        {labels.map((l) => (
                            <th key={l} scope="col">
                                {l}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {labels.map((h) => (
                        <tr key={h}>
                            <th scope="row">{h}</th>
                            {labels.map((m) => {
                                const n = c.judge.confusion[h]?.[m] ?? 0;
                                return (
                                    <td key={m} className={h === m ? 'vita-diag' : n > 0 ? 'vita-miss' : ''}>
                                        {n}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CalibrationCard: React.FC = () => {
    const { data: c, error, reload } = useLoad(() => vitaApi.calibration(90), []);
    if (error && !c) return <ErrorBox message={vitaApiError(error, 'Could not load the calibration.')} onRetry={reload} />;
    if (!c) return <Empty>Loading the calibration…</Empty>;
    const j = c.judge;
    return (
        <Card title="Is the Judge still right?" right={<Pill tone={c.healthy ? 'good' : 'warn'}>{c.healthy ? 'healthy' : 'needs attention'}</Pill>}>
            {j.n === 0 ? (
                <Empty>No relabels in the last {c.days} days. Correct the Judge on the Runs tab and its agreement with people shows here.</Empty>
            ) : (
                <div className="vita-stack" style={{ gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 13 }}>
                        Last {c.days} days, {j.n} relabel{j.n === 1 ? '' : 's'}: agreement <strong>{pct(j.agreement)}</strong>, kappa{' '}
                        <strong>{j.kappa === null ? '—' : j.kappa.toFixed(2)}</strong> (alarm below 0.60).{' '}
                        <strong className={c.gate.false_downgrades ? 'vita-bad' : ''}>{c.gate.false_downgrades}</strong> person-confirmed bug
                        {c.gate.false_downgrades === 1 ? '' : 's'} the gate did not count; {c.gate.false_alarms} false alarm{c.gate.false_alarms === 1 ? '' : 's'}.
                    </p>
                    <Confusion c={c} />
                    {c.alerts.map((a) => (
                        <div key={a} className="vita-small vita-bad">
                            {a}
                        </div>
                    ))}
                    <div className="vita-small vita-muted">Fix in this order: tighten the prompt, add the disagreements as examples, change the model.</div>
                </div>
            )}
        </Card>
    );
};

const VitaAgentKitPage: React.FC = () => {
    const { data, error, loading, reload } = useLoad(() => vitaApi.agents(), []);
    if (error && !data) return <ErrorBox message={vitaApiError(error, 'Could not load the agents.')} onRetry={reload} />;
    if (!data) return <Empty>Loading the agents…</Empty>;
    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div>
                    <div style={{ fontSize: 13 }} className="vita-muted">
                        One pipeline, one specialist per step. Bars show the last 7 days: who decided.
                    </div>
                    <div className="vita-legend" style={{ marginTop: 6 }}>
                        <span>
                            <i className="vita-mix-llm" />
                            model
                        </span>
                        <span>
                            <i className="vita-mix-rules" />
                            rules
                        </span>
                        <span>
                            <i className="vita-mix-fallback" />
                            rules after the model failed
                        </span>
                    </div>
                </div>
                <button className="vita-btn" onClick={reload} disabled={loading} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            <div className="vita-agents">
                {data.agents.map((a) => (
                    <AgentCard key={a.name} a={a} />
                ))}
            </div>

            <div className="vita-grid-2">
                <Card title="How they help each other">
                    <div className="vita-flows">
                        {data.flows.map((f) => (
                            <div key={f.name} className="vita-flow">
                                <strong>{f.title}</strong>
                                {f.role}
                                {f.playground_api && (
                                    <div style={{ marginTop: 6 }}>
                                        <Link className="vita-link" to={`/vita/agents/${encodeURIComponent(f.name)}`}>
                                            Try it with a demo
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
                <CalibrationCard />
            </div>
        </div>
    );
};

export default VitaAgentKitPage;
