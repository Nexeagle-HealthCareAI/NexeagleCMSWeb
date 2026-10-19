import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import type { AgentOverview, AgentServiceStatus, LearningSummary, ModelVersion } from '../services/routerAgentsService';
import { ms, num, pct, toneFor } from '../../vitaAgents/components/format';
import { Card, Empty, Tile } from '../../vitaAgents/components/shared';
import { DECISIONS, callerName, specialtyName } from './labels';

interface Insight { tone: 'good' | 'warn' | 'bad'; text: string; action?: { label: string; tab: string } }

const share = (n: number, total: number) => (total > 0 ? n / total : null);
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** The numbers, turned into a short "what to look at next" list. */
function insights(o: AgentOverview, status: AgentServiceStatus | null, learning: LearningSummary | null): Insight[] {
    const out: Insight[] = [];
    if (status && !status.reachable) out.push({ tone: 'bad', text: `The router could not be reached: ${status.error ?? 'unknown error'}. Searches fall back to Groq / keyword match.` });
    if (status?.telemetry?.enabled === false)
        out.push({ tone: 'bad', text: 'The router is not sending decisions to the CMS. Set HMS_CMS_API_URL and HMS_CMS_SERVICE_KEY on the router.' });
    if ((status?.telemetry?.dropped ?? 0) > 0)
        out.push({ tone: 'warn', text: `${num(status!.telemetry!.dropped)} decisions were dropped because the CMS could not be reached. Numbers here are slightly low.` });
    if (o.total === 0) {
        out.push({ tone: 'warn', text: 'No decisions in this period. If the agents are being used, the router feed is not reaching the CMS.' });
        return out;
    }
    const noMatch = share(o.abstained, o.total) ?? 0;
    const clarify = share(o.clarified, o.total) ?? 0;
    if (noMatch > 0.15) out.push({ tone: 'warn', text: `${pct(noMatch)} of queries got no match. Many are new ways of describing symptoms: teach them.`, action: { label: 'Review', tab: 'learning' } });
    if (clarify > 0.35) out.push({ tone: 'warn', text: `The router was unsure ${pct(clarify)} of the time and had to ask or show a list.`, action: { label: 'See why', tab: 'decisions' } });
    if ((learning?.pending ?? 0) > 0) out.push({ tone: 'warn', text: `${num(learning!.pending)} mistakes and doubtful answers are waiting for a person to review.`, action: { label: 'Review now', tab: 'learning' } });
    if ((learning?.awaitingRebuild ?? 0) > 0) out.push({ tone: 'warn', text: `${num(learning!.awaitingRebuild)} approved corrections are not in the model yet. Rebuild to teach them.`, action: { label: 'Rebuild', tab: 'models' } });
    if ((o.p95LatencyMs ?? 0) > 800) out.push({ tone: 'warn', text: `Slowest 5% of answers take over ${ms(o.p95LatencyMs)}. Check the LLM reasoner timeout and server load.` });
    if (o.emergencies > 0) out.push({ tone: 'good', text: `${num(o.emergencies)} emergencies were flagged and told to call 112. Spot-check them in the review queue.`, action: { label: 'Check', tab: 'learning' } });
    if (out.every(i => i.tone === 'good')) out.unshift({ tone: 'good', text: 'Agents are healthy: most queries are answered confidently and nothing is waiting for review.' });
    return out;
}

const Bars: React.FC<{ rows: { name: string; count: number }[]; total: number; label?: (n: string) => string }> = ({ rows, total, label }) =>
    rows.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <ul className="vita-list">
            {rows.map(r => (
                <li key={r.name}>
                    <span className="vita-list-main">{label ? label(r.name) : r.name}</span>
                    <span className="vita-bar-cell">
                        <span className="vita-bar-track"><span className="vita-bar-fill" style={{ width: `${Math.max(2, (r.count / Math.max(total, 1)) * 100)}%` }} /></span>
                        <span className="vita-count">{num(r.count)}</span>
                    </span>
                </li>
            ))}
        </ul>
    );

export const OverviewSection: React.FC<{
    o: AgentOverview;
    status: AgentServiceStatus | null;
    learning: LearningSummary | null;
    models?: ModelVersion[] | null;
    goTo: (tab: string) => void;
}> = ({ o, status, learning, models, goTo }) => {
    const list = insights(o, status, learning);
    const answered = share(o.answered, o.total);
    const clarify = share(o.clarified, o.total);
    const noMatch = share(o.abstained, o.total);
    const isChatOnly = o.byAgent.length === 1 && o.byAgent[0].name === 'chat';
    const daily = o.daily.map(d => ({
        ...d,
        day: shortDay(d.date),
        answeredShare: d.total ? (d.answer + d.recommendation) / d.total : null,
    }));
    // Days a rebuilt model went live (India time), to read the trend as before / after learning.
    const liveDays = new Set(daily.map(d => d.day));
    const modelMarks = (models ?? [])
        .filter(m => m.promoted && m.modelVersion)
        .map(m => ({ day: shortDay(new Date(new Date(m.builtAt).getTime() + 330 * 60000).toISOString().slice(0, 10)), learned: m.learnedItems ?? 0 }))
        .filter(m => liveDays.has(m.day));
    const decisionKeys = (['answer', 'clarify', 'abstain', 'follow_up', 'recommendation'] as const)
        .filter(k => o.daily.some(d => (k === 'follow_up' ? d.followUp : k === 'recommendation' ? d.recommendation : d[k]) > 0));
    const fieldOf = (k: string) => (k === 'follow_up' ? 'followUp' : k);

    return (
        <div className="vita-stack">
            <Card title="What needs attention" className="vita-insights">
                <ul className="vita-insight-list">
                    {list.map((i, n) => (
                        <li key={n} className={`vita-insight vita-insight-${i.tone}`}>
                            {i.tone === 'good' ? <CheckCircle2 size={16} /> : i.tone === 'bad' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
                            <span>{i.text}</span>
                            {i.action && <button className="vita-link" onClick={() => goTo(i.action!.tab)}>{i.action.label} →</button>}
                        </li>
                    ))}
                </ul>
            </Card>

            <div className="vita-tiles">
                <Tile label="Decisions" value={num(o.total)} sub={`${shortDay(o.from)} – ${shortDay(o.to)}`} />
                {!isChatOnly && <Tile label="Answered confidently" value={pct(answered)} tone={toneFor(answered, 0.6, 0.4, true)} sub={`${num(o.answered)} queries`} title="Sure enough to name the specialty without asking" />}
                {!isChatOnly && <Tile label="Asked to clarify" value={pct(clarify)} tone={toneFor(clarify, 0.3, 0.45)} sub={`${num(o.clarified)} queries`} />}
                <Tile label="No match" value={pct(noMatch)} tone={toneFor(noMatch, 0.08, 0.15)} sub={`${num(o.abstained)} queries`} title="Not routed: nothing similar in training, or not a health query" />
                <Tile label="Emergencies flagged" value={num(o.emergencies)} sub={pct(share(o.emergencies, o.total), 1)} />
                <Tile label="Average confidence" value={pct(o.avgConfidence)} tone={toneFor(o.avgConfidence, 0.6, 0.45, true)} title="Top specialty's score, 0-100%" />
                <Tile label="Response time (95%)" value={ms(o.p95LatencyMs)} sub={`average ${ms(o.avgLatencyMs)}`} tone={toneFor(o.p95LatencyMs, 500, 1000)} />
                <Tile label="LLM reasoner used" value={pct(share(o.reasonerUsed, o.total))} sub={`${num(o.reasonerUsed)} times`} title="Hard cases sent to the LLM for a second opinion" />
            </div>

            <div className="vita-grid-2">
                <Card title="What the agents decided, per day">
                    {daily.length === 0 ? <Empty>No decisions in this period.</Empty> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {decisionKeys.map(k => (
                                    <Bar key={k} dataKey={fieldOf(k)} name={DECISIONS[k].label} stackId="d" fill={DECISIONS[k].color} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card title="Is it getting surer?">
                    {daily.length === 0 ? <Empty>No decisions in this period.</Empty> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} tickFormatter={v => `${Math.round(v * 100)}%`} />
                                <Tooltip formatter={(v) => pct(typeof v === 'number' ? v : null)} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {modelMarks.map(m => (
                                    <ReferenceLine key={m.day} x={m.day} stroke="#94a3b8" strokeDasharray="4 3"
                                        label={{ value: m.learned ? `new model (+${m.learned})` : 'new model', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
                                ))}
                                <Line type="monotone" dataKey="avgConfidence" name="Average confidence" stroke="#2a78d6" dot={false} strokeWidth={2} connectNulls />
                                <Line type="monotone" dataKey="answeredShare" name="Answered without asking" stroke="#1baf7a" dot={false} strokeWidth={2} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                    <p className="vita-muted vita-small">Dashed lines mark the days a rebuilt model went live (+ corrections it learned). Both lines rising after one means the agent learned; a drop right after one is a reason to look at Model versions.</p>
                </Card>
            </div>

            <div className="vita-grid-3">
                <Card title="How sure was it?">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={o.confidenceBuckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Decisions" fill="#2a78d6" />
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="vita-muted vita-small">Confidence of the top specialty. Below 60% the router asks instead of answering.</p>
                </Card>
                <Card title="Who is asking">
                    <Bars rows={o.byCaller} total={o.total} label={callerName} />
                </Card>
                <Card title="Most routed specialties">
                    <Bars rows={o.topSpecialties} total={o.answered} label={specialtyName} />
                </Card>
            </div>

            {o.modelVersionsInUse.length > 1 && (
                <Card title="Model versions that answered in this period">
                    <Bars rows={o.modelVersionsInUse} total={o.total} />
                </Card>
            )}
        </div>
    );
};

export default OverviewSection;
