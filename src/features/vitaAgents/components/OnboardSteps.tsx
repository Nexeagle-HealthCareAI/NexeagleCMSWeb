import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, Play } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaAddRepoResponse, VitaBaselinePreview, VitaBaselineWritten, VitaRunDetail, VitaTarget } from '../types';
import { num } from './format';
import { Pill } from './shared';
import { isRunActive, useVitaAccess } from './testAgent';

/** Steps 3 and 4 of adding a repo, shown under "Add repo" once the manifest is accepted: run it once, then record what
 *  that run found as known findings (vita-baseline.txt), so old debt keeps being reported but does not block PRs. */

const POLL_MS = 5_000;
// Failing tests of the repo's own suite are bugs to fix, not debt to list: unticked by default.
const UNTICKED = new Set(['repo-native']);

const Step: React.FC<{ n: number; state: 'done' | 'now' | 'todo'; title: string; sub: string }> = ({ n, state, title, sub }) => (
    <li className={`vita-step ${state === 'done' ? 'vita-step-done' : state === 'now' ? 'vita-step-now' : ''}`} aria-current={state === 'now' ? 'step' : undefined}>
        <span className="vita-step-n">{n}</span>
        <span>
            {title}
            <small>{sub}</small>
        </span>
    </li>
);

const OnboardSteps: React.FC<{ added: VitaAddRepoResponse }> = ({ added }) => {
    const { canManage, canApprove } = useVitaAccess();
    const [runId, setRunId] = React.useState<string | null>(null);
    const [run, setRun] = React.useState<VitaRunDetail | null>(null);
    const [preview, setPreview] = React.useState<VitaBaselinePreview | null>(null);
    const [skills, setSkills] = React.useState<Set<string>>(new Set());
    const [note, setNote] = React.useState(`First run ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    const [written, setWritten] = React.useState<VitaBaselineWritten | null>(null);
    const [busy, setBusy] = React.useState<string | null>(null);
    const target = (added.targets.includes('dev') ? 'dev' : added.targets[0] ?? 'dev') as VitaTarget;

    const startRun = async () => {
        setBusy('run');
        try {
            const res = await vitaApi.enqueueRun({ repo: added.repo, manifest_path: added.manifest_path, trigger: 'manual', target });
            setRunId(res.run_id);
            setRun(null);
            setPreview(null);
            setWritten(null);
            toast.success(`First run of ${added.repo} queued`, { description: `Run ${res.run_id}` });
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not start the run.'));
        } finally {
            setBusy(null);
        }
    };

    // Poll the run until it is done, then ask what a baseline from it would list.
    React.useEffect(() => {
        if (!runId) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            try {
                const d = await vitaApi.run(added.repo, runId);
                if (stopped) return;
                setRun(d);
                if (isRunActive(d.status)) {
                    timer = setTimeout(tick, POLL_MS);
                    return;
                }
                const p = await vitaApi.previewBaseline(added.repo, { run_id: runId });
                if (stopped) return;
                setPreview(p);
                setSkills(new Set(Object.keys(p.by_skill).filter((s) => !UNTICKED.has(s))));
            } catch (e) {
                if (!stopped) timer = setTimeout(tick, POLL_MS * 2);
                console.warn('Vita onboarding poll failed', e);
            }
        };
        void tick();
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
        };
    }, [runId, added.repo]);

    const record = async () => {
        if (!runId) return;
        setBusy('write');
        try {
            const res = await vitaApi.writeBaseline(added.repo, { run_id: runId, skills: [...skills], note });
            setWritten(res);
            toast.success(`${res.count} known findings recorded for ${added.repo}`, { description: 'They keep running but cannot fail a PR.' });
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not record the known findings.'));
        } finally {
            setBusy(null);
        }
    };

    const selected = preview ? Object.entries(preview.by_skill).filter(([s]) => skills.has(s)).reduce((a, [, n]) => a + n, 0) : 0;
    const done = run && !isRunActive(run.status);
    const s = run?.summary ?? {};
    return (
        <div className="vita-explainer" style={{ marginTop: 10 }}>
            <ol className="vita-steps" aria-label="Steps">
                <Step n={1} state="done" title="Manifest" sub={`${added.repo} · ${added.kind}`} />
                <Step n={2} state="done" title="Validate & discover" sub={added.discovery_error ? 'discovery failed' : 'graph discovered'} />
                <Step n={3} state={done ? 'done' : 'now'} title="First run" sub={done ? `${num(s.pass ?? 0)} passed · ${num(s.fail ?? 0)} failed` : runId ? 'running…' : `on ${target}`} />
                <Step n={4} state={written ? 'done' : done ? 'now' : 'todo'} title="Known findings" sub={written ? `${written.count} recorded` : 'choose what is old debt'} />
            </ol>

            {!runId && (
                <div className="vita-ta-actions">
                    <button className="vita-btn vita-btn-primary" onClick={startRun} disabled={!canManage || busy !== null}>
                        <Play size={14} /> {busy === 'run' ? 'Queuing…' : 'Run it once now'}
                    </button>
                    <span className="vita-small vita-muted">Every case runs once against {target}; nothing blocks a PR yet.</span>
                </div>
            )}
            {runId && !done && (
                <div className="vita-small vita-muted">
                    Run {runId} is {run?.status ?? 'queued'}… this page follows it.{' '}
                    <Link to={`/vita/runs?repo=${encodeURIComponent(added.repo)}&run=${encodeURIComponent(runId)}`}>Open it on the Runs tab</Link>
                </div>
            )}

            {done && preview && !written && (
                <div className="vita-onboard">
                    <div>
                        {preview.count === 0 ? (
                            <p style={{ margin: 0, fontSize: 13 }}>
                                The first run found <strong>no failures</strong>: nothing to record. Every new failure will block the gate.
                            </p>
                        ) : (
                            <>
                                <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5 }}>
                                    The first run found <strong>{preview.count} failures</strong> in <strong>{added.repo}</strong>. What you record here is old debt: it
                                    keeps running every night and stays visible under <Link to={`/vita/known?repo=${encodeURIComponent(added.repo)}`}>Known findings</Link>, but
                                    cannot fail a PR. Anything new still does.
                                </p>
                                <fieldset style={{ border: '1px solid var(--vita-line)', borderRadius: 10, padding: '8px 12px', margin: 0 }}>
                                    <legend className="vita-small" style={{ fontWeight: 600, padding: '0 6px' }}>
                                        Record these failures as known
                                    </legend>
                                    {Object.entries(preview.by_skill).map(([skill, n]) => (
                                        <label key={skill} className="vita-skill-row">
                                            <input
                                                type="checkbox"
                                                checked={skills.has(skill)}
                                                onChange={(e) =>
                                                    setSkills((cur) => {
                                                        const next = new Set(cur);
                                                        if (e.target.checked) next.add(skill);
                                                        else next.delete(skill);
                                                        return next;
                                                    })
                                                }
                                            />
                                            <span>
                                                <strong>{skill}</strong>
                                                {UNTICKED.has(skill) && <span className="vita-muted"> — failing tests of the repo: fix these rather than list them</span>}
                                            </span>
                                            <Pill tone="warn">{n}</Pill>
                                        </label>
                                    ))}
                                </fieldset>
                                <label className="vita-small" style={{ display: 'grid', gap: 4, marginTop: 10 }}>
                                    <span>Note in the file</span>
                                    <input className="vita-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                                </label>
                                <div className="vita-ta-actions" style={{ marginTop: 10 }}>
                                    <button className="vita-btn vita-btn-primary" onClick={record} disabled={!canApprove || busy !== null || selected === 0} title={canApprove ? '' : 'Needs vita.approve'}>
                                        {busy === 'write' ? 'Recording…' : `Record ${num(selected)} known findings`}
                                    </button>
                                    <span className="vita-small vita-muted">Or record none: every failure then blocks the gate.</span>
                                </div>
                            </>
                        )}
                    </div>
                    <aside>
                        <div className="vita-small" style={{ fontWeight: 600 }}>
                            vita-baseline.txt <span className="vita-muted">· written next to vita.yaml on the Vita server</span>
                        </div>
                        <pre className="vita-file">
                            {preview.keys
                                .filter((k) => skills.has(k.split(' | ')[0]))
                                .slice(0, 12)
                                .join('\n') || '(nothing selected)'}
                            {selected > 12 ? `\n… ${selected - 12} more` : ''}
                        </pre>
                        <p className="vita-small vita-muted" style={{ margin: '6px 0 0' }}>
                            Commit the same file to the repo so the team sees it. Vita reads the copy on its server, never the one in a PR, so a PR cannot list its own new
                            failure.
                        </p>
                    </aside>
                </div>
            )}

            {written && (
                <div className="vita-onboard">
                    <div>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                            <strong>{written.count} known findings recorded</strong> in <code>{written.file}</code>. Next: commit the file to the repo, then switch on its PR
                            gate (repository variable <code>VITA_ENABLED=true</code> and the three Vita secrets).
                        </p>
                    </div>
                    <aside>
                        <button
                            className="vita-btn vita-btn-sm"
                            onClick={() =>
                                navigator.clipboard.writeText(written.text).then(
                                    () => toast.success('Copied vita-baseline.txt'),
                                    () => toast.error('Could not copy')
                                )
                            }
                        >
                            <Copy size={12} /> Copy the file
                        </button>
                        <pre className="vita-file">{written.text}</pre>
                    </aside>
                </div>
            )}
        </div>
    );
};

export default OnboardSteps;
