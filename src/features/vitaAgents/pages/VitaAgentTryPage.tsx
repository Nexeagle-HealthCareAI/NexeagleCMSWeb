import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaAgentOutcome } from '../types';
import { ms, num, useLoad } from '../components/format';
import { Card, Empty, ErrorBox, Pill } from '../components/shared';
import { useVitaAccess } from '../components/testAgent';

/** The playground: run one agent on its own with an example's input (or your edit of it), by its rules or the model, and
 *  see what it decided, what it sent to the model, and whether the example's expectations still hold. Nothing is saved
 *  or sent: agents that read history get a throwaway store and the Reporter's GitHub calls are simulated. */

const MODE_LABEL: Record<string, string> = { llm: 'the model', rules: 'its rules', fallback: 'its rules (the model failed)', replay: 'a recorded answer' };

const json = (v: unknown) => {
    try {
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v);
    }
};

const VitaAgentTryPage: React.FC = () => {
    const { name = '' } = useParams();
    const navigate = useNavigate();
    const { canManage } = useVitaAccess();
    const { data: list } = useLoad(() => vitaApi.agents(), []);
    const { data: card, error } = useLoad(() => vitaApi.agent(name), [name]);
    const [example, setExample] = React.useState('');
    const [text, setText] = React.useState('');
    const [loadedText, setLoadedText] = React.useState('');
    const [mode, setMode] = React.useState<'rules' | 'llm'>('rules');
    const [busy, setBusy] = React.useState(false);
    const [out, setOut] = React.useState<VitaAgentOutcome | null>(null);

    React.useEffect(() => {
        setOut(null);
        if (card && card.examples.length > 0) setExample(card.examples[0].name);
        else setExample('');
    }, [card]);

    React.useEffect(() => {
        if (!example) return;
        let gone = false;
        vitaApi
            .agentExample(name, example)
            .then((ex) => {
                if (gone) return;
                const t = json(ex.input);
                setText(t);
                setLoadedText(t);
                setOut(null);
            })
            .catch((e) => toast.error(vitaApiError(e, 'Could not load the example.')));
        return () => {
            gone = true;
        };
    }, [name, example]);

    let parsed: Record<string, unknown> | null = null;
    let parseError: string | null = null;
    try {
        parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch (e) {
        parseError = (e as Error).message;
    }

    const run = async () => {
        if (!parsed) return;
        setBusy(true);
        try {
            const edited = text !== loadedText;
            setOut(
                await vitaApi.tryAgent(name, edited ? { input: parsed, check: example || undefined, mode } : { example, mode })
            );
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not run the agent.'));
        } finally {
            setBusy(false);
        }
    };

    if (error && !card) return <ErrorBox message={vitaApiError(error, `Could not load the agent "${name}".`)} />;
    if (!card) return <Empty>Loading…</Empty>;
    const tryable = [...(list?.agents ?? []), ...(list?.flows ?? [])].filter((a) => a.playground_api);
    const failed = out?.checks?.filter((c) => !c.ok) ?? [];
    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to="/vita/agents" className="vita-link">
                        ← Agents
                    </Link>
                    <strong style={{ fontSize: 16 }}>Try the {card.title} on its own</strong>
                </div>
                <Pill tone="neutral">nothing is saved or sent</Pill>
            </div>
            <p className="vita-muted" style={{ margin: 0, fontSize: 13 }}>
                {card.role} <span className="vita-small">Without the model: {card.fallback}</span>
            </p>

            <div className="vita-try">
                <Card title="Input">
                    <div className="vita-stack" style={{ gap: 10 }}>
                        <div className="vita-filters">
                            <label className="vita-small" style={{ display: 'grid', gap: 4 }}>
                                <span>Agent</span>
                                <select className="vita-input" value={name} onChange={(e) => navigate(`/vita/agents/${encodeURIComponent(e.target.value)}`)}>
                                    {tryable.map((a) => (
                                        <option key={a.name} value={a.name}>
                                            {a.title}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="vita-small" style={{ display: 'grid', gap: 4 }}>
                                <span>Start from an example</span>
                                <select className="vita-input" value={example} onChange={(e) => setExample(e.target.value)}>
                                    {card.examples.map((x) => (
                                        <option key={x.name} value={x.name} title={x.about}>
                                            {x.title}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <label className="vita-small" style={{ display: 'grid', gap: 4 }}>
                            <span>Input (JSON — edit anything)</span>
                            <textarea
                                className={`vita-json ${parseError ? 'vita-json-invalid' : ''}`}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                spellCheck={false}
                                aria-invalid={parseError ? true : undefined}
                            />
                        </label>
                        {parseError && <div className="vita-small vita-bad">Not valid JSON: {parseError}</div>}
                        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <legend className="vita-small" style={{ fontWeight: 600, paddingBottom: 6 }}>
                                Who decides
                            </legend>
                            <div className="vita-seg">
                                <label>
                                    <input type="radio" name="mode" checked={mode === 'rules'} onChange={() => setMode('rules')} /> Rules only
                                </label>
                                <label>
                                    <input type="radio" name="mode" checked={mode === 'llm'} onChange={() => setMode('llm')} disabled={!card.uses_llm} /> Model
                                </label>
                            </div>
                            {mode === 'llm' && <span className="vita-small vita-muted">Spends model tokens (capped) and is logged with your name.</span>}
                        </fieldset>
                        <div className="vita-ta-actions">
                            <button className="vita-btn vita-btn-primary" onClick={run} disabled={!canManage || busy || !parsed} title={canManage ? '' : 'Needs vita.manage'}>
                                <Play size={14} /> {busy ? 'Running…' : `Run the ${card.title}`}
                            </button>
                            <button className="vita-btn" onClick={() => setText(loadedText)} disabled={text === loadedText}>
                                Reset to the example
                            </button>
                        </div>
                    </div>
                </Card>

                <Card
                    title="Result"
                    right={
                        out && (
                            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <Pill tone={out.mode_used === 'fallback' ? 'warn' : 'neutral'}>decided by {MODE_LABEL[out.mode_used] ?? out.mode_used}</Pill>
                                <Pill tone="neutral">
                                    {ms(out.ms)} · {num(out.tokens)} tokens
                                </Pill>
                            </span>
                        )
                    }
                >
                    {!out ? (
                        <Empty>Run the agent to see what it decides.</Empty>
                    ) : (
                        <div className="vita-stack" style={{ gap: 10 }}>
                            {out.error && <ErrorBox message={`The agent failed: ${out.error}`} />}
                            {out.fallback_reason && <div className="vita-small vita-muted">The model was not used: {out.fallback_reason}</div>}
                            {out.checks && (
                                <div className={`vita-alert ${failed.length === 0 ? 'vita-alert-good' : ''}`}>
                                    <div>
                                        <strong>
                                            {failed.length === 0
                                                ? `All ${out.checks.length} expectations of “${out.checked_against}” hold.`
                                                : `${failed.length} of ${out.checks.length} expectations of “${out.checked_against}” do not hold.`}
                                        </strong>
                                        <ul className="vita-checks-list">
                                            {out.checks.map((c) => (
                                                <li key={c.path}>
                                                    {c.ok ? <Check size={16} color="#047857" aria-label="holds" /> : <X size={16} color="#b91c1c" aria-label="does not hold" />}
                                                    <span>
                                                        <code>{c.path}</code> {Object.entries(c.expect).map(([k, v]) => `${k.replace('_', ' ')} ${JSON.stringify(v)}`).join(', ')}
                                                        {c.why && <span className="vita-small vita-bad"> — {c.why}</span>}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className="vita-detail-label">Output</div>
                                <pre className="vita-pre">{json(out.output)}</pre>
                            </div>
                            <details>
                                <summary className="vita-small" style={{ cursor: 'pointer', fontWeight: 600 }}>
                                    What was sent to the model ({out.calls.length} call{out.calls.length === 1 ? '' : 's'})
                                </summary>
                                {out.calls.length === 0 ? <div className="vita-small vita-muted">Nothing: the rules decided.</div> : <pre className="vita-pre">{json(out.calls)}</pre>}
                            </details>
                            {out.notes.length > 0 && <div className="vita-small vita-muted">{out.notes.join(' · ')}</div>}
                        </div>
                    )}
                </Card>
            </div>

            <Card title="What this agent may and may not do">
                <div className="vita-grid-2" style={{ gap: 12 }}>
                    <div className="vita-small">
                        <div className="vita-detail-label">Guardrails</div>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            {card.guardrails.map((g) => (
                                <li key={g}>{g}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="vita-small">
                        <div className="vita-detail-label">Side effects in a real run</div>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            {card.side_effects.length ? card.side_effects.map((g) => <li key={g}>{g}</li>) : <li>none</li>}
                        </ul>
                        <div className="vita-muted" style={{ marginTop: 6 }}>
                            Code: <code>{card.source}</code>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default VitaAgentTryPage;
