import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Pause, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaRepoOverview, VitaTrigger } from '../types';
import { useLoad, when } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { isRunActive, TRIGGER_LABEL, useVitaAccess, useVitaHub, verdictLabel, verdictTone } from '../components/testAgent';

const REFRESH_MS = 30_000;
// The three verdicts shown on every card, in this order.
const HEADLINE_TRIGGERS: VitaTrigger[] = ['pr', 'canary', 'prod-sanity'];

const VerdictBox: React.FC<{ trigger: VitaTrigger; run: VitaRepoOverview['last_runs'][VitaTrigger] }> = ({ trigger, run }) => {
    const tone = verdictTone(run?.verdict, run?.status);
    return (
        <div className={`vita-ta-verdict vita-ta-verdict-${tone}`} title={run ? `Run ${run.run_id}` : 'No run yet'}>
            <div className="vita-ta-verdict-label">{TRIGGER_LABEL[trigger]}</div>
            <div className="vita-ta-verdict-value">{verdictLabel(run?.verdict, run?.status)}</div>
            <div className="vita-ta-verdict-when">{run ? when(run.started_at) : '—'}</div>
        </div>
    );
};

const RepoCard: React.FC<{ r: VitaRepoOverview; onChanged: () => void }> = ({ r, onChanged }) => {
    const navigate = useNavigate();
    const { canManage } = useVitaAccess();
    const [busy, setBusy] = React.useState<'run' | 'gate' | null>(null);
    const running = (r.running ?? 0) + (r.queued ?? 0) > 0 || Object.values(r.last_runs).some((x) => isRunActive(x?.status));

    const runNow = async () => {
        setBusy('run');
        try {
            const res = await vitaApi.enqueueRun({ repo: r.repo, manifest_path: r.manifest_path, trigger: 'manual', target: 'dev' });
            toast.success(`Run queued for ${r.repo}`, { description: `Run ${res.run_id} - follow it on the Runs tab.` });
            onChanged();
            navigate(`/vita/runs?repo=${encodeURIComponent(r.repo)}&run=${encodeURIComponent(res.run_id)}`);
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not start the run.'));
        } finally {
            setBusy(null);
        }
    };

    const toggleGate = async () => {
        setBusy('gate');
        try {
            if (r.gate_paused) {
                await vitaApi.resumeGate(r.repo);
                toast.success(`PR gate resumed for ${r.repo}`);
            } else {
                await vitaApi.pauseGate(r.repo, 'Paused from the CMS');
                toast.warning(`PR gate paused for ${r.repo}`, { description: 'Every PR answers neutral until it is resumed.' });
            }
            onChanged();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not change the gate.'));
        } finally {
            setBusy(null);
        }
    };

    const cases = r.cases ?? {};
    return (
        <section className="vita-card vita-ta-repo">
            <header className="vita-card-head">
                <h3>
                    <GitBranch size={15} /> {r.repo}
                    {r.kind && <span className="vita-muted vita-small">{r.kind}</span>}
                </h3>
                {r.gate_paused ? <Pill tone="warn">Gate paused</Pill> : running ? <Pill tone="warn">Running</Pill> : <Pill tone="good">Gate on</Pill>}
            </header>

            <div className="vita-ta-verdicts">
                {HEADLINE_TRIGGERS.map((t) => (
                    <VerdictBox key={t} trigger={t} run={r.last_runs?.[t] ?? null} />
                ))}
            </div>

            <div className="vita-ta-stats">
                <div className="vita-ta-stat">
                    <strong className={r.open_failures > 0 ? 'vita-bad' : ''}>{r.open_failures ?? 0}</strong>Open bugs
                </div>
                <div className="vita-ta-stat">
                    <strong>{r.flaky_count ?? 0}</strong>Flaky
                </div>
                <div className="vita-ta-stat">
                    <strong>{cases.shadow ?? 0}</strong>Shadow
                </div>
                <div className="vita-ta-stat">
                    <strong>{cases.active ?? 0}</strong>Active
                </div>
                <div className="vita-ta-stat">
                    <strong>{cases.retired ?? 0}</strong>Retired
                </div>
            </div>

            <div className="vita-ta-actions">
                <button className="vita-btn" onClick={() => navigate(`/vita/runs?repo=${encodeURIComponent(r.repo)}`)}>
                    Runs
                </button>
                <button className="vita-btn" onClick={() => navigate(`/vita/cases?repo=${encodeURIComponent(r.repo)}`)}>
                    Cases
                </button>
                {canManage && (
                    <>
                        <button className="vita-btn vita-btn-primary" onClick={runNow} disabled={busy !== null} title="Queue a manual run against dev">
                            <Play size={14} /> {busy === 'run' ? 'Queuing…' : 'Run now'}
                        </button>
                        <button className="vita-btn" onClick={toggleGate} disabled={busy !== null}>
                            {r.gate_paused ? <Play size={14} /> : <Pause size={14} />} {r.gate_paused ? 'Resume gate' : 'Pause gate'}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
};

const VitaOverviewPage: React.FC = () => {
    const { data: o, error, loading, reload } = useLoad(() => vitaApi.overview(), []);

    React.useEffect(() => {
        const id = setInterval(() => document.visibilityState === 'visible' && reload(), REFRESH_MS);
        return () => clearInterval(id);
    }, [reload]);

    // A run finishing anywhere changes the cards.
    useVitaHub((e) => {
        if (e.status === 'done') reload();
    });

    if (error && !o) return <ErrorBox message={vitaApiError(error, 'Could not load the Vita overview.')} onRetry={reload} />;
    if (!o) return <Empty>Loading Vita overview…</Empty>;

    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <span className="vita-muted vita-small">
                    {o.repos.length} repo{o.repos.length === 1 ? '' : 's'} onboarded{o.generated_at ? ` · ${when(o.generated_at)}` : ''}
                </span>
                <button className="vita-btn" onClick={reload} disabled={loading} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>
            {o.repos.length === 0 ? (
                <Empty>No repo is onboarded yet. Add a vita.yaml to a repo and the vita-gate workflow, then it appears here.</Empty>
            ) : (
                <div className="vita-ta-repos">
                    {o.repos.map((r) => (
                        <RepoCard key={r.repo} r={r} onChanged={reload} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default VitaOverviewPage;
