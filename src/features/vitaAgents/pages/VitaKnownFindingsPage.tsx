import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import { num, useLoad, when } from '../components/format';
import { Empty, ErrorBox, Pill, Tile } from '../components/shared';
import type { Tone } from '../components/format';
import { withoutFixed } from '../components/qualityHelpers';

/** Known findings: what was already wrong in a repo when Vita was switched on (vita-baseline.txt). They run every night and
 *  are listed here, but cannot fail a PR; anything new still does. The list should only shrink: fixed lines are flagged. */

const STATE_TONE: Record<string, Tone> = { fixed: 'good', 'still failing': 'bad', 'not run yet': 'neutral', 'unknown case': 'warn' };
const STATES = ['still failing', 'fixed', 'not run yet', 'unknown case'];


const VitaKnownFindingsPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const repo = params.get('repo') ?? '';
    const state = params.get('state') ?? '';
    const skill = params.get('skill') ?? '';
    const setParam = (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v);
        else next.delete(k);
        setParams(next, { replace: true });
    };
    const { data: repos } = useLoad(() => vitaApi.repos(), []);
    React.useEffect(() => {
        if (!repo && repos && repos.length > 0) setParam('repo', repos[0].repo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, repo]);
    const { data: b, error, loading, reload } = useLoad(() => (repo ? vitaApi.baseline(repo) : Promise.resolve(null)), [repo]);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied — paste it over vita-baseline.txt in the repo and commit it');
        } catch {
            toast.error('Could not copy (the browser blocked the clipboard).');
        }
    };

    const rows = (b?.items ?? []).filter((i) => (!state || i.state === state) && (!skill || i.skill === skill));
    const c = b?.counts ?? {};
    return (
        <div className="vita-stack">
            <div className="vita-ta-toolbar">
                <div className="vita-filters">
                    <select className="vita-input" value={repo} onChange={(e) => setParam('repo', e.target.value)} title="Repo" aria-label="Repo">
                        {!repo && <option value="">Select a repo</option>}
                        {(repos ?? []).map((x) => (
                            <option key={x.repo} value={x.repo}>
                                {x.repo}
                            </option>
                        ))}
                    </select>
                    <span className="vita-small vita-muted" style={{ maxWidth: 560 }}>
                        Old debt recorded when Vita was switched on. It runs every night and is shown here, but cannot fail a PR. The list should only shrink.
                    </span>
                </div>
                <button className="vita-btn" onClick={reload} disabled={loading || !repo} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            {error && !b ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the known findings.')} onRetry={reload} />
            ) : !repo ? (
                <Empty>Select a repo.</Empty>
            ) : !b ? (
                <Empty>Loading…</Empty>
            ) : !b.exists ? (
                <Empty>
                    {repo} has no known findings: every failure blocks its gate. To record what is already wrong, run it once and use{' '}
                    <Link to="/vita/settings">Settings › Add repo</Link> (step 4) or <code>vita baseline</code> on the server.
                </Empty>
            ) : (
                <>
                    <div className="vita-tiles">
                        <Tile label="Listed" value={num(b.listed)} />
                        <Tile label="Still failing" value={num(c['still failing'] ?? 0)} tone={(c['still failing'] ?? 0) > 0 ? 'bad' : 'good'} />
                        <Tile label="Fixed — delete the line" value={num(c.fixed ?? 0)} tone={(c.fixed ?? 0) > 0 ? 'good' : 'neutral'} />
                        <Tile label="Not run yet" value={num(c['not run yet'] ?? 0)} sub="they run nightly" />
                    </div>

                    {(c.fixed ?? 0) > 0 && (
                        <div className="vita-alert vita-alert-good">
                            <CheckCircle2 size={20} color="#047857" aria-hidden="true" style={{ flex: 'none' }} />
                            <span style={{ flex: '1 1 auto' }}>
                                <strong>
                                    {c.fixed} known finding{c.fixed === 1 ? '' : 's'} now pass.
                                </strong>{' '}
                                Remove their lines from <code>vita-baseline.txt</code> so they protect the gate again.
                            </span>
                            <button className="vita-btn" onClick={() => copy(withoutFixed(b))}>
                                <Copy size={14} /> Copy the updated file
                            </button>
                        </div>
                    )}

                    <section className="vita-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="vita-ta-toolbar" style={{ padding: '10px 14px', margin: 0, borderBottom: '1px solid var(--vita-line)' }}>
                            <div className="vita-filters">
                                {Object.entries(b.by_skill).map(([k, n]) => (
                                    <button key={k} className="vita-btn vita-btn-sm" aria-pressed={skill === k} onClick={() => setParam('skill', skill === k ? '' : k)}>
                                        {k} · {n}
                                    </button>
                                ))}
                            </div>
                            <select className="vita-input" value={state} onChange={(e) => setParam('state', e.target.value)} aria-label="Show">
                                <option value="">All states</option>
                                {STATES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="vita-scroll">
                            {rows.length === 0 ? (
                                <Empty>Nothing matches.</Empty>
                            ) : (
                                <table className="vita-table">
                                    <thead>
                                        <tr>
                                            <th>Case</th>
                                            <th>Skill</th>
                                            <th>State</th>
                                            <th>Last run</th>
                                            <th>What it says</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(0, 500).map((i) => (
                                            <tr key={`${i.skill}|${i.title}`}>
                                                <td className="vita-code">{i.title}</td>
                                                <td className="vita-nowrap">{i.skill}</td>
                                                <td>
                                                    <Pill tone={STATE_TONE[i.state] ?? 'neutral'}>{i.state}</Pill>
                                                </td>
                                                <td className="vita-nowrap vita-muted">
                                                    {i.last ? (
                                                        <Link to={`/vita/runs?repo=${encodeURIComponent(b.repo)}&run=${encodeURIComponent(i.last.run_id)}`}>{when(i.last.at)}</Link>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="vita-ta-msg vita-muted" title={i.last?.message}>
                                                    {i.last?.message || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="vita-small vita-muted" style={{ padding: '8px 14px' }}>
                            Showing {Math.min(rows.length, 500)} of {rows.length}
                            {b.file && (
                                <>
                                    {' '}
                                    · the file: <code>{b.file}</code>
                                </>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default VitaKnownFindingsPage;
