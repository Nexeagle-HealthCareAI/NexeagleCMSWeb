import React from 'react';
import { Cpu, Database, Layers, Server, Sparkles, Users } from 'lucide-react';
import type { Health } from '../services/vitaService';
import { VITA_API_URL } from '../services/vitaService';
import { dur, ms, num, pct, when } from './format';
import { Card, Empty, Pill } from './shared';

const Check: React.FC<{ icon: React.ReactNode; name: string; ok: boolean; detail: string }> = ({ icon, name, ok, detail }) => (
    <div className={`vita-check ${ok ? 'ok' : 'bad'}`}>
        <div className="vita-check-icon">{icon}</div>
        <div>
            <div className="vita-check-name">{name}</div>
            <div className="vita-check-detail">{detail}</div>
        </div>
        <Pill tone={ok ? 'good' : 'bad'}>{ok ? 'OK' : 'Down'}</Pill>
    </div>
);

const HealthTab: React.FC<{ h: Health }> = ({ h }) => {
    const capacity = h.workers.reduce((s, w) => s + w.concurrency, 0);
    const busy = h.workers.reduce((s, w) => s + w.inflight, 0);
    const stale = h.workers.filter((w) => w.lastSeenS > 20);
    const ev = h.knowledge?.eval ?? {};
    return (
        <div className="vita-stack">
            <div className="vita-checks">
                <Check
                    icon={<Server size={18} />}
                    name="Redis (queue, sessions)"
                    ok={h.checks.redis.ok}
                    detail={h.checks.redis.ok ? `${h.checks.redis.latencyMs} ms` : h.checks.redis.error ?? 'unreachable'}
                />
                <Check
                    icon={<Database size={18} />}
                    name="Postgres (history, knowledge)"
                    ok={h.checks.postgres.ok}
                    detail={h.checks.postgres.ok ? `${h.checks.postgres.latencyMs} ms` : h.checks.postgres.error ?? 'unreachable'}
                />
                <Check
                    icon={<Cpu size={18} />}
                    name="Workers"
                    ok={h.workers.length > 0 && stale.length === 0}
                    detail={`${h.workers.length} running · ${busy}/${capacity} slots busy`}
                />
                <Check
                    icon={<Layers size={18} />}
                    name="Knowledge base"
                    ok={!!h.knowledge}
                    detail={h.knowledge ? `${h.knowledge.chunks} passages · hit@5 ${pct(ev['hit@5'] as number)}` : 'no active build'}
                />
                <Check
                    icon={<Sparkles size={18} />}
                    name="LLM"
                    ok
                    detail={h.llm.configured ? h.llm.model ?? '' : 'not configured: answers from guide passages'}
                />
                <Check icon={<Users size={18} />} name="Active sessions" ok detail={`${num(h.activeSessions)} users with Vita open`} />
            </div>

            <div className="vita-grid-2">
                <Card title="Queue">
                    <ul className="vita-list">
                        <li>
                            <span className="vita-list-main">Waiting for a worker</span>
                            <span className="vita-count">{num(h.queue.waiting)}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Being answered now</span>
                            <span className="vita-count">{num(h.queue.inProgress)}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Oldest waiting question</span>
                            <span className="vita-count">{h.queue.oldestQueuedS != null ? dur(h.queue.oldestQueuedS) : '—'}</span>
                        </li>
                    </ul>
                </Card>
                <Card title="Environment">
                    <ul className="vita-list">
                        <li>
                            <span className="vita-list-main">Vita API</span>
                            <span className="vita-code">{VITA_API_URL}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Environment</span>
                            <span className="vita-code">{h.env}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">1HMS login mode</span>
                            <Pill tone={h.hmsMode === 'live' ? 'good' : 'warn'}>{h.hmsMode}</Pill>
                        </li>
                        <li>
                            <span className="vita-list-main">Embedder</span>
                            <span className="vita-code">{h.embedder}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Checked</span>
                            <span>{when(h.checkedAt)}</span>
                        </li>
                    </ul>
                </Card>
            </div>

            <Card title="Workers">
                {h.workers.length === 0 ? (
                    <Empty>No worker has reported in the last 30 seconds. Questions will wait in the queue.</Empty>
                ) : (
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th>Status</th>
                                    <th className="num">Up for</th>
                                    <th className="num">Busy</th>
                                    <th className="num">Turns done</th>
                                    <th className="num">Failed</th>
                                    <th>LLM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {h.workers.map((w) => (
                                    <tr key={w.id}>
                                        <td className="vita-code">{w.id}</td>
                                        <td>
                                            <Pill tone={w.lastSeenS > 20 ? 'bad' : 'good'}>
                                                {w.lastSeenS > 20 ? `silent ${dur(w.lastSeenS)}` : 'alive'}
                                            </Pill>
                                        </td>
                                        <td className="num">{dur(w.uptimeS)}</td>
                                        <td className="num">
                                            {w.inflight}/{w.concurrency}
                                        </td>
                                        <td className="num">{num(w.processed)}</td>
                                        <td className="num">{num(w.failed)}</td>
                                        <td className="vita-code">{w.llmModel || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="vita-muted vita-small">Counts reset when a worker restarts. Uptime far below the deploy age means it is crashing (memory?).</p>
            </Card>

            {h.knowledge && (
                <Card title="Active knowledge build">
                    <ul className="vita-list">
                        <li>
                            <span className="vita-list-main">Source version</span>
                            <span className="vita-code">{h.knowledge.sourceVersion}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Activated</span>
                            <span>{when(h.knowledge.activatedAt)}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Right passage first (hit@1)</span>
                            <span className="vita-count">{pct(ev['hit@1'] as number)}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Right passage in top 5 (hit@5)</span>
                            <span className="vita-count">{pct(ev['hit@5'] as number)}</span>
                        </li>
                        <li>
                            <span className="vita-list-main">Reply-time target</span>
                            <span>p95 under {ms(8000)}</span>
                        </li>
                    </ul>
                </Card>
            )}
        </div>
    );
};

export default HealthTab;
