import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaSchedule, VitaScheduleCreate, VitaTarget, VitaTrigger } from '../types';
import { useLoad } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { TRIGGER_LABEL, useVitaAccess } from '../components/testAgent';
import { cronProblems, describeCron, fromNow, istTime, nextCronRun } from '../components/cron';

// Schedules live in Vita (VitaSchedules; vita/runners/scheduler.py fires them). Cron is 5-field and evaluated in IST.
// Everything that changes a schedule needs vita.manage; the CMS API records the signed-in user in Vita's audit log.

/** Prod is read-only: Vita refuses any other trigger on a prod schedule, so the form only offers these. */
const PROD_TRIGGERS: VitaTrigger[] = ['prod-sanity', 'canary'];
const SCHEDULE_TRIGGERS: VitaTrigger[] = ['nightly', 'prod-sanity', 'canary', 'manual'];

type Preset = { key: string; label: string; name: string; cron: string; trigger: VitaTrigger; target: VitaTarget; hint: string };
const PRESETS: Preset[] = [
    { key: 'prod', label: 'Prod sanity 06:00', name: 'prod-sanity', cron: '0 6 * * *', trigger: 'prod-sanity', target: 'prod', hint: 'Read-only sweep of prod: health, golden reads, logins, reconciliation.' },
    { key: 'nightly', label: 'Nightly 02:00', name: 'nightly', cron: '0 2 * * *', trigger: 'nightly', target: 'dev', hint: 'Full nightly run against dev, then the Learner.' },
    { key: 'mutation', label: 'Weekly mutation Sun 03:00', name: 'weekly-mutation', cron: '0 3 * * 0', trigger: 'nightly', target: 'dev', hint: 'Nightly-depth run on Sunday (mutation testing has the weekend budget).' },
    { key: 'digest', label: 'Weekly digest Mon 09:00', name: 'weekly-digest', cron: '0 9 * * 1', trigger: 'digest', target: 'dev', hint: 'Monday 09:00 IST: emails/WhatsApps the weekly digest (no test run).' },
];

const online = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        toast.error('You are offline. Schedule changes are not queued: try again when you are back online.');
        return false;
    }
    return true;
};

const EMPTY_FORM: VitaScheduleCreate = { repo: '', name: '', cron: '', trigger: 'nightly', target: 'dev', enabled: true };

type RepoChoice = { repo: string; targets?: string[] };

const AddScheduleForm: React.FC<{ repos: RepoChoice[]; existing: VitaSchedule[]; defaultRepo: string; onDone: () => void; onCancel: () => void }> = ({
    repos,
    existing,
    defaultRepo,
    onDone,
    onCancel,
}) => {
    const [form, setForm] = React.useState<VitaScheduleCreate>({ ...EMPTY_FORM, repo: defaultRepo || repos[0]?.repo || '' });
    const [saving, setSaving] = React.useState(false);
    const repo = repos.find((r) => r.repo === form.repo);
    const targets = (repo?.targets?.filter((t) => t !== 'pr') ?? ['dev', 'prod']) as VitaTarget[];
    const triggers = form.target === 'prod' ? PROD_TRIGGERS : SCHEDULE_TRIGGERS;
    const problems = form.cron ? cronProblems(form.cron) : [];
    const next = form.cron && problems.length === 0 ? nextCronRun(form.cron) : null;
    const duplicate = existing.some((s) => s.repo === form.repo && s.name === form.name.trim());
    const set = (patch: Partial<VitaScheduleCreate>) =>
        setForm((f) => {
            const n = { ...f, ...patch };
            if (n.target === 'prod' && !PROD_TRIGGERS.includes(n.trigger)) n.trigger = 'prod-sanity';
            return n;
        });
    const preset = (p: Preset) => set({ name: p.name, cron: p.cron, trigger: p.trigger, target: p.target });
    const presetBlocked = (p: Preset) => !!repo?.targets && !repo.targets.includes(p.target);
    const valid = form.repo && form.name.trim() && form.cron && problems.length === 0 && !duplicate && targets.includes(form.target as VitaTarget);

    const save = async () => {
        if (!valid || !online()) return;
        setSaving(true);
        try {
            const res = await vitaApi.createSchedule({ ...form, name: form.name.trim(), cron: form.cron.trim().split(/\s+/).join(' ') });
            toast.success(`Schedule "${form.name.trim()}" added for ${form.repo}`, { description: res.next_run_at ? `Next run ${istTime(res.next_run_at)}` : undefined });
            onDone();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not add the schedule.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>Add a schedule</h3>
            </header>
            <div className="vita-ta-form">
                <div className="vita-ta-presets">
                    <span className="vita-small vita-muted">Presets:</span>
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            className="vita-btn vita-btn-sm"
                            onClick={() => preset(p)}
                            disabled={presetBlocked(p)}
                            title={presetBlocked(p) ? `${form.repo} has no ${p.target} target in its vita.yaml` : p.hint}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="vita-ta-fields">
                    <label>
                        <span>Repo</span>
                        <select className="vita-input" value={form.repo} onChange={(e) => set({ repo: e.target.value })}>
                            {repos.map((r) => (
                                <option key={r.repo} value={r.repo}>
                                    {r.repo}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Name</span>
                        <input className="vita-input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. nightly" maxLength={120} />
                    </label>
                    <label>
                        <span>Cron (IST)</span>
                        <input className="vita-input vita-code" value={form.cron} onChange={(e) => set({ cron: e.target.value })} placeholder="m h dom mon dow, e.g. 0 2 * * *" />
                    </label>
                    <label>
                        <span>Target</span>
                        <select className="vita-input" value={form.target} onChange={(e) => set({ target: e.target.value as VitaTarget })}>
                            {targets.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Trigger</span>
                        <select className="vita-input" value={form.trigger} onChange={(e) => set({ trigger: e.target.value as VitaTrigger })}>
                            {triggers.map((t) => (
                                <option key={t} value={t}>
                                    {TRIGGER_LABEL[t]}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="vita-small">
                    {problems.length > 0 ? (
                        <span className="vita-bad">{problems.join(' · ')}</span>
                    ) : form.cron ? (
                        <>
                            <strong>{describeCron(form.cron)}</strong>
                            {next ? ` · next ${istTime(next.toISOString())} (${fromNow(next)})` : ' · does not fire in the next 5 weeks'}
                        </>
                    ) : (
                        <span className="vita-muted">Pick a preset or type a cron. Times are IST.</span>
                    )}
                    {duplicate && <div className="vita-bad">{form.repo} already has a schedule named "{form.name.trim()}".</div>}
                    {form.target === 'prod' && <div className="vita-muted">Prod is read-only: only Prod sanity and Canary can be scheduled there.</div>}
                </div>
                <div className="vita-ta-actions">
                    <button className="vita-btn vita-btn-primary" onClick={save} disabled={!valid || saving}>
                        <Plus size={14} /> {saving ? 'Adding…' : 'Add schedule'}
                    </button>
                    <button className="vita-btn vita-btn-ghost" onClick={onCancel} disabled={saving}>
                        Cancel
                    </button>
                </div>
            </div>
        </section>
    );
};

type Pending = { id: string; action: 'delete' | 'edit' };

const RepoSchedules: React.FC<{ repo: string; rows: VitaSchedule[]; onChanged: () => void }> = ({ repo, rows, onChanged }) => {
    const navigate = useNavigate();
    const { canManage } = useVitaAccess();
    const [busy, setBusy] = React.useState<string | null>(null);
    const [pending, setPending] = React.useState<Pending | null>(null);
    const [cron, setCron] = React.useState('');
    const cols = canManage ? 8 : 7;
    const editProblems = pending?.action === 'edit' ? cronProblems(cron) : [];

    const run = async (key: string, fn: () => Promise<void>, failure: string) => {
        if (!online()) return;
        setBusy(key);
        try {
            await fn();
        } catch (e) {
            toast.error(vitaApiError(e, failure));
        } finally {
            setBusy(null);
        }
    };

    const toggle = (s: VitaSchedule) =>
        run(
            s.id,
            async () => {
                await vitaApi.updateSchedule(s.id, { enabled: !s.enabled });
                toast.success(`${s.name} ${s.enabled ? 'paused' : 'enabled'} for ${repo}`);
                onChanged();
            },
            'Could not change the schedule.'
        );

    const saveCron = (s: VitaSchedule) =>
        run(
            s.id,
            async () => {
                const res = await vitaApi.updateSchedule(s.id, { cron: cron.trim().split(/\s+/).join(' ') });
                toast.success(`${s.name}: ${describeCron(cron)}`, { description: res.next_run_at ? `Next run ${istTime(res.next_run_at)}` : undefined });
                setPending(null);
                onChanged();
            },
            'Could not change the cron.'
        );

    const runNow = (s: VitaSchedule) =>
        run(
            s.id,
            async () => {
                const res = await vitaApi.runScheduleNow(s.id);
                if (res.status === 'sent') {
                    // a digest schedule: Vita built (and emailed, when recipients are configured) the digest; no run row
                    toast.success(res.digest?.sent === false ? 'Digest built (no recipients configured)' : 'Weekly digest sent', {
                        description: typeof res.digest?.subject === 'string' ? res.digest.subject : undefined,
                    });
                    return;
                }
                if (res.status === 'skipped' || !res.run_id) {
                    toast.warning(`Not started: ${res.reason ?? 'skipped by Vita'}`);
                    return;
                }
                toast.success(`${s.name} queued for ${repo}`, { description: `Run ${res.run_id} - follow it on the Runs tab.` });
                navigate(`/vita/runs?repo=${encodeURIComponent(repo)}&run=${encodeURIComponent(res.run_id)}`);
            },
            'Could not start the run.'
        );

    const remove = (s: VitaSchedule) =>
        run(
            s.id,
            async () => {
                await vitaApi.deleteSchedule(s.id);
                toast.success(`Schedule "${s.name}" deleted`, { description: 'Past runs stay in the Runs tab.' });
                setPending(null);
                onChanged();
            },
            'Could not delete the schedule.'
        );

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <CalendarClock size={15} /> {repo}
                </h3>
                <span className="vita-muted vita-small">
                    {rows.length} schedule{rows.length === 1 ? '' : 's'} · {rows.filter((s) => s.enabled).length} enabled
                </span>
            </header>
            <div className="vita-scroll">
                <table className="vita-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>When</th>
                            <th>Trigger</th>
                            <th>Target</th>
                            <th>Enabled</th>
                            <th>Last run</th>
                            <th>Next run</th>
                            {canManage && <th />}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((s) => {
                            const p = pending && pending.id === s.id ? pending : null;
                            return (
                                <React.Fragment key={s.id}>
                                    <tr className={s.enabled ? '' : 'vita-ta-off'}>
                                        <td className="vita-nowrap">
                                            <strong>{s.name}</strong>
                                            {s.created_by && <div className="vita-small vita-muted">by {s.created_by}</div>}
                                        </td>
                                        <td>
                                            <div>{describeCron(s.cron)}</div>
                                            <div className="vita-small vita-code vita-muted">{s.cron}</div>
                                        </td>
                                        <td className="vita-nowrap">{TRIGGER_LABEL[s.trigger] ?? s.trigger}</td>
                                        <td className="vita-nowrap">{s.target === 'prod' ? <Pill tone="warn">prod</Pill> : s.target}</td>
                                        <td>
                                            <label className="vita-ta-switch" title={canManage ? (s.enabled ? 'Pause this schedule' : 'Enable this schedule') : 'Needs vita.manage'}>
                                                <input type="checkbox" checked={s.enabled} disabled={!canManage || busy === s.id} onChange={() => toggle(s)} />
                                                <span>{s.enabled ? 'On' : 'Off'}</span>
                                            </label>
                                        </td>
                                        <td className="vita-nowrap">{istTime(s.last_run_at)}</td>
                                        <td className="vita-nowrap">{s.enabled ? istTime(s.next_run_at) : '—'}</td>
                                        {canManage && (
                                            <td className="vita-nowrap">
                                                <button className="vita-btn vita-btn-sm" onClick={() => runNow(s)} disabled={busy !== null} title="Queue this schedule's run now">
                                                    <Play size={12} /> Run now
                                                </button>
                                                <button
                                                    className="vita-btn vita-btn-sm vita-btn-ghost"
                                                    onClick={() => {
                                                        setPending({ id: s.id, action: 'edit' });
                                                        setCron(s.cron);
                                                    }}
                                                    disabled={busy !== null}
                                                    title="Change the cron"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    className="vita-btn vita-btn-sm vita-btn-danger"
                                                    onClick={() => setPending({ id: s.id, action: 'delete' })}
                                                    disabled={busy !== null}
                                                    title="Delete this schedule"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                    {p && (
                                        <tr className="vita-detail-row">
                                            <td colSpan={cols}>
                                                <div className="vita-ta-reason">
                                                    {p.action === 'delete' ? (
                                                        <>
                                                            <span className="vita-small">
                                                                Delete <strong>{s.name}</strong> ({describeCron(s.cron)})? Past runs are kept.
                                                            </span>
                                                            <button className="vita-btn vita-btn-sm vita-btn-danger" onClick={() => remove(s)} disabled={busy !== null}>
                                                                {busy === s.id ? 'Deleting…' : 'Delete'}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="vita-small">Cron (IST):</span>
                                                            <input className="vita-input vita-code" value={cron} onChange={(e) => setCron(e.target.value)} autoFocus />
                                                            <span className={`vita-small ${editProblems.length ? 'vita-bad' : ''}`}>
                                                                {editProblems.length ? editProblems.join(' · ') : describeCron(cron)}
                                                            </span>
                                                            <button className="vita-btn vita-btn-sm" onClick={() => saveCron(s)} disabled={busy !== null || editProblems.length > 0 || cron.trim() === s.cron}>
                                                                {busy === s.id ? 'Saving…' : 'Save'}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setPending(null)} disabled={busy !== null}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

const VitaSchedulesPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { canManage } = useVitaAccess();
    const repo = params.get('repo') ?? '';
    const [adding, setAdding] = React.useState(false);

    const { data: schedules, error, loading, reload } = useLoad(() => vitaApi.schedules(), []);
    // Archived repos keep their history but get no new schedules.
    const { data: allRepos } = useLoad(() => vitaApi.settingsRepos(), []);
    const repos = React.useMemo(() => allRepos?.filter((r) => !r.archived) ?? null, [allRepos]);

    const setRepo = (value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set('repo', value);
        else next.delete('repo');
        setParams(next, { replace: true });
    };

    const groups = React.useMemo(() => {
        const by = new Map<string, VitaSchedule[]>();
        for (const s of schedules ?? []) {
            if (repo && s.repo !== repo) continue;
            by.set(s.repo, [...(by.get(s.repo) ?? []), s]);
        }
        for (const rows of by.values()) rows.sort((a, b) => a.name.localeCompare(b.name));
        return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [schedules, repo]);
    const repoNames = React.useMemo(
        () => Array.from(new Set([...(allRepos ?? []).map((r) => r.repo), ...(schedules ?? []).map((s) => s.repo)])).sort(),
        [allRepos, schedules]
    );

    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div className="vita-filters">
                    <select className="vita-input" value={repo} onChange={(e) => setRepo(e.target.value)} title="Repo">
                        <option value="">All repos</option>
                        {repoNames.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                    <span className="vita-muted vita-small">All times IST (Asia/Kolkata)</span>
                </div>
                <div className="vita-ta-actions">
                    {canManage && !adding && (
                        <button className="vita-btn vita-btn-primary" onClick={() => setAdding(true)} disabled={!repos?.length}>
                            <Plus size={14} /> Add schedule
                        </button>
                    )}
                    <button className="vita-btn" onClick={reload} disabled={loading} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {!canManage && (
                <div className="vita-explainer">
                    You can see the schedules but not change them: adding, pausing, editing, deleting and "Run now" need the <strong>vita.manage</strong> permission.
                </div>
            )}

            {adding && repos && (
                <AddScheduleForm
                    repos={repos}
                    existing={schedules ?? []}
                    defaultRepo={repo}
                    onCancel={() => setAdding(false)}
                    onDone={() => {
                        setAdding(false);
                        reload();
                    }}
                />
            )}

            {error && !schedules ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the schedules.')} onRetry={reload} />
            ) : !schedules ? (
                <Empty>Loading schedules…</Empty>
            ) : groups.length === 0 ? (
                <Empty>
                    {repo ? `${repo} has no schedules.` : 'No schedules yet.'} The Vita scheduler adds Prod sanity (06:00) and Nightly (02:00) for every onboarded repo
                    when it starts{canManage ? ', or add one here' : ''}.
                </Empty>
            ) : (
                groups.map(([r, rows]) => <RepoSchedules key={r} repo={r} rows={rows} onChanged={reload} />)
            )}
        </div>
    );
};

export default VitaSchedulesPage;
