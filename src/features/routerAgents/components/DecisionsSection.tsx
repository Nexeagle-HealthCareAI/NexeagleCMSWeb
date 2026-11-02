import React from 'react';
import { routerAgentsService, errorText, type AgentKind } from '../services/routerAgentsService';
import { ms, num, pct, useLoad, when } from '../../vitaAgents/components/format';
import { Card, Empty, ErrorBox, Pill } from '../../vitaAgents/components/shared';
import { AGENT_NAMES, DECISIONS, callerName, specialtyName } from './labels';

const PAGE = 25;

export const DecisionsSection: React.FC<{ from: string; to: string; agent?: AgentKind; caller?: string }> = ({ from, to, agent, caller }) => {
    const [decision, setDecision] = React.useState('');
    const [page, setPage] = React.useState(1);
    const key = `${from}|${to}|${agent ?? ''}|${caller ?? ''}|${decision}`;
    const [lastKey, setLastKey] = React.useState(key);
    if (lastKey !== key) {        // filters changed: back to page 1 (adjust state while rendering)
        setLastKey(key);
        setPage(1);
    }
    const res = useLoad(
        () => routerAgentsService.decisions({ page, limit: PAGE, from, to, agent, caller, decision: decision || undefined }),
        [page, from, to, agent, caller, decision],
    );
    const data = res.data;

    return (
        <Card title="Every decision" right={
            <select className="vita-input" value={decision} onChange={e => setDecision(e.target.value)} aria-label="Decision">
                <option value="">All decisions</option>
                {Object.entries(DECISIONS).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
            </select>
        }>
            <p className="vita-muted vita-small">
                The patient's words are shown only for doubtful answers (kept for review); confident answers store only a fingerprint of the text.
            </p>
            {res.error && !data ? <ErrorBox message={errorText(res.error, 'Could not load decisions.')} onRetry={res.reload} />
                : !data ? <Empty>Loading…</Empty>
                : data.data.length === 0 ? <Empty>No decisions match.</Empty>
                : (
                    <div className={`vita-scroll ${res.loading ? 'vita-loading' : ''}`}>
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Agent / caller</th>
                                    <th>Decision</th>
                                    <th>Specialty</th>
                                    <th className="num">Confidence</th>
                                    <th className="num">Time</th>
                                    <th>Text (doubtful only)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.data.map(d => {
                                    const dec = DECISIONS[d.decision];
                                    return (
                                        <tr key={d.decisionId}>
                                            <td className="vita-nowrap">{when(d.occurredAt)}</td>
                                            <td className="vita-nowrap">
                                                {AGENT_NAMES[d.agent] ?? d.agent}
                                                <div className="vita-muted vita-small">{callerName(d.caller)}</div>
                                            </td>
                                            <td>
                                                <span className="vita-dot" style={{ background: dec?.color ?? '#94a3b8' }} />
                                                {dec?.label ?? d.decision}
                                                {d.isEmergency && d.decision !== 'emergency' && <> <Pill tone="bad">Emergency</Pill></>}
                                                {d.usedReasoner && <div className="vita-muted vita-small">LLM consulted</div>}
                                            </td>
                                            <td>
                                                {d.topSpecialtyId ? specialtyName(d.topSpecialtyId) : d.topSpecialist ?? '—'}
                                                {d.candidateIds && d.candidateIds.includes(',') && (
                                                    <div className="vita-muted vita-small" title={d.candidateIds}>
                                                        also: {d.candidateIds.split(',').slice(1, 4).map(specialtyName).join(', ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="num">{pct(d.confidence)}</td>
                                            <td className="num">{ms(d.latencyMs)}</td>
                                            <td className="vita-ellipsis" title={d.reviewText ?? ''}>{d.reviewText ? `“${d.reviewText}”` : <span className="vita-muted">—</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            {data && data.pagination.totalPages > 1 && (
                <div className="vita-pager">
                    <span className="vita-muted vita-small">{num(data.pagination.totalItems)} decisions</span>
                    <span>
                        <button className="vita-btn vita-btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span className="vita-small">Page {page} of {data.pagination.totalPages}</span>{' '}
                        <button className="vita-btn vita-btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </span>
                </div>
            )}
        </Card>
    );
};

export default DecisionsSection;
