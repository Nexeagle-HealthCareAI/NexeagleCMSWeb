import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import { CASE_STATUSES, type VitaCase, type VitaCaseStatus, type VitaOracleKind } from '../types';
import { shortId, useLoad, when } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { caseTone, useVitaAccess, useVitaHub } from '../components/testAgent';

const ORACLE_LABEL: Record<VitaOracleKind, string> = {
    contract: 'Contract',
    property: 'Property',
    invariant: 'Invariant',
    metamorphic: 'Metamorphic',
    differential: 'Differential',
    golden: 'Golden',
};

type Decision = { id: string; action: 'promote' | 'retire' };

const VitaCasesPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { canApprove } = useVitaAccess();
    const repo = params.get('repo') ?? '';
    const status = (params.get('status') ?? '') as VitaCaseStatus | '';
    const skill = params.get('skill') ?? '';
    const oracle = (params.get('oracle') ?? '') as VitaOracleKind | '';
    const [open, setOpen] = React.useState<string | null>(null);
    const [decision, setDecision] = React.useState<Decision | null>(null);
    const [reason, setReason] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const { data: repos } = useLoad(() => vitaApi.repos(), []);
    React.useEffect(() => {
        if (!repo && repos && repos.length > 0) setParam('repo', repos[0].repo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, repo]);

    // status and skill are server-side filters (Vita's /cases/{repo}?status&skill); the oracle filter is applied here.
    const { data: cases, error, loading, reload } = useLoad(
        () => (repo ? vitaApi.cases(repo, status, skill) : Promise.resolve([] as VitaCase[])),
        [repo, status, skill]
    );

    // A finished run may have generated new shadow cases.
    useVitaHub((e) => {
        if (e.repo === repo && e.status === 'done') reload();
    });

    const skills = React.useMemo(() => Array.from(new Set((cases ?? []).map((c) => c.skill))).sort(), [cases]);
    const rows = (cases ?? []).filter((c) => !oracle || c.oracle?.kind === oracle);
    const counts = React.useMemo(() => {
        const out: Record<string, number> = {};
        for (const c of cases ?? []) out[c.status] = (out[c.status] ?? 0) + 1;
        return out;
    }, [cases]);

    const confirm = async () => {
        if (!decision) return;
        setSaving(true);
        try {
            if (decision.action === 'promote') {
                await vitaApi.promoteCase(decision.id, reason);
                toast.success('Case promoted to active', { description: 'It now counts towards the PR gate.' });
            } else {
                await vitaApi.retireCase(decision.id, reason);
                toast.success('Case retired', { description: 'It will not run again.' });
            }
            setDecision(null);
            setReason('');
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, `Could not ${decision.action} the case.`));
        } finally {
            setSaving(false);
        }
    };

    const colSpan = canApprove ? 9 : 8;

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
                    <select className="vita-input" value={status} onChange={(e) => setParam('status', e.target.value)} title="Status">
                        <option value="">All statuses</option>
                        {CASE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                                {counts[s] != null && !status ? ` (${counts[s]})` : ''}
                            </option>
                        ))}
                    </select>
                    <select className="vita-input" value={skill} onChange={(e) => setParam('skill', e.target.value)} title="Skill pack">
                        <option value="">All skills</option>
                        {skill && !skills.includes(skill) && <option value={skill}>{skill}</option>}
                        {skills.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                    <select className="vita-input" value={oracle} onChange={(e) => setParam('oracle', e.target.value)} title="Oracle">
                        <option value="">All oracles</option>
                        {(Object.keys(ORACLE_LABEL) as VitaOracleKind[]).map((k) => (
                            <option key={k} value={k}>
                                {ORACLE_LABEL[k]}
                            </option>
                        ))}
                    </select>
                </div>
                <button className="vita-btn" onClick={reload} disabled={loading || !repo} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            {!canApprove && repo && (
                <div className="vita-explainer">
                    You can see the cases but not promote or retire them: that needs the <strong>vita.approve</strong> permission.
                </div>
            )}

            {error && !cases ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the cases.')} onRetry={reload} />
            ) : !repo ? (
                <Empty>Select a repo to see its test cases.</Empty>
            ) : !cases ? (
                <Empty>Loading cases…</Empty>
            ) : rows.length === 0 ? (
                <Empty>No cases match these filters.</Empty>
            ) : (
                <div className="vita-scroll">
                    <table className="vita-table vita-table-click">
                        <thead>
                            <tr>
                                <th style={{ width: 28 }} />
                                <th>Title</th>
                                <th>Skill</th>
                                <th>Oracle</th>
                                <th>Status</th>
                                <th>Origin</th>
                                <th>Created</th>
                                <th>Case</th>
                                {canApprove && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((c) => {
                                const isOpen = open === c.id;
                                const d = decision && decision.id === c.id ? decision : null;
                                return (
                                    <React.Fragment key={c.id}>
                                        <tr onClick={() => setOpen(isOpen ? null : c.id)}>
                                            <td className="vita-ta-chevron">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                                            <td className="vita-wrap">{c.title}</td>
                                            <td className="vita-nowrap">{c.skill}</td>
                                            <td className="vita-nowrap">{ORACLE_LABEL[c.oracle?.kind] ?? c.oracle?.kind ?? '—'}</td>
                                            <td>
                                                <Pill tone={caseTone(c.status)}>{c.status}</Pill>
                                            </td>
                                            <td className="vita-nowrap">{c.origin}</td>
                                            <td className="vita-nowrap">{when(c.created_at)}</td>
                                            <td className="vita-code" title={c.id}>
                                                {shortId(c.id)}
                                            </td>
                                            {canApprove && (
                                                <td className="vita-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    {c.status === 'shadow' && (
                                                        <button
                                                            className="vita-btn vita-btn-sm"
                                                            onClick={() => {
                                                                setDecision({ id: c.id, action: 'promote' });
                                                                setReason('');
                                                            }}
                                                            disabled={saving}
                                                            title="Make this case count towards the PR gate"
                                                        >
                                                            <CheckCircle2 size={12} /> Promote
                                                        </button>
                                                    )}
                                                    {c.status !== 'retired' && (
                                                        <button
                                                            className="vita-btn vita-btn-sm vita-btn-danger"
                                                            onClick={() => {
                                                                setDecision({ id: c.id, action: 'retire' });
                                                                setReason('');
                                                            }}
                                                            disabled={saving}
                                                            title="Stop running this case"
                                                        >
                                                            <Archive size={12} /> Retire
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        {d && (
                                            <tr className="vita-detail-row">
                                                <td colSpan={colSpan}>
                                                    <div className="vita-ta-reason">
                                                        <span className="vita-small">
                                                            {d.action === 'promote' ? 'Promote to active' : 'Retire'} <strong>{c.title}</strong> - reason (optional):
                                                        </span>
                                                        <input
                                                            className="vita-input"
                                                            value={reason}
                                                            onChange={(e) => setReason(e.target.value)}
                                                            placeholder={d.action === 'promote' ? 'e.g. Verified against the API spec' : 'e.g. Endpoint removed in v2'}
                                                            autoFocus
                                                        />
                                                        <button className="vita-btn vita-btn-sm" onClick={confirm} disabled={saving}>
                                                            {saving ? 'Saving…' : 'Confirm'}
                                                        </button>
                                                        <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setDecision(null)} disabled={saving}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {isOpen && (
                                            <tr className="vita-detail-row">
                                                <td colSpan={colSpan}>
                                                    <div className="vita-detail">
                                                        <div className="vita-detail-grid">
                                                            <div>
                                                                <div className="vita-detail-label">Spec</div>
                                                                <pre className="vita-ta-report">{JSON.stringify(c.spec ?? {}, null, 2)}</pre>
                                                                <div className="vita-detail-label">Oracle parameters</div>
                                                                <pre className="vita-ta-report">{JSON.stringify(c.oracle?.params ?? {}, null, 2)}</pre>
                                                            </div>
                                                            <dl className="vita-facts">
                                                                <dt>Case id</dt>
                                                                <dd className="vita-code">{c.id}</dd>
                                                                <dt>Repo</dt>
                                                                <dd>{c.repo}</dd>
                                                                <dt>Tags</dt>
                                                                <dd>{c.tags?.length ? c.tags.join(', ') : '—'}</dd>
                                                                <dt>Graph nodes</dt>
                                                                <dd title={c.graph_nodes?.join('\n')}>{c.graph_nodes?.length ?? 0}</dd>
                                                            </dl>
                                                        </div>
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
        </div>
    );
};

export default VitaCasesPage;
