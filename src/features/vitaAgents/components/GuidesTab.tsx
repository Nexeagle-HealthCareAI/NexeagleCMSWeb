import React from 'react';
import type { Range } from '../services/vitaService';
import { vitaError, vitaService } from '../services/vitaService';
import { ms, num, pct, useLoad, when } from './format';
import { Card, Empty, ErrorBox, Pill, Tile } from './shared';

/**
 * Guide Mode: how staff use the on-screen guides. Low completion or a step many people stop at
 * points to a guide that needs rewriting; "can't find on screen" means 1HMS changed and the
 * guide (or knowledge/ui_map.json) must be updated.
 */
const GuidesTab: React.FC<{ range: Range; hospitalId?: string }> = ({ range, hospitalId }) => {
    const { data, error, reload } = useLoad(() => vitaService.guides(range, hospitalId), [range, hospitalId]);
    if (error) return <ErrorBox message={vitaError(error)} onRetry={reload} />;
    if (!data) return <Empty>Loading…</Empty>;
    const t = data.totals;
    const rate = t.completionRate;
    return (
        <div className="vita-stack">
            <div className="vita-tiles">
                <Tile label="Guides shown" value={num(t.runs)} sub={`${num(t.started)} started`} />
                <Tile
                    label="Finished"
                    value={pct(rate)}
                    sub={`${num(t.completed)} of ${num(t.started)} started`}
                    tone={rate === null ? 'neutral' : rate >= 0.7 ? 'good' : rate >= 0.4 ? 'warn' : 'bad'}
                />
                <Tile label="Stopped part-way" value={num(t.abandoned)} tone={t.abandoned ? 'warn' : 'neutral'} />
                <Tile
                    label="Can't find on screen"
                    value={num(t.missingTargets)}
                    sub="steps whose button was not found"
                    tone={t.missingTargets ? 'bad' : 'good'}
                />
            </div>

            <Card title="Guides">
                {data.guides.length === 0 ? (
                    <Empty>No guides used in this period.</Empty>
                ) : (
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Guide</th>
                                    <th>Shown</th>
                                    <th>Started</th>
                                    <th>Finished</th>
                                    <th>Avg time</th>
                                    <th>👍 / 👎</th>
                                    <th>Most stop at</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.guides.map((g) => {
                                    const stops = Object.entries(g.stoppedAt).sort((a, b) => b[1] - a[1]);
                                    return (
                                        <tr key={g.guideId}>
                                            <td className="vita-wrap">
                                                <div>{g.title}</div>
                                                <div className="vita-muted vita-small">
                                                    {g.guideId} {g.source === 'generated' && <Pill tone="neutral">AI steps</Pill>}
                                                </div>
                                            </td>
                                            <td>{num(g.runs)}</td>
                                            <td>{num(g.started)}</td>
                                            <td>
                                                {num(g.completed)}{' '}
                                                <span className="vita-muted vita-small">{pct(g.completionRate)}</span>
                                            </td>
                                            <td>{ms(g.avgMs)}</td>
                                            <td className="vita-nowrap">
                                                {num(g.up)} / {num(g.down)}
                                            </td>
                                            <td className="vita-nowrap">
                                                {stops.length ? stops.slice(0, 2).map(([s, n]) => `${stepNo(s)} (${n})`).join(', ') : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Buttons Vita could not find on the screen">
                {data.missing.length === 0 ? (
                    <Empty>Every guide step found its button. 🎉</Empty>
                ) : (
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Guide</th>
                                    <th>Step</th>
                                    <th>Looking for</th>
                                    <th>Screen</th>
                                    <th>Times</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.missing.map((m) => (
                                    <tr key={`${m.guideId}-${m.step}`}>
                                        <td>{m.guideId}</td>
                                        <td className="vita-wrap">
                                            {stepNo(m.step)} <span className="vita-muted vita-small">{m.say}</span>
                                        </td>
                                        <td>
                                            <b>{m.label ?? '—'}</b>
                                        </td>
                                        <td>{m.screen ?? '—'}</td>
                                        <td className="vita-count vita-count-bad">{num(m.count)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="vita-muted vita-small">
                            Fix: check the label on that 1HMS screen, update knowledge/guides/&lt;guide&gt;.yaml, or re-run{' '}
                            <code className="vita-code">python -m knowledge.pipeline.ui_map</code> after a 1HMS release.
                        </p>
                    </div>
                )}
            </Card>

            <Card title="Guides written by Vita (no playbook yet)">
                {data.generated.length === 0 ? (
                    <Empty>None in this period. Every guide came from a checked playbook.</Empty>
                ) : (
                    <div className="vita-feedback-list">
                        {data.generated.map((g) => (
                            <article key={g.runId} className="vita-feedback">
                                <header>
                                    <b>{g.title}</b>
                                    <span className="vita-muted vita-small">
                                        {when(g.createdAt)} · {g.status} · {g.stepsDone}/{g.stepsTotal} steps
                                        {g.rating ? ` · ${g.rating === 'up' ? '👍' : '👎'}` : ''}
                                    </span>
                                </header>
                                <ol className="vita-small">
                                    {g.steps.map((s, i) => (
                                        <li key={i}>
                                            {s.say}
                                            {s.label && <span className="vita-chip">{s.label}</span>}
                                        </li>
                                    ))}
                                </ol>
                            </article>
                        ))}
                        <p className="vita-muted vita-small">
                            Popular ones are worth turning into a playbook (knowledge/guides) so they are checked and translated.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

const stepNo = (id: string) => (id.startsWith('s') ? `Step ${id.slice(1)}` : id);

export default GuidesTab;
