import React from 'react';
import { toast } from 'sonner';
import { vitaError, vitaService } from '../services/vitaService';
import { num, useLoad, when } from './format';
import { Card, Empty, ErrorBox, Pill } from './shared';

const REASONS: Record<string, string> = {
    no_hits: 'Nothing in the guides matched',
    ungrounded: 'AI answer could not be backed by the guides',
    llm_error: 'LLM failed and no passage was good enough',
};

type Status = 'open' | 'resolved' | 'ignored' | 'all';

const GapsTab: React.FC<{ hospitalId?: string }> = ({ hospitalId }) => {
    const [status, setStatus] = React.useState<Status>('open');
    const [qInput, setQInput] = React.useState('');
    const [q, setQ] = React.useState('');
    React.useEffect(() => {
        const id = setTimeout(() => setQ(qInput.trim()), 350);
        return () => clearTimeout(id);
    }, [qInput]);
    const { data, error, reload } = useLoad(() => vitaService.gaps(status, q || undefined, hospitalId), [status, q, hospitalId]);

    const setGap = async (id: string, to: 'open' | 'resolved' | 'ignored') => {
        try {
            await vitaService.setGapStatus(id, to);
            toast.success(to === 'resolved' ? 'Marked resolved. It reopens if users ask it again.' : `Marked ${to}`);
            reload();
        } catch (e) {
            toast.error(vitaError(e));
        }
    };

    return (
        <div className="vita-stack">
            <div className="vita-explainer">
                Questions Vita could not answer. Fix each one by adding the missing step to the PRD/FAQ sources (then the
                knowledge build runs on the next deploy) and mark it <b>resolved</b>. A resolved question that users ask
                again reopens automatically. <b>Ignore</b> questions that are out of scope.
            </div>

            {data && data.byReason.length > 0 && (
                <div className="vita-tiles">
                    {data.byReason.map((r) => (
                        <div key={r.reason} className="vita-tile" title={REASONS[r.reason]}>
                            <div className="vita-tile-label">{REASONS[r.reason] ?? r.reason}</div>
                            <div className="vita-tile-value">{num(r.questions)}</div>
                            <div className="vita-tile-sub">asked {num(r.timesAsked)} times (open)</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="vita-filters">
                <div className="insights-filter-toggle">
                    {(['open', 'resolved', 'ignored', 'all'] as Status[]).map((s) => (
                        <button key={s} className={`insights-filter-btn ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
                            {s[0].toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
                <input className="vita-input" placeholder="Search questions…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
            </div>

            {error ? (
                <ErrorBox message={vitaError(error)} onRetry={reload} />
            ) : !data ? (
                <Empty>Loading…</Empty>
            ) : data.items.length === 0 ? (
                <Empty>No {status === 'all' ? '' : status} gaps.</Empty>
            ) : (
                <Card title={`${data.items.length} questions`}>
                    <div className="vita-scroll">
                        <table className="vita-table">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Why</th>
                                    <th className="num">Asked</th>
                                    <th>Last asked</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((g) => (
                                    <tr key={g.id}>
                                        <td className="vita-wrap">
                                            {g.question}
                                            {g.lang && g.lang !== 'en' && <span className="vita-muted"> · {g.lang}</span>}
                                        </td>
                                        <td className="vita-muted">{REASONS[g.reason] ?? g.reason}</td>
                                        <td className="num">
                                            <b>{num(g.count)}</b>
                                        </td>
                                        <td className="vita-nowrap">{when(g.lastAskedAt)}</td>
                                        <td>
                                            <Pill tone={g.status === 'open' ? 'warn' : g.status === 'resolved' ? 'good' : 'neutral'}>{g.status}</Pill>
                                        </td>
                                        <td className="vita-nowrap">
                                            {g.status !== 'resolved' && (
                                                <button className="vita-btn vita-btn-sm" onClick={() => setGap(g.id, 'resolved')}>
                                                    Resolve
                                                </button>
                                            )}
                                            {g.status === 'open' && (
                                                <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setGap(g.id, 'ignored')}>
                                                    Ignore
                                                </button>
                                            )}
                                            {g.status !== 'open' && (
                                                <button className="vita-btn vita-btn-sm vita-btn-ghost" onClick={() => setGap(g.id, 'open')}>
                                                    Reopen
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default GapsTab;
