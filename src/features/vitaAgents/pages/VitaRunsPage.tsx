import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import { TRIGGERS, VERDICT_LABELS, type VitaRepo, type VitaResult, type VitaRun, type VitaRunDetail, type VitaRunVerdict, type VitaTrigger, type VitaVerdictLabel } from '../types';
import { ms, shortId, useLoad, when } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { isRunActive, resultTone, TRIGGER_LABEL, useVitaAccess, useVitaHub, verdictLabel, verdictTone } from '../components/testAgent';

const POLL_MS = 5_000;
const VERDICTS: { id: VitaRunVerdict | 'running'; label: string }[] = [
    { id: 'green', label: 'Green' },
    { id: 'red', label: 'Red' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'running', label: 'Queued / running' },
];

/** Expanded row: polls GET /runs/{repo}/{id} every 5 s while the run is queued or running, then lists the results. */
const RunDetail: React.FC<{ repo: string; run: VitaRun; onFinished: () => void }> = ({ repo, run, onFinished }) => {
    const [detail, setDetail] = React.useState<VitaRunDetail | null>(null);
    const [results, setResults] = React.useState<VitaResult[] | null>(null);
    const [err, setErr] = React.useState<string | null>(null);
    const [showReport, setShowReport] = React.useState(false);
    const [labelling, setLabelling] = React.useState<string | null>(null);
    const { canApprove } = useVitaAccess();
    const active = isRunActive(detail?.status ?? run.status);

    // A human correction of the Judge (vita.approve). The Learner mines these into judge examples.
    const relabel = async (r: VitaResult, label: VitaVerdictLabel) => {
        setLabelling(r.id);
        try {
            await vitaApi.relabelResult(r.id, label);
            setResults((rows) =>
                (rows ?? []).map((x) => (x.id === r.id && x.verdict ? { ...x, verdict: { ...x.verdict, human_label: label } } : x))
            );
            toast.success(`Verdict relabelled as ${label}`, { description: r.case_title ?? r.case_id });
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not relabel the verdict.'));
        } finally {
            setLabelling(null);
        }
    };

    const loadResults = React.useCallback(
        () =>
            vitaApi
                .runResults(repo, run.id)
                .then(setResults)
                .catch((e) => setErr(vitaApiError(e, 'Could not load the results.'))),
        [repo, run.id]
    );

    React.useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const wasActive = isRunActive(run.status);
        const tick = async () => {
            try {
                const d = await vitaApi.run(repo, run.id);
                if (stopped) return;
                setDetail(d);
                setErr(null);
                if (isRunActive(d.status)) {
                    timer = setTimeout(tick, POLL_MS);
                } else {
                    await loadResults();
                    if (wasActive) onFinished(); // the list's verdict column is stale only when we watched it finish
                }
            } catch (e) {
                if (stopped) return;
                setErr(vitaApiError(e, 'Could not load the run.'));
                // A finished run still has results even when the detail route is unavailable (Phase 0 Vita has no GET runs/{repo}/{id}).
                if (!isRunActive(run.status)) await loadResults();
            }
        };
        void tick();
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, run.id]);

    const s = detail?.summary ?? run.summary ?? {};
    return (
        <div className="vita-detail">
            <div className="vita-ta-toolbar">
                <div className="vita-chips">
                    <span className="vita-chip">Run {run.id}</span>
                    {run.branch && <span className="vita-chip">{run.branch}</span>}
                    {run.sha && <span className="vita-chip vita-code">{run.sha.slice(0, 10)}</span>}
                    {run.pr_number != null && <span className="vita-chip">PR #{run.pr_number}</span>}
                    <span className="vita-chip">target: {run.target}</span>
                    {active && (
                        <span className="vita-chip">
                            <RefreshCw size={11} className="vita-spin" /> {detail?.status ?? run.status} · refreshing every 5 s
                        </span>
                    )}
                </div>
                <span className="vita-muted vita-small">
                    {s.pass ?? 0} pass · {s.fail ?? 0} fail · {s.error ?? 0} error · {s.skip ?? 0} skip
                </span>
            </div>

            {err && <ErrorBox message={err} />}

            {!active && results && (
                <div className="vita-scroll">
                    {results.length === 0 ? (
                        <Empty>No results were recorded for this run.</Empty>
                    ) : (
                        <table className="vita-table vita-ta-results">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Skill</th>
                                    <th>Case</th>
                                    <th>Message</th>
                                    <th>Verdict</th>
                                    {canApprove && <th>Label</th>}
                                    <th className="num">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <Pill tone={resultTone(r.status)}>{r.status}</Pill>
                                        </td>
                                        <td className="vita-nowrap">{r.skill}</td>
                                        <td className="vita-code" title={r.case_id}>
                                            {r.case_title ?? shortId(r.case_id)}
                                        </td>
                                        <td className="vita-ta-msg" title={r.message}>
                                            {r.message || '—'}
                                        </td>
                                        <td>
                                            {r.verdict ? (
                                                <span title={r.verdict.explanation}>
                                                    {r.verdict.label} <span className="vita-muted vita-small">{Math.round(r.verdict.confidence * 100)}%</span>
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        {canApprove && (
                                            <td>
                                                {r.verdict ? (
                                                    <select
                                                        className="vita-input"
                                                        title="Correct the Judge's verdict"
                                                        value={r.verdict.human_label ?? ''}
                                                        disabled={labelling === r.id}
                                                        onChange={(e) => e.target.value && void relabel(r, e.target.value as VitaVerdictLabel)}
                                                    >
                                                        <option value="">{r.verdict.human_label ? r.verdict.human_label : 'Relabel…'}</option>
                                                        {VERDICT_LABELS.map((l) => (
                                                            <option key={l} value={l}>
                                                                {l}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        )}
                                        <td className="num">{ms(r.duration_ms)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {detail?.report_md && (
                <>
                    <button className="vita-btn vita-btn-sm" onClick={() => setShowReport((v) => !v)}>
                        {showReport ? 'Hide report' : 'Show report'}
                    </button>
                    {showReport && <pre className="vita-ta-report">{detail.report_md}</pre>}
                </>
            )}
        </div>
    );
};

const VitaRunsPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { canManage } = useVitaAccess();
    const repo = params.get('repo') ?? '';
    const trigger = (params.get('trigger') ?? '') as VitaTrigger | '';
    const verdict = (params.get('verdict') ?? '') as VitaRunVerdict | 'running' | '';
    const [open, setOpen] = React.useState<string | null>(params.get('run'));
    const [rerunning, setRerunning] = React.useState<string | null>(null);

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key === 'repo') next.delete('run');
        setParams(next, { replace: true });
    };

    const { data: repos } = useLoad(() => vitaApi.repos(), []);
    React.useEffect(() => {
        if (!repo && repos && repos.length > 0) setParam('repo', repos[0].repo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, repo]);

    const { data: runs, error, loading, reload } = useLoad(() => (repo ? vitaApi.runs(repo, 50) : Promise.resolve([] as VitaRun[])), [repo]);

    // Live updates: a run in this repo changed state -> refresh the list (the expanded row polls itself).
    useVitaHub((e) => {
        if (e.repo === repo) reload();
    });

    const rerun = async (r: VitaRun) => {
        setRerunning(r.id);
        try {
            const manifest = repos?.find((x: VitaRepo) => x.repo === repo)?.manifest_path;
            const res = await vitaApi.enqueueRun({
                repo,
                manifest_path: manifest,
                trigger: r.trigger === 'pr' ? 'manual' : r.trigger,
                target: r.target === 'prod' ? 'prod' : 'dev',
                branch: r.branch,
                sha: r.sha,
                pr_number: r.pr_number,
            });
            toast.success(`Run ${res.run_id} queued`, { description: `Re-run of ${shortId(r.id)} (${TRIGGER_LABEL[r.trigger] ?? r.trigger}).` });
            setOpen(res.run_id);
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not queue the run.'));
        } finally {
            setRerunning(null);
        }
    };

    const rows = (runs ?? []).filter(
        (r) =>
            (!trigger || r.trigger === trigger) &&
            (!verdict || (verdict === 'running' ? isRunActive(r.status) : r.verdict === verdict))
    );

    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div className="vita-filters">
                    <select className="vita-input" value={repo} onChange={(e) => setParam('repo', e.target.value)} title="Repo">
                        {!repo && <option value="">Select a repo</option>}
                        {repo && !repos?.some((x) => x.repo === repo) && <option value={repo}>{repo}</option>}
                        {(repos ?? []).map((x) => (
                            <option key={x.repo} value={x.repo}>
                                {x.repo}
                            </option>
                        ))}
                    </select>
                    <select className="vita-input" value={trigger} onChange={(e) => setParam('trigger', e.target.value)} title="Trigger">
                        <option value="">All triggers</option>
                        {TRIGGERS.map((t) => (
                            <option key={t} value={t}>
                                {TRIGGER_LABEL[t]}
                            </option>
                        ))}
                    </select>
                    <select className="vita-input" value={verdict} onChange={(e) => setParam('verdict', e.target.value)} title="Verdict">
                        <option value="">All verdicts</option>
                        {VERDICTS.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </div>
                <button className="vita-btn" onClick={reload} disabled={loading || !repo} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            {error && !runs ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the runs.')} onRetry={reload} />
            ) : !repo ? (
                <Empty>Select a repo to see its runs.</Empty>
            ) : !runs ? (
                <Empty>Loading runs…</Empty>
            ) : rows.length === 0 ? (
                <Empty>No runs match these filters.</Empty>
            ) : (
                <div className="vita-scroll">
                    <table className="vita-table vita-table-click">
                        <thead>
                            <tr>
                                <th style={{ width: 28 }} />
                                <th>Started</th>
                                <th>Trigger</th>
                                <th>Target</th>
                                <th>Branch / PR</th>
                                <th>Verdict</th>
                                <th className="num">Pass</th>
                                <th className="num">Fail</th>
                                <th className="num">Error</th>
                                <th>Run</th>
                                {canManage && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const isOpen = open === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr onClick={() => setOpen(isOpen ? null : r.id)}>
                                            <td className="vita-ta-chevron">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                                            <td className="vita-nowrap">{when(r.started_at)}</td>
                                            <td className="vita-nowrap">{TRIGGER_LABEL[r.trigger] ?? r.trigger}</td>
                                            <td>{r.target}</td>
                                            <td className="vita-ellipsis">
                                                {r.branch ?? '—'}
                                                {r.pr_number != null && <span className="vita-muted"> · #{r.pr_number}</span>}
                                            </td>
                                            <td>
                                                <Pill tone={verdictTone(r.verdict, r.status)}>{verdictLabel(r.verdict, r.status)}</Pill>
                                            </td>
                                            <td className="num">{r.summary?.pass ?? '—'}</td>
                                            <td className={`num ${(r.summary?.fail ?? 0) > 0 ? 'vita-bad' : ''}`}>{r.summary?.fail ?? '—'}</td>
                                            <td className="num">{r.summary?.error ?? '—'}</td>
                                            <td className="vita-code" title={r.id}>
                                                {shortId(r.id)}
                                            </td>
                                            {canManage && (
                                                <td className="vita-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        className="vita-btn vita-btn-sm"
                                                        onClick={() => rerun(r)}
                                                        disabled={rerunning !== null || isRunActive(r.status)}
                                                        title="Queue the same run again"
                                                    >
                                                        <RotateCcw size={12} /> {rerunning === r.id ? 'Queuing…' : 'Re-run'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                        {isOpen && (
                                            <tr className="vita-detail-row">
                                                <td colSpan={canManage ? 11 : 10}>
                                                    <RunDetail repo={repo} run={r} onFinished={reload} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default VitaRunsPage;
