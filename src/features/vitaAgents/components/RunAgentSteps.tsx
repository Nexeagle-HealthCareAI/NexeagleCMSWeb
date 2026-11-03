import React from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaAgentStep, VitaReplayResult } from '../types';
import { threadSteps, type StepNode } from './qualityHelpers';
import { ms, num } from './format';
import { Empty, ErrorBox, Pill } from './shared';
import { useVitaAccess } from './testAgent';

/** "How the agents worked" for one run: every agent step in order, the help requests nested under the step that asked,
 *  and the selected step in full (what it was given, what it decided, the model calls) with replay. */

const MODE_LABEL: Record<string, string> = { llm: 'model', rules: 'rules', fallback: 'rules after the model failed', replay: 'replay' };
const KIND_LABEL: Record<string, string> = { retry: 'retry', probe: 'blast radius', 'related-cases': 'blast radius', trial: 'trial run', repair: 'repair' };
const FOLD_AFTER = 3;


const json = (v: unknown) => {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
};

const StepButton: React.FC<{ s: StepNode; selected: string | null; onPick: (id: string) => void }> = ({ s, selected, onPick }) => (
    <li>
        <button
            type="button"
            className={`vita-tl-step ${selected === s.id ? 'on' : ''} ${s.error ? 'err' : ''}`}
            onClick={() => onPick(s.id)}
            aria-pressed={selected === s.id}
        >
            <span className={`vita-who vita-who-${s.agent}`}>{s.agent}</span>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span className="vita-tl-title">
                    {s.requested_by ? `asked by ${s.requested_by}: ` : ''}
                    {s.title ?? s.agent}
                </span>
                <span className="vita-tl-meta" style={{ display: 'block' }}>
                    {s.kind ? `${KIND_LABEL[s.kind] ?? s.kind} · ` : ''}
                    {MODE_LABEL[s.mode_used ?? ''] ?? s.mode_used ?? '—'} · {ms(s.ms)}
                    {s.tokens ? ` · ${num(s.tokens)} tokens` : ''}
                    {s.error ? ` · error: ${s.error}` : ''}
                </span>
            </span>
        </button>
        {s.children.length > 0 && (
            <ol>
                {s.children.map((c) => (
                    <StepButton key={c.id} s={c} selected={selected} onPick={onPick} />
                ))}
            </ol>
        )}
    </li>
);

const StepDetail: React.FC<{ stepId: string }> = ({ stepId }) => {
    const { canManage } = useVitaAccess();
    const [step, setStep] = React.useState<VitaAgentStep | null>(null);
    const [err, setErr] = React.useState<string | null>(null);
    const [replay, setReplay] = React.useState<VitaReplayResult | null>(null);
    const [busy, setBusy] = React.useState<string | null>(null);

    React.useEffect(() => {
        let gone = false;
        setStep(null);
        setReplay(null);
        setErr(null);
        vitaApi
            .agentStep(stepId)
            .then((s) => !gone && setStep(s))
            .catch((e) => !gone && setErr(vitaApiError(e, 'Could not load the step.')));
        return () => {
            gone = true;
        };
    }, [stepId]);

    const doReplay = async (mode: 'replay' | 'rules' | 'llm') => {
        setBusy(mode);
        try {
            setReplay(await vitaApi.replayStep(stepId, mode));
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not replay the step.'));
        } finally {
            setBusy(null);
        }
    };

    if (err) return <ErrorBox message={err} />;
    if (!step) return <Empty>Loading the step…</Empty>;
    return (
        <div className="vita-stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`vita-who vita-who-${step.agent}`}>{step.agent}</span>
                <strong style={{ fontSize: 14, flex: '1 1 auto' }}>step {step.seq ?? ''}</strong>
                {(step.calls ?? []).some((c) => c.model) && <Pill tone="neutral">model: {(step.calls ?? []).find((c) => c.model)?.model}</Pill>}
            </div>
            {step.fallback_reason && <div className="vita-small vita-muted">Rules decided because: {step.fallback_reason}</div>}
            <div>
                <div className="vita-detail-label">What it decided</div>
                <pre className="vita-pre">{json(step.output)}</pre>
            </div>
            <div>
                <div className="vita-detail-label">What it was given (redacted)</div>
                <pre className="vita-pre">{json(step.input)}</pre>
            </div>
            {(step.calls ?? []).length > 0 && (
                <details>
                    <summary className="vita-small" style={{ cursor: 'pointer', fontWeight: 600 }}>
                        {step.calls!.length} model call{step.calls!.length === 1 ? '' : 's'}
                    </summary>
                    <pre className="vita-pre">{json(step.calls)}</pre>
                </details>
            )}
            {canManage && step.replayable && (
                <div>
                    <div className="vita-detail-label">Replay this step</div>
                    <div className="vita-ta-actions" style={{ marginTop: 6 }}>
                        <button className="vita-btn vita-btn-sm" onClick={() => doReplay('replay')} disabled={busy !== null} title="The recorded model answers through today's code">
                            {busy === 'replay' ? 'Replaying…' : 'Recorded answer'}
                        </button>
                        <button className="vita-btn vita-btn-sm" onClick={() => doReplay('rules')} disabled={busy !== null} title="What the rules alone decide">
                            {busy === 'rules' ? 'Replaying…' : 'Rules only'}
                        </button>
                        <button className="vita-btn vita-btn-sm" onClick={() => doReplay('llm')} disabled={busy !== null} title="The same input to today's model and prompt (spends tokens, logged with your name)">
                            {busy === 'llm' ? 'Replaying…' : "Today's model"}
                        </button>
                    </div>
                    {replay &&
                        (replay.same ? (
                            <div className="vita-small vita-good" style={{ marginTop: 6 }}>Same as in the run.</div>
                        ) : (
                            <div style={{ marginTop: 6 }}>
                                <div className="vita-small vita-bad">
                                    {replay.outcome.error ? `Error: ${replay.outcome.error}` : `${replay.diff.length} difference${replay.diff.length === 1 ? '' : 's'} from the run`}
                                </div>
                                {replay.diff.length > 0 && (
                                    <table className="vita-diff">
                                        <thead>
                                            <tr>
                                                <th>path</th>
                                                <th>in the run</th>
                                                <th>now</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {replay.diff.slice(0, 20).map((d) => (
                                                <tr key={d.path}>
                                                    <td>{d.path}</td>
                                                    <td>{json(d.before)}</td>
                                                    <td>{json(d.after)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};

const RunAgentSteps: React.FC<{ runId: string }> = ({ runId }) => {
    const [steps, setSteps] = React.useState<VitaAgentStep[] | null>(null);
    const [err, setErr] = React.useState<string | null>(null);
    const [selected, setSelected] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [agent, setAgent] = React.useState<string>('');
    const [opened, setOpened] = React.useState<Set<number>>(new Set());

    const load = React.useCallback(() => {
        setLoading(true);
        vitaApi
            .runSteps(runId)
            .then((r) => {
                setSteps(r.steps);
                setErr(null);
                setSelected((cur) => cur ?? r.steps.find((s) => s.error)?.id ?? r.steps.find((s) => s.agent === 'judge')?.id ?? r.steps[0]?.id ?? null);
            })
            .catch((e) => setErr(vitaApiError(e, 'Could not load what the agents did.')))
            .finally(() => setLoading(false));
    }, [runId]);
    React.useEffect(load, [load]);

    if (err) return <ErrorBox message={err} onRetry={load} />;
    if (!steps) return <Empty>Loading the agents' steps…</Empty>;
    if (steps.length === 0) return <Empty>No agent steps were recorded for this run (VITA_AGENT_TRACES off, or the run is older than the traces).</Empty>;
    const all = threadSteps(steps);
    const roots = agent ? all.filter((r) => r.agent === agent) : all;
    const asks = steps.filter((s) => s.parent_id).length;
    const perAgent = all.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.agent]: (acc[r.agent] ?? 0) + 1 }), {});
    // A run with many failures has long stretches of one agent (a step per failed case): show the first few of each
    // stretch and fold the rest behind a button, so the planner -> ... -> reporter story stays readable.
    const groups: { start: number; items: StepNode[] }[] = [];
    roots.forEach((r, i) => {
        const g = groups[groups.length - 1];
        if (g && g.items[0].agent === r.agent) g.items.push(r);
        else groups.push({ start: i, items: [r] });
    });
    return (
        <div>
            <div className="vita-ta-toolbar" style={{ marginBottom: 0 }}>
                <span className="vita-small vita-muted">
                    {steps.length} steps · {asks} help request{asks === 1 ? '' : 's'} between agents · {num(steps.reduce((a, s) => a + (s.tokens || 0), 0))} model tokens
                </span>
                <button className="vita-btn vita-btn-sm" onClick={load} disabled={loading} title="Refresh">
                    <RefreshCw size={12} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>
            <div className="vita-tl">
                <section className="vita-card" aria-label="Agent timeline" style={{ padding: 8 }}>
                    <div className="vita-tabs-inline" role="group" aria-label="Show steps of" style={{ margin: '2px 4px 8px' }}>
                        <button type="button" aria-pressed={agent === ''} onClick={() => setAgent('')}>
                            All agents
                        </button>
                        {Object.entries(perAgent).map(([a, n]) => (
                            <button key={a} type="button" aria-pressed={agent === a} onClick={() => setAgent(agent === a ? '' : a)}>
                                {a} · {n}
                            </button>
                        ))}
                    </div>
                    <ol>
                        {groups.flatMap((g) => {
                            const fold = g.items.length > FOLD_AFTER + 2 && !opened.has(g.start);
                            const shown = fold ? g.items.slice(0, FOLD_AFTER) : g.items;
                            const out = shown.map((s) => <StepButton key={s.id} s={s} selected={selected} onPick={setSelected} />);
                            if (fold)
                                out.push(
                                    <li key={`more-${g.start}`}>
                                        <button type="button" className="vita-link" style={{ padding: '6px 10px' }} onClick={() => setOpened((o) => new Set(o).add(g.start))}>
                                            Show {g.items.length - FOLD_AFTER} more {g.items[0].agent} steps
                                        </button>
                                    </li>
                                );
                            return out;
                        })}
                    </ol>
                </section>
                <aside className="vita-card vita-tl-side" aria-label="Selected step">
                    {selected ? <StepDetail stepId={selected} /> : <Empty>Pick a step.</Empty>}
                </aside>
            </div>
        </div>
    );
};

export default RunAgentSteps;
