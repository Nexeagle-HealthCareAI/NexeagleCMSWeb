import React from 'react';
import { vitaError, vitaService } from '../services/vitaService';
import { num, pct, useLoad, when } from './format';
import { Card, Empty, ErrorBox, Pill } from './shared';

const KnowledgeTab: React.FC = () => {
    const { data, error, reload } = useLoad(() => vitaService.kbBuilds(), []);
    if (error) return <ErrorBox message={vitaError(error)} onRetry={reload} />;
    if (!data) return <Empty>Loading…</Empty>;
    return (
        <div className="vita-stack">
            <div className="vita-explainer">
                Every deploy rebuilds the knowledge base from the PRD sources and tests it against the golden question set. A new
                build goes live only if <b>hit@5 ≥ 80%</b>, it is not worse than the live one, and no restricted passage leaks
                to a user without the permission. Otherwise the previous build keeps serving.
            </div>
            <Card title="Builds">
                {data.builds.length === 0 ? (
                    <Empty>No builds yet.</Empty>
                ) : (
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Built</th>
                                    <th>Status</th>
                                    <th>Source</th>
                                    <th className="num">Passages</th>
                                    <th className="num" title="Right passage ranked first">hit@1</th>
                                    <th className="num" title="Right passage in the top 5">hit@5</th>
                                    <th className="num" title="Hinglish questions, top 5">Hinglish</th>
                                    <th className="num" title="Nonsense questions correctly refused">Rejects junk</th>
                                    <th className="num" title="Real questions wrongly refused">Wrong refusals</th>
                                    <th className="num" title="Restricted passages shown to users without permission">Leaks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.builds.map((b) => {
                                    const e = b.eval as Record<string, number>;
                                    return (
                                        <tr key={b.id}>
                                            <td className="vita-nowrap">{when(b.createdAt)}</td>
                                            <td>
                                                <Pill tone={b.status === 'active' ? 'good' : b.status === 'failed' ? 'bad' : 'neutral'}>{b.status}</Pill>
                                            </td>
                                            <td className="vita-code">
                                                {b.sourceVersion.slice(0, 12)} · {b.embedder}
                                            </td>
                                            <td className="num">{num(b.chunks)}</td>
                                            <td className="num">{pct(e['hit@1'])}</td>
                                            <td className="num">{pct(e['hit@5'])}</td>
                                            <td className="num">{pct(e['hit@5_hinglish'])}</td>
                                            <td className="num">{pct(e['irrelevant_rejected'])}</td>
                                            <td className="num">{pct(e['answerable_refused'])}</td>
                                            <td className={`num ${e['denied_leaks'] ? 'vita-bad' : ''}`}>{e['denied_leaks'] ?? '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            <Card title="Documents in the live build">
                <ul className="vita-list">
                    {data.activeDocs.map((d) => (
                        <li key={d.docId}>
                            <span className="vita-list-main">
                                <b>{d.docId}</b>
                            </span>
                            <span className="vita-muted">{d.sections} sections</span>
                            <span className="vita-count">{d.chunks} passages</span>
                        </li>
                    ))}
                    {data.activeDocs.length === 0 && <Empty>No active build.</Empty>}
                </ul>
            </Card>
        </div>
    );
};

export default KnowledgeTab;
