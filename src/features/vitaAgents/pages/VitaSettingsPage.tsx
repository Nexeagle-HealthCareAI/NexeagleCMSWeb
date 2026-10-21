import React from 'react';
import { Archive, CheckCircle2, FolderGit2, KeyRound, Plus, Power, RefreshCw, RotateCw, ScrollText, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { Tone } from '../components/format';
import type {
    VitaAddRepoResponse,
    VitaAuditEntry,
    VitaControls,
    VitaRepoSecrets,
    VitaSecret,
    VitaSettingsRepo,
    VitaValidateResponse,
} from '../types';
import { useLoad } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { useVitaAccess } from '../components/testAgent';
import { istTime } from '../components/cron';

// Settings: onboarded repos, secret rotation metadata, the agent's controls (kill switch, budgets, models) and the audit log.
// Repos and secrets need vita.manage; controls need vita.approve and a reason (the CMS API refuses a PUT without one).
// Secret VALUES never pass through here: they live in GitHub secrets / the VM env, Vita only records names and dates.

const online = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        toast.error('You are offline. Settings changes are not queued: try again when you are back online.');
        return false;
    }
    return true;
};

/** The CMS API joins Vita's manifest problems with "; ". */
const splitProblems = (message: string) => message.split('; ').map((s) => s.trim()).filter(Boolean);

const statusPill = (r: VitaSettingsRepo) =>
    r.archived ? <Pill tone="neutral">Archived</Pill> : r.gate_paused ? <Pill tone="warn">Gate paused</Pill> : <Pill tone="good">Gate on</Pill>;

// ---------------------------------------------------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------------------------------------------------

const AddRepoPanel: React.FC<{ onDone: () => void; onCancel: () => void }> = ({ onDone, onCancel }) => {
    const [path, setPath] = React.useState('');
    const [root, setRoot] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [problems, setProblems] = React.useState<string[] | null>(null);
    const [added, setAdded] = React.useState<VitaAddRepoResponse | null>(null);

    const submit = async () => {
        if (!path.trim() || !online()) return;
        setSaving(true);
        setProblems(null);
        setAdded(null);
        try {
            const res = await vitaApi.addRepo({ manifest_path: path.trim(), source_root: root.trim() || undefined });
            setAdded(res);
            toast.success(res.created ? `${res.repo} onboarded` : `${res.repo} refreshed`, {
                description: res.discovery_error ? 'Discovery failed; see the panel.' : 'Knowledge graph discovered.',
            });
            onDone();
        } catch (e) {
            const msg = vitaApiError(e, 'Could not add the repo.');
            setProblems(splitProblems(msg));
        } finally {
            setSaving(false);
        }
    };

    const counts = added ? Object.entries(added.graph).filter(([, n]) => n > 0) : [];
    return (
        <div className="vita-ta-panel">
            <div className="vita-ta-fields">
                <label className="vita-ta-wide">
                    <span>Manifest path on the Vita server</span>
                    <input
                        className="vita-input vita-code"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/opt/vita/src/1RADAPI/vita.yaml (or the repo folder)"
                        autoFocus
                    />
                </label>
                <label className="vita-ta-wide">
                    <span>Repo checkout (optional)</span>
                    <input
                        className="vita-input vita-code"
                        value={root}
                        onChange={(e) => setRoot(e.target.value)}
                        placeholder="Only when vita.yaml is not at the repo root"
                    />
                </label>
            </div>
            {problems && (
                <div className="vita-error vita-ta-problems">
                    <div>
                        <strong>The manifest was not accepted:</strong>
                        <ul>
                            {problems.map((p) => (
                                <li key={p}>{p}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            {added && (
                <div className="vita-explainer">
                    <strong>{added.repo}</strong> ({added.kind}) {added.created ? 'onboarded' : 'updated'} · skills {added.skills.join(', ')} · targets{' '}
                    {added.targets.join(', ') || '—'}
                    {added.discovery_error ? (
                        <div className="vita-bad vita-small">Discovery failed: {added.discovery_error}. Run `vita discover` on the server.</div>
                    ) : (
                        <div className="vita-ta-perms">
                            {counts.length === 0 ? (
                                <span className="vita-small vita-muted">The graph is empty (no discoverer for this kind, or the checkout is not on the server).</span>
                            ) : (
                                counts.map(([k, n]) => (
                                    <Pill key={k} tone="neutral">
                                        {k} {n}
                                    </Pill>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className="vita-ta-actions">
                <button className="vita-btn vita-btn-primary" onClick={submit} disabled={saving || !path.trim()}>
                    <Plus size={14} /> {saving ? 'Validating and discovering…' : 'Add repo'}
                </button>
                <button className="vita-btn vita-btn-ghost" onClick={onCancel} disabled={saving}>
                    {added ? 'Close' : 'Cancel'}
                </button>
            </div>
        </div>
    );
};

const ReposSection: React.FC<{ repos: VitaSettingsRepo[] | null; error: unknown; loading: boolean; reload: () => void }> = ({ repos, error, loading, reload }) => {
    const { canManage } = useVitaAccess();
    const [adding, setAdding] = React.useState(false);
    const [busy, setBusy] = React.useState<string | null>(null);
    const [archiving, setArchiving] = React.useState<string | null>(null);
    const [reason, setReason] = React.useState('');
    const [checks, setChecks] = React.useState<Record<string, VitaValidateResponse>>({});
    const cols = canManage ? 7 : 6;

    const validate = async (repo: string) => {
        setBusy(repo);
        try {
            const res = await vitaApi.validateRepo(repo);
            setChecks((c) => ({ ...c, [repo]: res }));
            if (res.ok) toast.success(`${repo}: manifest is valid`, { description: res.changed_since_onboarding ? 'It changed since onboarding: add the repo again to apply it.' : undefined });
            else toast.error(`${repo}: ${res.problems.length} manifest problem(s)`);
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not validate the manifest.'));
        } finally {
            setBusy(null);
        }
    };

    const archive = async (repo: string) => {
        if (!online()) return;
        setBusy(repo);
        try {
            const res = await vitaApi.archiveRepo(repo, reason.trim());
            toast.success(`${repo} archived`, {
                description: `History kept${res.schedules_disabled.length ? `, ${res.schedules_disabled.length} schedule(s) disabled` : ''}. Add it again to bring it back.`,
            });
            setArchiving(null);
            setReason('');
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not archive the repo.'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <FolderGit2 size={15} /> Repos
                </h3>
                <div className="vita-ta-actions">
                    {canManage && !adding && (
                        <button className="vita-btn vita-btn-sm" onClick={() => setAdding(true)}>
                            <Plus size={12} /> Add repo
                        </button>
                    )}
                    <button className="vita-btn vita-btn-sm" onClick={reload} disabled={loading} title="Refresh">
                        <RefreshCw size={12} className={loading ? 'vita-spin' : ''} />
                    </button>
                </div>
            </header>
            {adding && <AddRepoPanel onDone={reload} onCancel={() => setAdding(false)} />}
            {error && !repos ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the repos.')} onRetry={reload} />
            ) : !repos ? (
                <Empty>Loading repos…</Empty>
            ) : repos.length === 0 ? (
                <Empty>No repo is onboarded yet{canManage ? ': use "Add repo" with the path of its vita.yaml on the Vita server.' : '.'}</Empty>
            ) : (
                <div className="vita-scroll">
                    <table className="vita-table">
                        <thead>
                            <tr>
                                <th>Repo</th>
                                <th>Kind</th>
                                <th>Skills</th>
                                <th>Targets</th>
                                <th>State</th>
                                <th>Manifest</th>
                                {canManage && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {repos.map((r) => {
                                const check = checks[r.repo];
                                return (
                                    <React.Fragment key={r.repo}>
                                        <tr className={r.archived ? 'vita-ta-off' : ''}>
                                            <td className="vita-nowrap">
                                                <strong>{r.repo}</strong>
                                                <div className="vita-small vita-muted">
                                                    {r.app} · {r.schedules} schedule{r.schedules === 1 ? '' : 's'}
                                                </div>
                                            </td>
                                            <td className="vita-nowrap">{r.kind}</td>
                                            <td className="vita-wrap vita-small">{r.skills.join(', ')}</td>
                                            <td className="vita-nowrap">{r.targets.join(', ') || '—'}</td>
                                            <td>{statusPill(r)}</td>
                                            <td className="vita-code vita-small vita-wrap" title={r.manifest_path}>
                                                {r.manifest_path}
                                                {check && (check.ok ? <div className="vita-good">valid{check.changed_since_onboarding ? ' · changed since onboarding' : ''}</div> : null)}
                                            </td>
                                            {canManage && (
                                                <td className="vita-nowrap">
                                                    <button className="vita-btn vita-btn-sm" onClick={() => validate(r.repo)} disabled={busy !== null} title="Re-validate the stored manifest path">
                                                        <CheckCircle2 size={12} /> {busy === r.repo && archiving !== r.repo ? 'Checking…' : 'Validate'}
                                                    </button>
                                                    {!r.archived && (
                                                        <button
                                                            className="vita-btn vita-btn-sm vita-btn-danger"
                                                            onClick={() => {
                                                                setArchiving(r.repo);
                                                                setReason('');
                                                            }}
                                                            disabled={busy !== null}
                                                            title="Stop testing this repo (history is kept)"
                                                        >
                                                            <Archive size={12} /> Archive
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        {check && !check.ok && (
                                            <tr className="vita-detail-row">
                                                <td colSpan={cols}>
                                                    <div className="vita-error vita-ta-problems">
                                                        <ul>
                                                            {check.problems.map((p) => (
                                                                <li key={p}>{p}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {archiving === r.repo && (
                                            <tr className="vita-detail-row">
                                                <td colSpan={cols}>
                                                    <div className="vita-ta-reason">
                                                        <span className="vita-small">
                                                            Archive <strong>{r.repo}</strong>? Runs, cases and the audit log are kept; its schedules are disabled. Reason:
                                                        </span>
                                                        <input className="vita-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repo retired" autoFocus />
                                                        <button className="vita-btn vita-btn-sm vita-btn-danger" onClick={() => archive(r.repo)} disabled={busy !== null}>
                                                            {busy === r.repo ? 'Archiving…' : 'Archive'}
                                                        </button>
                                                        <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setArchiving(null)} disabled={busy !== null}>
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
            )}
        </section>
    );
};

// ---------------------------------------------------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------------------------------------------------

const levelTone = (s: VitaSecret): Tone => (s.level === 'red' ? 'bad' : s.level === 'amber' ? 'warn' : 'good');

const secretBadge = (s: VitaSecret) => {
    if (s.flags.includes('expired')) return 'Expired';
    if (s.flags.includes('expiring_soon')) return `Expires in ${s.days_to_expiry} d`;
    if (s.flags.includes('rotation_overdue')) return `${s.age_days} d old`;
    if (s.flags.includes('never_recorded')) return 'No rotation recorded';
    return 'OK';
};

const SecretsSection: React.FC<{ repos: VitaSettingsRepo[] }> = ({ repos }) => {
    const { canManage } = useVitaAccess();
    const active = repos.filter((r) => !r.archived);
    const [picked, setRepo] = React.useState('');
    const repo = picked || active[0]?.repo || '';
    const [rotating, setRotating] = React.useState<string | null>(null); // secret name, or '' for a new one
    const [newName, setNewName] = React.useState('');
    const [expires, setExpires] = React.useState('');
    const [note, setNote] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const { data, error, loading, reload } = useLoad(
        () => (repo ? vitaApi.secrets(repo) : Promise.resolve(null as VitaRepoSecrets | null)),
        [repo]
    );
    const cols = canManage ? 7 : 6;
    const red = (data?.secrets ?? []).filter((s) => s.level === 'red').length;

    const open = (name: string | null, s?: VitaSecret) => {
        setRotating(name);
        setNewName('');
        setExpires(s?.expires_at ? s.expires_at.slice(0, 10) : '');
        setNote('');
    };

    const save = async () => {
        const name = rotating === '' ? newName.trim() : rotating;
        if (!name || !online()) return;
        setSaving(true);
        try {
            await vitaApi.markSecretRotated(repo, name, { expires_at: expires || null, note: note.trim() });
            toast.success(`${name} marked as rotated`, { description: 'Only the date and your name are recorded, never the value.' });
            setRotating(null);
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not record the rotation.'));
        } finally {
            setSaving(false);
        }
    };

    const form = (
        <div className="vita-ta-reason">
            {rotating === '' && (
                <input className="vita-input vita-code vita-ta-short" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="SECRET_NAME" autoFocus />
            )}
            <span className="vita-small">Rotated today. Expires (optional):</span>
            <input className="vita-input vita-ta-short" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            <input className="vita-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. where it was changed (no values)" />
            <button className="vita-btn vita-btn-sm" onClick={save} disabled={saving || (rotating === '' && !/^[A-Za-z0-9_.-]+$/.test(newName.trim()))}>
                {saving ? 'Saving…' : 'Mark rotated'}
            </button>
            <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setRotating(null)} disabled={saving}>
                Cancel
            </button>
        </div>
    );

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <KeyRound size={15} /> Secrets {red > 0 && <Pill tone="bad">{red} need attention</Pill>}
                </h3>
                <div className="vita-ta-actions">
                    <select className="vita-input" value={repo} onChange={(e) => setRepo(e.target.value)} title="Repo">
                        {active.map((r) => (
                            <option key={r.repo} value={r.repo}>
                                {r.repo}
                            </option>
                        ))}
                    </select>
                    {canManage && repo && rotating === null && (
                        <button className="vita-btn vita-btn-sm" onClick={() => open('')} title="Track a secret the manifest does not list (e.g. a deploy PAT)">
                            <Plus size={12} /> Track another
                        </button>
                    )}
                </div>
            </header>
            <div className="vita-explainer">
                Names come from the repo's <code>secrets:</code> list in vita.yaml. Red: last rotated more than {data?.rotate_after_days ?? 90} days ago, or expiring within{' '}
                {data?.expiry_warn_days ?? 30} days. Change the value in GitHub / the VM env first, then mark it rotated here.
            </div>
            {rotating === '' && form}
            {!repo ? (
                <Empty>No active repo.</Empty>
            ) : error && !data ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the secrets.')} onRetry={reload} />
            ) : !data ? (
                <Empty>{loading ? 'Loading secrets…' : 'No data.'}</Empty>
            ) : data.secrets.length === 0 ? (
                <Empty>{repo}'s vita.yaml declares no secrets.</Empty>
            ) : (
                <div className="vita-scroll">
                    <table className="vita-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Last rotated</th>
                                <th>By</th>
                                <th>Expires</th>
                                <th>On Vita server</th>
                                {canManage && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {data.secrets.map((s) => (
                                <React.Fragment key={s.name}>
                                    <tr>
                                        <td className="vita-code vita-nowrap">
                                            {s.name}
                                            {!s.declared && <div className="vita-small vita-muted">tracked by hand</div>}
                                        </td>
                                        <td>
                                            <Pill tone={levelTone(s)}>{secretBadge(s)}</Pill>
                                        </td>
                                        <td className="vita-nowrap">
                                            {s.last_rotated_at ? (
                                                <>
                                                    {istTime(s.last_rotated_at)}
                                                    <div className="vita-small vita-muted">{s.age_days} d ago</div>
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="vita-nowrap">{s.rotated_by ?? '—'}</td>
                                        <td className="vita-nowrap">
                                            {s.expires_at ? (
                                                <>
                                                    {s.expires_at.slice(0, 10)}
                                                    <div className={`vita-small ${s.days_to_expiry != null && s.days_to_expiry < 30 ? 'vita-bad' : 'vita-muted'}`}>
                                                        {s.days_to_expiry != null && s.days_to_expiry < 0 ? 'expired' : `${s.days_to_expiry} d left`}
                                                    </div>
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>{s.present ? <Pill tone="good">set</Pill> : <Pill tone="neutral">not set</Pill>}</td>
                                        {canManage && (
                                            <td className="vita-nowrap">
                                                <button className="vita-btn vita-btn-sm" onClick={() => open(s.name, s)} disabled={rotating !== null}>
                                                    <RotateCw size={12} /> Mark rotated
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                    {rotating === s.name && (
                                        <tr className="vita-detail-row">
                                            <td colSpan={cols}>{form}</td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

// ---------------------------------------------------------------------------------------------------------------------
// Controls (kill switch, monthly cap, budgets, model router) - vita.approve + reason
// ---------------------------------------------------------------------------------------------------------------------

type Draft = { cap: string; budgets: Record<string, { pr_tokens_inr: string; pr_minutes: string }>; models: VitaControls['models'] };

const toDraft = (c: VitaControls, repos: VitaSettingsRepo[]): Draft => {
    const budgets: Draft['budgets'] = {};
    for (const r of repos.filter((x) => !x.archived)) {
        const b = c.budgets?.[r.repo] ?? { pr_tokens_inr: r.budgets.pr_tokens_inr ?? 50, pr_minutes: r.budgets.pr_minutes ?? 8 };
        budgets[r.repo] = { pr_tokens_inr: String(b.pr_tokens_inr), pr_minutes: String(b.pr_minutes) };
    }
    for (const [repo, b] of Object.entries(c.budgets ?? {})) {
        if (!budgets[repo]) budgets[repo] = { pr_tokens_inr: String(b.pr_tokens_inr), pr_minutes: String(b.pr_minutes) };
    }
    return { cap: c.monthly_inr_cap == null ? '' : String(c.monthly_inr_cap), budgets, models: { ...c.models } };
};

const positive = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0;

const ControlsSection: React.FC<{ repos: VitaSettingsRepo[] }> = ({ repos }) => {
    const { canApprove } = useVitaAccess();
    const { data: controls, error, loading, reload } = useLoad(() => vitaApi.controls(), []);
    // Unsaved edits; null = show what Vita has (re-derived after every reload).
    const [edits, setDraft] = React.useState<Draft | null>(null);
    const base = React.useMemo(() => (controls ? toDraft(controls, repos) : null), [controls, repos]);
    const draft = edits ?? base;
    const [reason, setReason] = React.useState('');
    const [killReason, setKillReason] = React.useState('');
    const [confirmKill, setConfirmKill] = React.useState(false);
    const [saving, setSaving] = React.useState<'kill' | 'save' | null>(null);

    const kill = controls?.kill_switch;
    const changed = React.useMemo(() => {
        if (!base || !draft) return null;
        const out: { cap?: boolean; budgets?: boolean; models?: boolean } = {};
        if (draft.cap !== base.cap) out.cap = true;
        if (JSON.stringify(draft.budgets) !== JSON.stringify(base.budgets)) out.budgets = true;
        if (JSON.stringify(draft.models) !== JSON.stringify(base.models)) out.models = true;
        return out;
    }, [base, draft]);
    const dirty = !!changed && Object.keys(changed).length > 0;
    const invalid =
        !!draft &&
        ((draft.cap !== '' && !positive(draft.cap)) ||
            Object.values(draft.budgets).some((b) => !positive(b.pr_tokens_inr) || !positive(b.pr_minutes)) ||
            Object.values(draft.models).some((m) => !m || !m.trim()));

    const flipKill = async () => {
        if (!kill || !killReason.trim() || !online()) return;
        setSaving('kill');
        try {
            await vitaApi.updateControls({ reason: killReason.trim(), kill_switch: { on: !kill.on, reason: killReason.trim() } });
            if (kill.on) toast.success('Kill switch off', { description: 'Vita takes runs again.' });
            else toast.warning('Kill switch ON', { description: 'Vita stops starting runs and model calls until it is turned off.' });
            setConfirmKill(false);
            setKillReason('');
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not change the kill switch.'));
        } finally {
            setSaving(null);
        }
    };

    const save = async () => {
        if (!draft || !changed || !reason.trim() || invalid || !online()) return;
        setSaving('save');
        try {
            await vitaApi.updateControls({
                reason: reason.trim(),
                ...(changed.cap ? { monthly_inr_cap: draft.cap === '' ? null : Number(draft.cap) } : {}),
                ...(changed.budgets
                    ? {
                          budgets: Object.fromEntries(
                              Object.entries(draft.budgets).map(([r, b]) => [r, { pr_tokens_inr: Number(b.pr_tokens_inr), pr_minutes: Math.round(Number(b.pr_minutes)) }])
                          ),
                      }
                    : {}),
                ...(changed.models ? { models: { plan: draft.models.plan.trim(), judge: draft.models.judge.trim(), classify: draft.models.classify.trim() } } : {}),
            });
            toast.success('Controls saved', { description: 'Recorded in the audit log with your reason.' });
            setReason('');
            setDraft(null);
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not save the controls.'));
        } finally {
            setSaving(null);
        }
    };

    const setBudget = (repo: string, key: 'pr_tokens_inr' | 'pr_minutes', value: string) =>
        setDraft((d) => {
            const cur = d ?? base;
            return cur ? { ...cur, budgets: { ...cur.budgets, [repo]: { ...cur.budgets[repo], [key]: value } } } : cur;
        });

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <SlidersHorizontal size={15} /> Controls
                </h3>
                <button className="vita-btn vita-btn-sm" onClick={reload} disabled={loading} title="Refresh">
                    <RefreshCw size={12} className={loading ? 'vita-spin' : ''} />
                </button>
            </header>
            {!canApprove && (
                <div className="vita-explainer">
                    Changing the kill switch, budgets or models needs the <strong>vita.approve</strong> permission and a reason.
                </div>
            )}
            {error && !controls ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the controls.')} onRetry={reload} />
            ) : !controls || !draft ? (
                <Empty>Loading controls…</Empty>
            ) : (
                <div className="vita-stack">
                    <div className={`vita-ta-kill ${kill?.on ? 'vita-ta-kill-on' : ''}`}>
                        <div>
                            <div className="vita-ta-kill-title">
                                <ShieldAlert size={16} /> Kill switch {kill?.on ? <Pill tone="bad">ON</Pill> : <Pill tone="good">off</Pill>}
                            </div>
                            <div className="vita-small vita-muted">
                                {kill?.on
                                    ? `Turned on${kill.actor ? ` by ${kill.actor}` : ''}${kill.at ? ` · ${istTime(kill.at)}` : ''}${kill.reason ? ` - "${kill.reason}"` : ''}`
                                    : 'When on, Vita starts no runs and makes no model calls (PR gate answers neutral).'}
                            </div>
                        </div>
                        {canApprove && !confirmKill && (
                            <button className={`vita-btn ${kill?.on ? '' : 'vita-btn-danger'}`} onClick={() => setConfirmKill(true)}>
                                <Power size={14} /> {kill?.on ? 'Turn off' : 'Turn on'}
                            </button>
                        )}
                    </div>
                    {canApprove && confirmKill && (
                        <div className="vita-ta-reason">
                            <span className="vita-small">
                                {kill?.on ? 'Turn the kill switch off' : <strong>Stop Vita now</strong>} - reason (required):
                            </span>
                            <input
                                className="vita-input"
                                value={killReason}
                                onChange={(e) => setKillReason(e.target.value)}
                                placeholder={kill?.on ? 'e.g. Groq bill reviewed, resuming' : 'e.g. Runaway token spend on 1HMSAPI'}
                                autoFocus
                            />
                            <button className={`vita-btn vita-btn-sm ${kill?.on ? '' : 'vita-btn-danger'}`} onClick={flipKill} disabled={!killReason.trim() || saving !== null}>
                                {saving === 'kill' ? 'Saving…' : kill?.on ? 'Confirm: turn off' : 'Confirm: turn on'}
                            </button>
                            <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setConfirmKill(false)} disabled={saving !== null}>
                                Cancel
                            </button>
                        </div>
                    )}

                    <div className="vita-ta-fields">
                        <label>
                            <span>Monthly model spend cap (₹)</span>
                            <input
                                className="vita-input"
                                inputMode="decimal"
                                value={draft.cap}
                                onChange={(e) => setDraft({ ...draft, cap: e.target.value })}
                                disabled={!canApprove}
                                placeholder="No cap"
                            />
                        </label>
                        {(['plan', 'judge', 'classify'] as const).map((k) => (
                            <label key={k}>
                                <span>Model: {k}</span>
                                <input
                                    className="vita-input vita-code"
                                    value={draft.models[k] ?? ''}
                                    onChange={(e) => setDraft({ ...draft, models: { ...draft.models, [k]: e.target.value } })}
                                    disabled={!canApprove}
                                />
                            </label>
                        ))}
                    </div>

                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Repo</th>
                                    <th>PR budget (₹ of tokens)</th>
                                    <th>PR budget (minutes)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(draft.budgets).map(([repo, b]) => (
                                    <tr key={repo}>
                                        <td className="vita-nowrap">{repo}</td>
                                        <td>
                                            <input
                                                className={`vita-input vita-ta-short ${positive(b.pr_tokens_inr) ? '' : 'vita-ta-invalid'}`}
                                                inputMode="decimal"
                                                value={b.pr_tokens_inr}
                                                onChange={(e) => setBudget(repo, 'pr_tokens_inr', e.target.value)}
                                                disabled={!canApprove}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                className={`vita-input vita-ta-short ${positive(b.pr_minutes) ? '' : 'vita-ta-invalid'}`}
                                                inputMode="numeric"
                                                value={b.pr_minutes}
                                                onChange={(e) => setBudget(repo, 'pr_minutes', e.target.value)}
                                                disabled={!canApprove}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {canApprove && (
                        <div className="vita-ta-reason">
                            <span className="vita-small">{dirty ? `Changed: ${Object.keys(changed ?? {}).join(', ')}. Reason (required):` : 'No changes.'}</span>
                            <input className="vita-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Raise 1HMSAPI budget for the v3 migration PRs" disabled={!dirty} />
                            <button className="vita-btn vita-btn-sm" onClick={save} disabled={!dirty || invalid || !reason.trim() || saving !== null}>
                                {saving === 'save' ? 'Saving…' : 'Save controls'}
                            </button>
                            <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setDraft(null)} disabled={!dirty || saving !== null}>
                                Discard
                            </button>
                            {invalid && <span className="vita-small vita-bad">Budgets and the cap must be positive numbers; model names cannot be empty.</span>}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

// ---------------------------------------------------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------------------------------------------------

const actionTone = (a: string): Tone =>
    /archived|delete|retire|kill/.test(a) ? 'bad' : /pause|disable|rotated/.test(a) ? 'warn' : /promote|add|create|active|apply/.test(a) ? 'good' : 'neutral';

const AuditSection: React.FC<{ repos: VitaSettingsRepo[] }> = ({ repos }) => {
    const [repo, setRepo] = React.useState('');
    const { data, error, loading, reload } = useLoad(() => vitaApi.audit(repo || undefined, 100), [repo]);
    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <ScrollText size={15} /> Audit log
                </h3>
                <div className="vita-ta-actions">
                    <select className="vita-input" value={repo} onChange={(e) => setRepo(e.target.value)} title="Repo">
                        <option value="">All repos</option>
                        {repos.map((r) => (
                            <option key={r.repo} value={r.repo}>
                                {r.repo}
                            </option>
                        ))}
                    </select>
                    <button className="vita-btn vita-btn-sm" onClick={reload} disabled={loading} title="Refresh">
                        <RefreshCw size={12} className={loading ? 'vita-spin' : ''} />
                    </button>
                </div>
            </header>
            {error && !data ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the audit log.')} onRetry={reload} />
            ) : !data ? (
                <Empty>Loading audit log…</Empty>
            ) : data.length === 0 ? (
                <Empty>No changes recorded{repo ? ` for ${repo}` : ''}.</Empty>
            ) : (
                <div className="vita-scroll vita-ta-audit">
                    <table className="vita-table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Who</th>
                                <th>Action</th>
                                <th>Subject</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((a: VitaAuditEntry) => (
                                <tr key={a.id} title={JSON.stringify(a.detail, null, 2)}>
                                    <td className="vita-nowrap">{istTime(a.at)}</td>
                                    <td className="vita-nowrap">{a.actor}</td>
                                    <td className="vita-nowrap">
                                        <Pill tone={actionTone(a.action)}>{a.action}</Pill>
                                    </td>
                                    <td className="vita-code vita-small vita-wrap">{a.subject}</td>
                                    <td className="vita-wrap">{a.reason || <span className="vita-muted">—</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data && data.length >= 100 && <div className="vita-small vita-muted">Showing the last 100 changes.</div>}
        </section>
    );
};

const VitaSettingsPage: React.FC = () => {
    const { data: repos, error, loading, reload } = useLoad(() => vitaApi.settingsRepos(), []);
    return (
        <div className="vita-stack">
            <ReposSection repos={repos} error={error} loading={loading} reload={reload} />
            {repos && (
                <>
                    <SecretsSection repos={repos} />
                    <ControlsSection repos={repos} />
                    <AuditSection repos={repos} />
                </>
            )}
        </div>
    );
};

export default VitaSettingsPage;
