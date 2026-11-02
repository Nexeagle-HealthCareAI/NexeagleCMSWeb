import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaCoverage, VitaDroppedCase, VitaGenerateResponse } from '../types';
import { useLoad } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import { useVitaAccess, useVitaHub } from '../components/testAgent';
import VitaEscapesPanel from '../components/VitaEscapesPanel';

// Node types shown as tiles, in this order; anything else the graph has is appended.
const TILE_ORDER = ['endpoint', 'table', 'permission', 'handler', 'migration', 'ui_route', 'service'];
const BULK_LIMIT = 20;

const pct = (c: number, t: number) => (t ? Math.round((100 * c) / t) : 0);

/** The last generation's outcome: counts, plus the dropped proposals and why, behind an expander. */
const GenerationResult: React.FC<{ res: VitaGenerateResponse; repo: string; onClose: () => void }> = ({ res, repo, onClose }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="vita-explainer vita-ta-genresult">
            <div className="vita-ta-actions">
                <strong>
                    {res.generated} case(s) generated, {res.stored} stored as shadow
                </strong>
                <Pill tone={res.source === 'model' ? 'good' : res.source === 'fallback' ? 'warn' : 'neutral'}>
                    {res.source === 'model' ? 'model' : res.source === 'fallback' ? 'templates (no model)' : 'nothing to do'}
                </Pill>
                {res.generated > 0 && <Link to={`/vita/cases?repo=${encodeURIComponent(repo)}&status=shadow`}>Review in Cases</Link>}
                {res.dropped.length > 0 && (
                    <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setOpen(!open)}>
                        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {res.dropped.length} dropped
                    </button>
                )}
                <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={onClose}>
                    Dismiss
                </button>
            </div>
            {res.note && <div className="vita-small">{res.note}</div>}
            {open && (
                <ul className="vita-ta-dropped">
                    {res.dropped.map((d: VitaDroppedCase, i) => (
                        <li key={`${d.title}-${i}`}>
                            <strong>{d.title}</strong>: {d.reasons.join('; ')}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const VitaCoveragePage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { canManage } = useVitaAccess();
    const repo = params.get('repo') ?? '';
    const [busy, setBusy] = React.useState<string | null>(null);   // node id, or 'bulk'
    const [last, setLast] = React.useState<VitaGenerateResponse | null>(null);

    const setRepo = (value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set('repo', value);
        else next.delete('repo');
        setParams(next, { replace: true });
        setLast(null);
    };

    const { data: repos } = useLoad(() => vitaApi.repos(), []);
    React.useEffect(() => {
        if (!repo && repos && repos.length > 0) setRepo(repos[0].repo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, repo]);

    const { data: cov, error, loading, reload } = useLoad(
        () => (repo ? vitaApi.coverage(repo) : Promise.resolve(null as VitaCoverage | null)),
        [repo]
    );

    // A finished run may have discovered (seeded) new cases.
    useVitaHub((e) => {
        if (e.repo === repo && e.status === 'done') reload();
    });

    const generate = async (targets: string[] | undefined, key: string) => {
        setBusy(key);
        try {
            const res = await vitaApi.generate(repo, { targets, max_cases: targets && targets.length === 1 ? 8 : BULK_LIMIT });
            setLast(res);
            if (res.generated > 0) {
                toast.success(`${res.generated} shadow case(s) generated`, {
                    description: res.dropped.length ? `${res.dropped.length} proposal(s) dropped by validation.` : 'Review and promote them on the Cases tab.',
                });
            } else if (res.dropped.length) {
                toast.warning('No case survived validation', { description: res.dropped[0].reasons.join('; ') });
            } else {
                toast.info('Nothing new to generate', { description: res.note || 'Existing cases already cover these targets.' });
            }
            reload();
        } catch (e) {
            toast.error(vitaApiError(e, 'Could not generate cases.'));
        } finally {
            setBusy(null);
        }
    };

    const tiles = React.useMemo(() => {
        const keys = Object.keys(cov?.nodes ?? {});
        return [...TILE_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !TILE_ORDER.includes(k)).sort()];
    }, [cov]);

    const bulkTargets = React.useMemo(
        () => [...(cov?.uncovered_endpoints ?? []).map((e) => e.id), ...(cov?.uncovered_tables ?? []).map((t) => t.id)].slice(0, BULK_LIMIT),
        [cov]
    );

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
                            onClick={() => generate(bulkTargets.length ? bulkTargets : undefined, 'bulk')}
                            disabled={!!busy || !repo || !cov?.graph_built}
                            title="Ask the Case Generator for cases on the uncovered endpoints and tables (up to 20 targets)"
                        >
                            <Sparkles size={14} className={busy === 'bulk' ? 'vita-spin' : ''} /> {busy === 'bulk' ? 'Generating…' : 'Generate for all gaps'}
                        </button>
                    )}
                    <button className="vita-btn" onClick={reload} disabled={loading || !repo} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {!canManage && repo && (
                <div className="vita-explainer">
                    You can see the gaps but not generate cases: that needs the <strong>vita.manage</strong> permission.
                </div>
            )}

            {last && <GenerationResult res={last} repo={repo} onClose={() => setLast(null)} />}

            {error && !cov ? (
                <ErrorBox message={vitaApiError(error, 'Could not load coverage.')} onRetry={reload} />
            ) : !repo ? (
                <Empty>Select a repo to see what its test cases do not cover.</Empty>
            ) : !cov ? (
                <Empty>Loading coverage…</Empty>
            ) : !cov.graph_built ? (
                <Empty>No knowledge graph for {repo} yet: start a run (or `vita discover`) to build it.</Empty>
            ) : (
                <>
                    <div className="vita-ta-stats vita-ta-cov-tiles">
                        {tiles.map((k) => {
                            const n = cov.nodes[k];
                            return (
                                <div key={k} className="vita-ta-stat" title={`${n.covered} of ${n.total} covered`}>
                                    <strong className={n.uncovered > 0 && (k === 'endpoint' || k === 'table') ? 'vita-bad' : ''}>
                                        {pct(n.covered, n.total)}%
                                    </strong>
                                    {k.replace('_', ' ')}s · {n.covered}/{n.total}
                                    <div className="vita-ta-covbar">
                                        <span style={{ width: `${pct(n.covered, n.total)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        <div className="vita-ta-stat">
                            <strong>{cov.cases_total}</strong>
                            cases
                        </div>
                    </div>

                    <section className="vita-card">
                        <header className="vita-card-head">
                            <h3>Uncovered endpoints ({cov.uncovered_endpoints.length})</h3>
                        </header>
                        {cov.uncovered_endpoints.length === 0 ? (
                            <Empty>Every endpoint has at least one case.</Empty>
                        ) : (
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th>Route</th>
                                            <th>Auth</th>
                                            <th>Permissions</th>
                                            {canManage && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cov.uncovered_endpoints.map((e) => (
                                            <tr key={e.id}>
                                                <td className="vita-nowrap">
                                                    <Pill tone="neutral">{e.method}</Pill>
                                                </td>
                                                <td className="vita-code vita-wrap">{e.route}</td>
                                                <td className="vita-nowrap">{e.auth ?? '—'}</td>
                                                <td className="vita-wrap">{e.permissions?.length ? e.permissions.join(', ') : '—'}</td>
                                                {canManage && (
                                                    <td className="vita-nowrap">
                                                        <button className="vita-btn vita-btn-sm" onClick={() => generate([e.id], e.id)} disabled={!!busy}>
                                                            <Sparkles size={12} /> {busy === e.id ? 'Generating…' : 'Generate cases'}
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

                    {cov.contract_only_endpoints.length > 0 && (
                        <section className="vita-card">
                            <header className="vita-card-head">
                                <h3>Contract-only endpoints ({cov.contract_only_endpoints.length})</h3>
                            </header>
                            <div className="vita-explainer">These have api-contract cases but no authorization or property case yet.</div>
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th>Route</th>
                                            {canManage && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cov.contract_only_endpoints.map((e) => (
                                            <tr key={e.id}>
                                                <td className="vita-nowrap">
                                                    <Pill tone="neutral">{e.method}</Pill>
                                                </td>
                                                <td className="vita-code vita-wrap">{e.route}</td>
                                                {canManage && (
                                                    <td className="vita-nowrap">
                                                        <button className="vita-btn vita-btn-sm" onClick={() => generate([e.id], e.id)} disabled={!!busy}>
                                                            <Sparkles size={12} /> {busy === e.id ? 'Generating…' : 'Generate cases'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    <section className="vita-card">
                        <header className="vita-card-head">
                            <h3>Tables without a case ({cov.uncovered_tables.length})</h3>
                        </header>
                        {cov.uncovered_tables.length === 0 ? (
                            <Empty>Every table is touched by at least one case.</Empty>
                        ) : (
                            <div className="vita-scroll">
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Table</th>
                                            <th>Schema</th>
                                            {canManage && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cov.uncovered_tables.map((t) => (
                                            <tr key={t.id}>
                                                <td className="vita-code">{t.name}</td>
                                                <td className="vita-nowrap">{t.schema ?? 'dbo'}</td>
                                                {canManage && (
                                                    <td className="vita-nowrap">
                                                        <button
                                                            className="vita-btn vita-btn-sm"
                                                            onClick={() => generate([t.id], t.id)}
                                                            disabled={!!busy}
                                                            title="Invariant cases need the model; without one nothing is generated for a table"
                                                        >
                                                            <Sparkles size={12} /> {busy === t.id ? 'Generating…' : 'Generate cases'}
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
                                <h3>Cases by skill pack</h3>
                            </header>
                            {Object.keys(cov.packs).length === 0 ? (
                                <Empty>No cases yet.</Empty>
                            ) : (
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Pack</th>
                                            <th>Shadow</th>
                                            <th>Active</th>
                                            <th>Retired</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(cov.packs)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([name, p]) => (
                                                <tr key={name}>
                                                    <td className="vita-nowrap">
                                                        <Link to={`/vita/cases?repo=${encodeURIComponent(repo)}&skill=${encodeURIComponent(name)}`}>{name}</Link>
                                                    </td>
                                                    <td>{p.shadow ?? 0}</td>
                                                    <td>{p.active ?? 0}</td>
                                                    <td>{p.retired ?? 0}</td>
                                                    <td>{p.total}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </section>
                        <section className="vita-card">
                            <header className="vita-card-head">
                                <h3>Permission keys no case tests ({cov.permissions_untested.length})</h3>
                            </header>
                            {cov.permissions_untested.length === 0 ? (
                                <Empty>Every permission key an endpoint requires is referenced by a case.</Empty>
                            ) : (
                                <div className="vita-ta-perms">
                                    {cov.permissions_untested.map((p) => (
                                        <Pill key={p} tone="warn">
                                            {p}
                                        </Pill>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <VitaEscapesPanel repo={repo} onGenerated={reload} />
                </>
            )}
        </div>
    );
};

export default VitaCoveragePage;
