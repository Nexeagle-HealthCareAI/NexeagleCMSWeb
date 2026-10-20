import React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import type { Overview } from '../services/vitaService';
import { ERROR_HINTS, ms, num, pct, ROUTES, routeLabel, toneFor, when } from './format';
import { Card, Empty, Tile } from './shared';

// Categorical slots (fixed order) + reserved status red for failures.
const C = { answered: '#2a78d6', jev: '#1baf7a', unanswered: '#eb6834', failed: '#e34948', line: '#2a78d6' };

interface Insight {
    tone: 'bad' | 'warn' | 'good';
    text: string;
    action?: { label: string; tab: string };
}

/** Turns the numbers into a short "what to do next" list. */
function insights(o: Overview): Insight[] {
    const k = o.kpis;
    const h = o.health;
    const out: Insight[] = [];
    if (h.workers.length === 0) out.push({ tone: 'bad', text: 'No worker is running: questions queue up and are never answered.' });
    if ((h.queue.waiting ?? 0) > 5) out.push({ tone: 'warn', text: `${h.queue.waiting} questions waiting in the queue. Add workers (VITA_WORKERS).` });
    if (!h.knowledge) out.push({ tone: 'bad', text: 'No active knowledge build. Vita cannot answer how-to questions.' });
    if (k.turns === 0) {
        out.push({ tone: 'good', text: 'No questions in this period yet.' });
        return out;
    }
    if ((k.unansweredRate ?? 0) > 0.15)
        out.push({
            tone: 'warn',
            text: `${pct(k.unansweredRate)} of questions got no answer (${k.unanswered}). Each open gap is a missing FAQ or PRD section.`,
            action: { label: 'Review gaps', tab: 'gaps' },
        });
    if ((k.errorRate ?? 0) > 0.02) {
        const top = o.errors[0];
        out.push({
            tone: 'bad',
            text: `${pct(k.errorRate, 1)} of turns failed${top ? `, mostly "${top.code}"` : ''}. ${top ? ERROR_HINTS[top.code] ?? '' : ''}`,
            action: { label: 'See failed turns', tab: 'turns' },
        });
    }
    if ((k.latencyP95Ms ?? 0) > 8000)
        out.push({ tone: 'warn', text: `Slowest 5% of answers take ${ms(k.latencyP95Ms)}. Users expect under 8 s; check LLM speed or use the cache.` });
    if ((k.queueWaitP95Ms ?? 0) > 2000)
        out.push({ tone: 'warn', text: `Questions wait ${ms(k.queueWaitP95Ms)} before a worker picks them up. Add workers.` });
    if ((k.llmFallbackRate ?? 0) > 0.1)
        out.push({ tone: 'warn', text: `${pct(k.llmFallbackRate)} of AI answers fell back to a raw passage (LLM error or ungrounded answer).` });
    if (k.thumbsDown > 0 && (k.satisfaction ?? 1) < 0.8)
        out.push({
            tone: 'warn',
            text: `Only ${pct(k.satisfaction)} of rated answers were helpful (${k.thumbsDown} thumbs down).`,
            action: { label: 'Read feedback', tab: 'feedback' },
        });
    const badDoc = o.docs.find((d) => d.down >= 2 && d.down > d.up);
    if (badDoc)
        out.push({
            tone: 'warn',
            text: `${badDoc.docId} §${badDoc.section} (${badDoc.title}) gets more thumbs down than up. Rewrite that section.`,
        });
    if ((k.slowReports ?? 0) >= 3)
        out.push({
            tone: 'warn',
            text: `Staff said 1HMS is slow ${k.slowReports} times in this period. Check the screens in the audit log (vita.slow).`,
        });
    if ((k.repairRate ?? 0) > 0.1)
        out.push({
            tone: 'warn',
            text: `${pct(k.repairRate ?? null)} of answers were rejected ("Not this"). Add phrasings to the cards people meant.`,
        });
    if ((k.feedbackRate ?? 0) < 0.05 && k.answered > 20)
        out.push({ tone: 'warn', text: `Under 5% of answers are rated. Encourage thumbs up/down in 1HMS to learn faster.` });
    if (out.length === 0) out.push({ tone: 'good', text: 'All signals are healthy for this period.' });
    return out;
}

const fmtBucket = (iso: string, bucket: Overview['bucket']) => {
    const d = new Date(iso);
    if (bucket === 'day') return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const OverviewTab: React.FC<{ o: Overview; goTo: (tab: string) => void }> = ({ o, goTo }) => {
    const k = o.kpis;
    const series = o.series.map((s) => ({ ...s, label: fmtBucket(s.at, o.bucket) }));
    const maxRoute = Math.max(1, ...o.routes.map((r) => r.count));

    return (
        <div className="vita-stack">
            <Card title="What to improve next" className="vita-insights">
                <ul className="vita-insight-list">
                    {insights(o).map((i, n) => (
                        <li key={n} className={`vita-insight vita-insight-${i.tone}`}>
                            {i.tone === 'good' ? <CheckCircle2 size={16} /> : i.tone === 'bad' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
                            <span>{i.text}</span>
                            {i.action && (
                                <button className="vita-link" onClick={() => goTo(i.action!.tab)}>
                                    {i.action.label} →
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </Card>

            <div className="vita-tiles">
                <Tile label="Questions" value={num(k.turns)} sub={`${num(k.users)} users · ${num(k.hospitals)} hospitals`} />
                <Tile
                    label="Answered"
                    value={pct(k.answeredRate)}
                    sub={`${num(k.answered)} from the guides`}
                    tone={toneFor(k.answeredRate, 0.7, 0.5, true)}
                />
                <Tile
                    label="Not answered"
                    value={pct(k.unansweredRate)}
                    sub={`${num(k.unanswered)} → knowledge gaps`}
                    tone={toneFor(k.unansweredRate, 0.1, 0.2)}
                />
                <Tile label="Jev fast path" value={pct(k.jevRate)} sub="greetings, navigation, declines" />
                <Tile
                    label="Helpful (👍)"
                    value={pct(k.satisfaction)}
                    sub={`${num(k.thumbsUp)} up · ${num(k.thumbsDown)} down`}
                    tone={toneFor(k.satisfaction, 0.85, 0.7, true)}
                />
                <Tile
                    label="Reply time p95"
                    value={ms(k.latencyP95Ms)}
                    sub={`median ${ms(k.latencyP50Ms)}`}
                    tone={toneFor(k.latencyP95Ms, 5000, 8000)}
                />
                <Tile
                    label="Failed"
                    value={pct(k.errorRate, 1)}
                    sub={`${num(k.failed)} turns · ${num(k.retried)} retried`}
                    tone={toneFor(k.errorRate, 0.01, 0.03)}
                />
                <Tile label="Cache hits" value={pct(k.cacheHitRate)} sub="of answered questions" />
                <Tile
                    label="Queue wait p95"
                    value={ms(k.queueWaitP95Ms)}
                    sub="before a worker starts"
                    tone={toneFor(k.queueWaitP95Ms, 1000, 3000)}
                />
                <Tile
                    label="Vita asked"
                    value={pct(k.askedRate ?? null)}
                    sub={`${num(k.asked ?? 0)} times: which task was meant`}
                    tone={toneFor(k.askedRate ?? null, 0.12, 0.2)}
                />
                <Tile
                    label={'"Not this"'}
                    value={pct(k.repairRate ?? null)}
                    sub={`${num(k.repaired ?? 0)} answers rejected`}
                    tone={toneFor(k.repairRate ?? null, 0.05, 0.1)}
                />
                <Tile
                    label="Slow reports"
                    value={num(k.slowReports ?? 0)}
                    sub="staff said 1HMS is slow"
                    tone={(k.slowReports ?? 0) > 0 ? 'warn' : 'good'}
                />
                <Tile label="Open gaps" value={num(k.openGaps)} sub={`${num(k.openGapsInRange)} asked in this period`} tone={k.openGaps > 0 ? 'warn' : 'good'} />
                <Tile label="LLM tokens" value={num(k.tokensIn + k.tokensOut)} sub={`${num(k.tokensIn)} in · ${num(k.tokensOut)} out`} />
                <Tile label="Conversations" value={num(k.conversations)} sub={`${num(k.inProgress)} in progress now`} />
            </div>

            <div className="vita-grid-2">
                <Card title="Questions by outcome">
                    {series.length === 0 ? (
                        <Empty>No questions in this period.</Empty>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} maxBarSize={48}>
                                <CartesianGrid vertical={false} stroke="#eef2f6" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={16} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="answered" name="Answered" stackId="a" fill={C.answered} stroke="#fff" strokeWidth={1} />
                                <Bar dataKey="jev" name="Jev" stackId="a" fill={C.jev} stroke="#fff" strokeWidth={1} />
                                <Bar dataKey="unanswered" name="Not answered" stackId="a" fill={C.unanswered} stroke="#fff" strokeWidth={1} />
                                <Bar dataKey="failed" name="Failed" stackId="a" fill={C.failed} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card title="Reply time, slowest 5% (p95)">
                    {series.length === 0 ? (
                        <Empty>No answers in this period.</Empty>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={series} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="#eef2f6" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={16} />
                                <YAxis tickFormatter={(v: number) => ms(v)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={56} />
                                <Tooltip
                                    formatter={(v) => [ms(Number(v)), 'p95']}
                                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Line type="monotone" dataKey="p95Ms" name="p95" stroke={C.line} strokeWidth={2} dot={series.length <= 3 ? { r: 4 } : false} activeDot={{ r: 4 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            <div className="vita-grid-2">
                <Card title="How questions were handled">
                    {o.routes.length === 0 ? (
                        <Empty>Nothing yet.</Empty>
                    ) : (
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Route</th>
                                    <th className="num">Count</th>
                                    <th className="num">Median</th>
                                    <th className="num">p95</th>
                                    <th className="num">👍 / 👎</th>
                                </tr>
                            </thead>
                            <tbody>
                                {o.routes.map((r) => (
                                    <tr key={r.route} title={ROUTES[r.route]?.hint}>
                                        <td>
                                            <div className="vita-bar-cell">
                                                <span className={`vita-dot vita-dot-${ROUTES[r.route]?.group ?? 'other'}`} />
                                                {routeLabel(r.route)}
                                                <span className="vita-muted vita-code">{r.route}</span>
                                            </div>
                                            <div className="vita-bar-track">
                                                <div className="vita-bar-fill" style={{ width: `${(r.count / maxRoute) * 100}%` }} />
                                            </div>
                                        </td>
                                        <td className="num">{num(r.count)}</td>
                                        <td className="num">{ms(r.p50Ms)}</td>
                                        <td className="num">{ms(r.p95Ms)}</td>
                                        <td className="num">
                                            {r.up} / {r.down}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
                <Card title="Top unanswered questions" right={<button className="vita-link" onClick={() => goTo('gaps')}>All gaps →</button>}>
                    {o.topGaps.length === 0 ? (
                        <Empty>No open gaps. 🎉</Empty>
                    ) : (
                        <ul className="vita-list">
                            {o.topGaps.map((g) => (
                                <li key={g.id}>
                                    <span className="vita-list-main">{g.question}</span>
                                    <span className="vita-muted">{g.reason}</span>
                                    <span className="vita-count">×{g.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <div className="vita-grid-3">
                <Card title="Guide sections used most">
                    {o.docs.length === 0 ? (
                        <Empty>No citations yet.</Empty>
                    ) : (
                        <ul className="vita-list">
                            {o.docs.slice(0, 12).map((d) => (
                                <li key={`${d.docId}-${d.section}`} title={d.title}>
                                    <span className="vita-list-main">
                                        <b>{d.docId}</b> §{d.section} <span className="vita-muted">{d.title}</span>
                                    </span>
                                    {d.down > 0 && <span className="vita-down">👎 {d.down}</span>}
                                    <span className="vita-count">{d.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Errors">
                    {o.errors.length === 0 ? (
                        <Empty>No failed turns.</Empty>
                    ) : (
                        <ul className="vita-list">
                            {o.errors.map((e) => (
                                <li key={e.code} title={ERROR_HINTS[e.code]}>
                                    <span className="vita-list-main">
                                        <span className="vita-code">{e.code}</span>
                                        <div className="vita-muted vita-small">{ERROR_HINTS[e.code] ?? ''} Last: {when(e.lastAt)}</div>
                                    </span>
                                    <span className="vita-count vita-count-bad">{e.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Language and mode">
                    <ul className="vita-list">
                        {o.languages.map((l) => (
                            <li key={l.lang}>
                                <span className="vita-list-main">{l.lang === 'hi' ? 'Hindi / Hinglish' : l.lang === 'en' ? 'English' : l.lang}</span>
                                <span className="vita-count">{pct(l.count / Math.max(1, k.turns))}</span>
                            </li>
                        ))}
                        {o.modes.map((m) => (
                            <li key={`m-${m.mode}`}>
                                <span className="vita-list-main">Mode: {m.mode}</span>
                                <span className="vita-count">{num(m.count)}</span>
                            </li>
                        ))}
                        {o.languages.length === 0 && <Empty>No data.</Empty>}
                    </ul>
                </Card>
            </div>

            <Card title="By hospital">
                {o.hospitals.length === 0 ? (
                    <Empty>No usage yet.</Empty>
                ) : (
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Hospital</th>
                                    <th className="num">Questions</th>
                                    <th className="num">Users</th>
                                    <th className="num">Answered</th>
                                    <th className="num">Not answered</th>
                                    <th className="num">Failed</th>
                                    <th>Last question</th>
                                </tr>
                            </thead>
                            <tbody>
                                {o.hospitals.map((h) => (
                                    <tr key={h.hospitalId}>
                                        <td className="vita-code" title={h.hospitalId}>
                                            {h.hospitalId}
                                        </td>
                                        <td className="num">{num(h.turns)}</td>
                                        <td className="num">{num(h.users)}</td>
                                        <td className="num">{pct(h.answeredRate)}</td>
                                        <td className="num">{pct(h.unansweredRate)}</td>
                                        <td className="num">{num(h.failed)}</td>
                                        <td>{when(h.lastAt)}</td>
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

export default OverviewTab;
