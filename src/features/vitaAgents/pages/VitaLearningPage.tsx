import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, GraduationCap, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaEscape, VitaEscapeVerifyResponse, VitaEvalCheck, VitaLearning, VitaLesson, VitaLessonKind } from '../types';
import { shortId, useLoad, when } from '../components/format';
import type { Tone } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { useVitaAccess, useVitaHub } from '../components/testAgent';

// What the Learner (vita/agents/learner.py) proposes, applies and remembers. Approve / Revert / Dismiss need vita.approve;
// "Learn now" needs vita.manage. Escape verification promotes cases to ACTIVE, so it needs vita.approve too.

const KIND_LABEL: Record<VitaLessonKind, string> = {
    quarantine: 'Quarantine',
    promote: 'Promote',
    risk: 'Risk map',
    judge_example: 'Judge example',
};
const kindTone = (k: VitaLessonKind): Tone => (k === 'promote' ? 'good' : k === 'quarantine' ? 'warn' : 'neutral');

const METRIC_LABEL: Record<string, string> = {
    judge_agreement: 'Judge agreement',
    judge_bug_recall: 'Judge bug recall',
    judge_false_bugs: 'Judge false bugs',
    judge_prior_precision: 'Deterministic prior precision',
    planner_recall: 'Planner recall',
    planner_must_not_violations: 'Planner gate-rule violations',
    injection_stability: 'Injection stability',
    injection_separation: 'Instruction / data separation',
    oracle_false_fails: 'Oracle false FAILs (known-good API)',
    oracle_errors: 'Oracle executor errors',
    oracle_sensitivity: 'Oracle sensitivity (broken API caught)',
};

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v <= 1 ? `${(v * 100).toFixed(1)}%` : v.toFixed(2));

/** One line saying what a lesson changes. */
const describe = (l: VitaLesson): React.ReactNode => {
    const p = l.payload;
    switch (l.kind) {
        case 'quarantine':
        case 'promote':
            return (
                <>
                    <strong>{p.title ?? shortId(l.subject)}</strong>: {p.from_status} → {p.to_status}
                    {p.reason && <div className="vita-small">{p.reason}</div>}
                </>
            );
        case 'risk': {
            const raised = p.raise ?? [];
            return (
                <>
                    Raise {raised.length} node(s) by 1, decay the rest ×0.9
                    {raised.length > 0 && <div className="vita-small vita-code vita-wrap">{raised.slice(0, 4).join(', ')}{raised.length > 4 ? ` … +${raised.length - 4}` : ''}</div>}
                </>
            );
        }
        case 'judge_example':
            return (
                <>
                    <strong>{p.case_title ?? shortId(p.result_id ?? l.subject)}</strong>: the Judge said <Pill tone="neutral">{p.model_label}</Pill>, a person
                    said <Pill tone="good">{p.human_label}</Pill>
                    {p.message && <div className="vita-small vita-ta-msg">{p.message}</div>}
                </>
            );
        default:
            return l.subject;
    }
};

const CheckBadge: React.FC<{ c: VitaEvalCheck }> = ({ c }) =>
    c.passed ? <Pill tone="good">pass</Pill> : c.enforced ? <Pill tone="bad">fail</Pill> : <Pill tone="warn">baseline</Pill>;

const VitaLearningPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { canManage, canApprove } = useVitaAccess();
    const repo = params.get('repo') ?? '';
    const [busy, setBusy] = React.useState<string | null>(null); // lesson id, 'learn' or 'verify'
    const [escapeId, setEscapeId] = React.useState('');
    const [brokenSha, setBrokenSha] = React.useState('');
    const [fixedSha, setFixedSha] = React.useState('');
    const [verified, setVerified] = React.useState<VitaEscapeVerifyResponse | null>(null);

    const setRepo = (value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set('repo', value);
        else next.delete('repo');
        setParams(next, { replace: true });
        setVerified(null);
        setEscapeId('');
    };

    const { data: repos } = useLoad(() => vitaApi.repos(), []);
    React.useEffect(() => {
        if (!repo && repos && repos.length > 0) setRepo(repos[0].repo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, repo]);

    const { data: learning, error, loading, reload } = useLoad(
        () => (repo ? vitaApi.learning(repo) : Promise.resolve(null as VitaLearning | null)),
        [repo]
    );
    const { data: escapes, reload: reloadEscapes } = useLoad(
        () => (repo ? vitaApi.escapes(repo) : Promise.resolve([] as VitaEscape[])),
        [repo]
    );

    // A nightly run ends with the Learner: refresh when one finishes.
    useVitaHub((e) => {
        if (e.repo === repo && e.status === 'done') reload();
    });

    const act = async (l: VitaLesson, action: 'apply' | 'revert') => {
        setBusy(l.id);
        try {
            if (action === 'apply') {
                await vitaApi.applyLesson(l.id);
                toast.success(`${KIND_LABEL[l.kind]} applied`, { description: 'Recorded in the audit log with the runs that justify it.' });
            } else {
                await vitaApi.revertLesson(l.id);
                toast.success(l.status === 'pending' ? 'Lesson dismissed' : `${KIND_LABEL[l.kind]} reverted`, {
                    description: l.status === 'pending' ? 'The Learner will not propose it again.' : 'The previous state is restored.',
                });
            }
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, `Could not ${action} the lesson.`));
        } finally {
            setBusy(null);
        }
    };

    const learnNow = async () => {
        setBusy('learn');
        try {
            const res = await vitaApi.learnNow(repo, true);
            const n = res.report.lessons_new.length;
            toast.success(n ? `${n} new lesson(s)` : 'Nothing new to learn', {
                description: `${res.applied.length} applied automatically · ${res.report.results_seen} results over ${res.report.runs_seen} runs read.`,
            });
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not run the Learner.'));
        } finally {
            setBusy(null);
        }
    };

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!escapeId || !brokenSha.trim() || !fixedSha.trim()) return;
        setBusy('verify');
        setVerified(null);
        try {
            const res = await vitaApi.verifyEscape(repo, escapeId, { broken_sha: brokenSha.trim(), fixed_sha: fixedSha.trim() });
            setVerified(res);
            if (res.kept.length) toast.success(`${res.kept.length} case(s) verified and promoted to active`, { description: 'The escape is closed.' });
            else if (res.note) toast.info('Nothing to verify', { description: res.note });
            else toast.warning('No case reproduced the escape', { description: `${res.retired.length} retired, ${res.inconclusive.length} inconclusive.` });
            reload();
            reloadEscapes();
        } catch (err) {
            toast.error(vitaApiError(err, 'Could not verify the escape.'));
        } finally {
            setBusy(null);
        }
    };

    const pending = learning?.lessons.pending ?? [];
    const applied = learning?.lessons.applied ?? [];
    const verifiable = (escapes ?? []).filter((x) => x.status !== 'closed');
    const ev = learning?.eval ?? null;

    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div className="vita-filters">
                    <select className="vita-input" value={repo} onChange={(e) => setRepo(e.target.value)} title="Repo">
                        {!repo && <option value="">Select a repo</option>}
                        {repo && !repos?.some((x) => x.repo === repo) && <option value={repo}>{repo}</option>}
                        {(repos ?? []).map((x) => (
                            <option key={x.repo} value={x.repo}>
                                {x.repo}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="vita-ta-actions">
                    {canManage && (
                        <button
                            className="vita-btn vita-btn-primary"
                            onClick={learnNow}
                            disabled={!!busy || !repo}
                            title="Mine the run history now and apply the lessons the Learner may apply on its own (it also runs after every nightly run)"
                        >
                            <GraduationCap size={14} className={busy === 'learn' ? 'vita-spin' : ''} /> {busy === 'learn' ? 'Learning…' : 'Learn now'}
                        </button>
                    )}
                    <button className="vita-btn" onClick={reload} disabled={loading || !repo} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {!canApprove && repo && (
                <div className="vita-explainer">
                    You can see what the Learner proposes but not approve or revert it: that needs the <strong>vita.approve</strong> permission.
                </div>
            )}

            {error && !learning ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the Learner.')} onRetry={reload} />
            ) : !repo ? (
                <Empty>Select a repo to see what Vita has learned from its runs.</Empty>
            ) : !learning ? (
                <Empty>Loading…</Empty>
            ) : (
                <>
                    <div className="vita-ta-stats vita-ta-cov-tiles">
                        <div className="vita-ta-stat" title="Pending lessons that change an ACTIVE case: a person decides">
                            <strong className={learning.counts.pending_needs_approval > 0 ? 'vita-bad' : ''}>{learning.counts.pending_needs_approval}</strong>
                            awaiting approval
                        </div>
                        <div className="vita-ta-stat">
                            <strong>{learning.auto_applied.length}</strong>
                            applied by the Learner
                        </div>
                        <div className="vita-ta-stat">
                            <strong>{learning.counts.reverted}</strong>
                            reverted / dismissed
                        </div>
                        <div className="vita-ta-stat" title="From the latest `vita eval` run">
                            <strong>{learning.judge_agreement != null ? fmt(learning.judge_agreement) : '—'}</strong>
                            Judge agreement{ev ? ` (${ev.provider === 'none' ? 'fallback' : ev.provider})` : ''}
                        </div>
                        <div className="vita-ta-stat">
                            <strong>{learning.risk_map.length}</strong>
                            risky nodes
                        </div>
                    </div>

                    <section className="vita-card">
                        <header className="vita-card-head">
                            <h3>Pending lessons ({pending.length})</h3>
                        </header>
                        <div className="vita-explainer">
                            Quarantining an <strong>active</strong> case takes it out of the PR gate, so a person approves it. Shadow-only changes, the risk
                            map and relabelled verdicts are applied by the Learner on its own and listed below, where they can be reverted.
                        </div>
                        {pending.length === 0 ? (
                            <Empty>Nothing waiting.</Empty>
                        ) : (
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Kind</th>
                                            <th>What it changes</th>
                                            <th>Evidence</th>
                                            <th>Mined</th>
                                            {canApprove && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pending.map((l) => (
                                            <tr key={l.id}>
                                                <td className="vita-nowrap">
                                                    <Pill tone={kindTone(l.kind)}>{KIND_LABEL[l.kind]}</Pill> {l.auto_apply ? <Pill tone="neutral">auto</Pill> : null}
                                                </td>
                                                <td className="vita-wrap">{describe(l)}</td>
                                                <td className="vita-nowrap" title={l.justified_by.join('\n')}>
                                                    {l.justified_by.length} run(s)
                                                </td>
                                                <td className="vita-nowrap">{when(l.created_at)}</td>
                                                {canApprove && (
                                                    <td className="vita-nowrap">
                                                        <div className="vita-ta-actions">
                                                            <button className="vita-btn vita-btn-sm" onClick={() => act(l, 'apply')} disabled={!!busy}>
                                                                <CheckCircle2 size={12} /> {busy === l.id ? 'Saving…' : 'Approve'}
                                                            </button>
                                                            <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => act(l, 'revert')} disabled={!!busy}>
                                                                <XCircle size={12} /> Dismiss
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="vita-card">
                        <header className="vita-card-head">
                            <h3>Applied ({applied.length})</h3>
                        </header>
                        {applied.length === 0 ? (
                            <Empty>No lesson applied yet.</Empty>
                        ) : (
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Kind</th>
                                            <th>What it changed</th>
                                            <th>By</th>
                                            <th>When</th>
                                            {canApprove && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applied.map((l) => (
                                            <tr key={l.id}>
                                                <td className="vita-nowrap">
                                                    <Pill tone={kindTone(l.kind)}>{KIND_LABEL[l.kind]}</Pill>
                                                </td>
                                                <td className="vita-wrap">{describe(l)}</td>
                                                <td className="vita-nowrap">
                                                    {l.payload.auto_applied ? (
                                                        <Pill tone="neutral">Learner (auto){l.applied_by && l.applied_by !== 'learner' ? ` · ${l.applied_by}` : ''}</Pill>
                                                    ) : (
                                                        l.applied_by
                                                    )}
                                                </td>
                                                <td className="vita-nowrap">{when(l.applied_at ?? l.created_at)}</td>
                                                {canApprove && (
                                                    <td className="vita-nowrap">
                                                        <button className="vita-btn vita-btn-sm vita-btn-danger" onClick={() => act(l, 'revert')} disabled={!!busy}>
                                                            <RotateCcw size={12} /> {busy === l.id ? 'Reverting…' : 'Revert'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <div className="vita-detail-grid">
                        <section className="vita-card">
                            <header className="vita-card-head">
                                <h3>Risk map (top {learning.risk_map.length})</h3>
                            </header>
                            <div className="vita-explainer">
                                +1 for every node whose case failed with a <strong>bug</strong> verdict (cap 10), ×0.9 for the rest at each update. The Planner
                                runs the cases of riskier nodes first among the impacted ones.
                            </div>
                            {learning.risk_map.length === 0 ? (
                                <Empty>No bug on record yet.</Empty>
                            ) : (
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Node</th>
                                            <th>Risk</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {learning.risk_map.map((r) => (
                                            <tr key={r.node_id}>
                                                <td className="vita-code vita-wrap">{r.node_id}</td>
                                                <td className="vita-nowrap" title={`updated ${when(r.updated_at)}`}>
                                                    {r.score.toFixed(2)}
                                                    <div className="vita-ta-covbar vita-ta-riskbar">
                                                        <span style={{ width: `${Math.min(100, r.score * 10)}%` }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </section>

                        <section className="vita-card">
                            <header className="vita-card-head">
                                <h3>Agent evals</h3>
                            </header>
                            {!ev ? (
                                <Empty>No eval stored yet: run `vita eval --suite all` on the Vita server (CI runs it on agent PRs).</Empty>
                            ) : (
                                <>
                                    <div className="vita-ta-actions vita-small">
                                        {ev.passed ? <Pill tone="good">enforced checks pass</Pill> : <Pill tone="bad">enforced checks fail</Pill>}
                                        <span>
                                            {ev.provider === 'none' ? 'deterministic fallback (no model): model-only metrics are a baseline' : `model: ${ev.provider}`} ·{' '}
                                            {when(ev.at)}
                                            {ev.prompt_version ? ` · prompts ${ev.prompt_version}` : ''}
                                        </span>
                                    </div>
                                    <table className="vita-table">
                                        <thead>
                                            <tr>
                                                <th>Metric</th>
                                                <th>Value</th>
                                                <th>Target</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ev.checks.map((c) => (
                                                <tr key={c.name} title={c.note || undefined}>
                                                    <td>{METRIC_LABEL[c.name] ?? c.name}</td>
                                                    <td className="vita-nowrap">{fmt(c.value)}</td>
                                                    <td className="vita-nowrap">
                                                        {c.op === '>=' ? '≥' : '≤'} {fmt(c.threshold)}
                                                    </td>
                                                    <td className="vita-nowrap">
                                                        <CheckBadge c={c} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </section>
                    </div>

                    <section className="vita-card">
                        <header className="vita-card-head">
                            <h3>
                                <ShieldCheck size={16} /> Verify an escape
                            </h3>
                        </header>
                        <div className="vita-explainer">
                            Each case logged for the escape runs against the build that shipped the bug and the one that fixed it (a PR stack per build). A case
                            that fails on the first and passes on the second becomes <strong>active</strong> and closes the escape; any other case is retired.
                            This takes several minutes.
                        </div>
                        {!canApprove ? (
                            <Empty>Verifying promotes cases to active: it needs the vita.approve permission.</Empty>
                        ) : verifiable.length === 0 ? (
                            <Empty>
                                No open escape. Log one on the <Link to={`/vita/coverage?repo=${encodeURIComponent(repo)}`}>Coverage</Link> tab.
                            </Empty>
                        ) : (
                            <form className="vita-ta-escape-form" onSubmit={verify}>
                                <div className="vita-ta-actions">
                                    <select className="vita-input" value={escapeId} onChange={(e) => setEscapeId(e.target.value)} title="Escape">
                                        <option value="">Select an escape</option>
                                        {verifiable.map((x) => (
                                            <option key={x.id} value={x.id}>
                                                {x.title} ({x.status})
                                            </option>
                                        ))}
                                    </select>
                                    <input className="vita-input" value={brokenSha} onChange={(e) => setBrokenSha(e.target.value)} placeholder="broken sha (shipped the bug)" />
                                    <input className="vita-input" value={fixedSha} onChange={(e) => setFixedSha(e.target.value)} placeholder="fixed sha" />
                                    <button className="vita-btn vita-btn-primary" type="submit" disabled={!!busy || !escapeId || !brokenSha.trim() || !fixedSha.trim()}>
                                        <ShieldCheck size={14} className={busy === 'verify' ? 'vita-spin' : ''} /> {busy === 'verify' ? 'Verifying…' : 'Verify'}
                                    </button>
                                </div>
                            </form>
                        )}
                        {verified && verified.cases.length > 0 && (
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Case</th>
                                            <th>Broken</th>
                                            <th>Fixed</th>
                                            <th>Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {verified.cases.map((c) => (
                                            <tr key={c.case_id}>
                                                <td className="vita-wrap">{c.title}</td>
                                                <td className="vita-nowrap">{c.broken.status}</td>
                                                <td className="vita-nowrap">{c.fixed.status}</td>
                                                <td className="vita-wrap">
                                                    <Pill tone={c.outcome === 'verified' ? 'good' : c.outcome === 'rejected' ? 'bad' : 'warn'}>{c.outcome}</Pill>
                                                    <div className="vita-small">{c.reason}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default VitaLearningPage;
