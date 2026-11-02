import React from 'react';
import { ChevronDown, ChevronRight, MessagesSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ConversationMessage, Range, TurnFilters, TurnRow } from '../services/vitaService';
import { vitaError, vitaService } from '../services/vitaService';
import { ms, num, ROUTES, routeLabel, shortId, useLoad, when } from './format';
import { Empty, ErrorBox, Pill } from './shared';

const PAGE = 50;

const statusTone = (s: string) => (s === 'done' ? 'good' : s === 'failed' ? 'bad' : s === 'cancelled' ? 'neutral' : 'warn');

const Detail: React.FC<{ t: TurnRow }> = ({ t }) => {
    const [chat, setChat] = React.useState<ConversationMessage[] | null>(null);
    const [err, setErr] = React.useState<string | null>(null);
    const loadChat = () =>
        vitaService
            .conversation(t.conversationId)
            .then((c) => setChat(c.messages))
            .catch((e) => setErr(vitaError(e)));
    return (
        <div className="vita-detail">
            <div className="vita-detail-grid">
                <div>
                    <div className="vita-detail-label">Question</div>
                    <div className="vita-bubble vita-bubble-user">{t.question ?? '—'}</div>
                    <div className="vita-detail-label">Answer</div>
                    <div className="vita-bubble">{t.answer ?? (t.errorCode ? `Failed: ${t.errorCode}` : '—')}</div>
                    {t.citations.length > 0 && (
                        <>
                            <div className="vita-detail-label">Sources</div>
                            <div className="vita-chips">
                                {t.citations.map((c, i) => (
                                    <span key={i} className="vita-chip" title={c.title}>
                                        {c.docId} §{c.section}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                    {(t.rating || t.feedbackComment) && (
                        <>
                            <div className="vita-detail-label">User feedback</div>
                            <div>
                                {t.rating === 'up' ? '👍 Helpful' : '👎 Not helpful'}
                                {t.feedbackReason && <span className="vita-muted"> · {t.feedbackReason}</span>}
                                {t.feedbackComment && <div className="vita-quote">“{t.feedbackComment}”</div>}
                            </div>
                        </>
                    )}
                </div>
                <dl className="vita-facts">
                    <dt>Route</dt>
                    <dd title={t.route ? ROUTES[t.route]?.hint : undefined}>
                        {routeLabel(t.route)} <span className="vita-code vita-muted">{t.route}</span>
                    </dd>
                    <dt>Reply time</dt>
                    <dd>{ms(t.latencyMs)}</dd>
                    <dt>Waited in queue</dt>
                    <dd>{ms(t.queueWaitMs)}</dd>
                    <dt>Attempts</dt>
                    <dd>{t.attempts}</dd>
                    <dt>Model</dt>
                    <dd className="vita-code">{t.model ?? '—'}</dd>
                    <dt>Tokens</dt>
                    <dd>{t.tokensIn != null ? `${num(t.tokensIn)} in · ${num(t.tokensOut)} out` : '—'}</dd>
                    <dt>Screen</dt>
                    <dd className="vita-code">{t.screen?.route ?? '—'}</dd>
                    <dt>Mode / lang</dt>
                    <dd>
                        {t.mode} / {t.lang ?? '—'}
                    </dd>
                    <dt>Hospital</dt>
                    <dd className="vita-code" title={t.hospitalId}>{shortId(t.hospitalId)}</dd>
                    <dt>User</dt>
                    <dd className="vita-code" title={t.userId}>{shortId(t.userId)}</dd>
                    <dt>Turn</dt>
                    <dd className="vita-code" title={t.turnId}>{shortId(t.turnId)}</dd>
                </dl>
            </div>
            {!chat && (
                <button className="vita-btn" onClick={loadChat}>
                    <MessagesSquare size={14} /> Show whole conversation
                </button>
            )}
            {err && <ErrorBox message={err} />}
            {chat && (
                <div className="vita-chat">
                    {chat.map((m) => (
                        <div key={m.id} className={`vita-bubble ${m.role === 'user' ? 'vita-bubble-user' : ''}`}>
                            <div className="vita-muted vita-small">
                                {m.role === 'user' ? 'User' : `Vita · ${routeLabel(m.route)} · ${ms(m.latencyMs)}`} · {when(m.createdAt)}
                            </div>
                            {m.text}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TurnsTab: React.FC<{ range: Range; hospitalId?: string; initial?: Partial<TurnFilters> }> = ({ range, hospitalId, initial }) => {
    const [route, setRoute] = React.useState(initial?.route ?? '');
    const [status, setStatus] = React.useState(initial?.status ?? '');
    const [rating, setRating] = React.useState<'' | 'up' | 'down' | 'none'>(initial?.rating ?? '');
    const [slow, setSlow] = React.useState(false);
    const [qInput, setQInput] = React.useState('');
    const [q, setQ] = React.useState('');
    const [offset, setOffset] = React.useState(0);
    const [open, setOpen] = React.useState<string | null>(null);

    React.useEffect(() => {
        const id = setTimeout(() => setQ(qInput.trim()), 350);
        return () => clearTimeout(id);
    }, [qInput]);
    React.useEffect(() => setOffset(0), [range, hospitalId, route, status, rating, slow, q]);

    const { data, error, loading, reload } = useLoad(
        () =>
            vitaService.turns({
                range,
                hospitalId,
                route: route || undefined,
                status: status || undefined,
                rating: rating || undefined,
                q: q || undefined,
                slowMs: slow ? 8000 : undefined,
                limit: PAGE,
                offset,
            }),
        [range, hospitalId, route, status, rating, slow, q, offset],
    );

    return (
        <div className="vita-stack">
            <div className="vita-filters">
                <input
                    className="vita-input"
                    placeholder="Search questions and answers…"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                />
                <select className="vita-input" value={route} onChange={(e) => setRoute(e.target.value)}>
                    <option value="">All routes</option>
                    {Object.entries(ROUTES)
                        .filter(([k]) => k !== 'failed')
                        .map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                </select>
                <select className="vita-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Any status</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="queued">Queued</option>
                    <option value="running">Running</option>
                </select>
                <select className="vita-input" value={rating} onChange={(e) => setRating(e.target.value as typeof rating)}>
                    <option value="">Any feedback</option>
                    <option value="down">👎 Not helpful</option>
                    <option value="up">👍 Helpful</option>
                    <option value="none">Not rated</option>
                </select>
                <label className="vita-check-label">
                    <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Slow (&gt; 8 s)
                </label>
                <span className="vita-muted vita-small">{data ? `${num(data.total)} turns` : ''}</span>
            </div>

            {error ? (
                <ErrorBox message={vitaError(error)} onRetry={reload} />
            ) : !data ? (
                <Empty>Loading…</Empty>
            ) : data.items.length === 0 ? (
                <Empty>No turns match these filters.</Empty>
            ) : (
                <div className={`vita-card vita-scroll ${loading ? 'vita-loading' : ''}`}>
                    <table className="vita-table vita-table-click">
                        <thead>
                            <tr>
                                <th />
                                <th>When</th>
                                <th>Question</th>
                                <th>Route</th>
                                <th>Status</th>
                                <th className="num">Reply time</th>
                                <th>Feedback</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((t) => (
                                <React.Fragment key={t.turnId}>
                                    <tr onClick={() => setOpen(open === t.turnId ? null : t.turnId)}>
                                        <td>{open === t.turnId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                                        <td className="vita-nowrap">{when(t.createdAt)}</td>
                                        <td className="vita-ellipsis" title={t.question ?? ''}>
                                            {t.question}
                                        </td>
                                        <td>
                                            <span className={`vita-dot vita-dot-${(t.route && ROUTES[t.route]?.group) || (t.status === 'failed' ? 'failed' : 'other')}`} />
                                            {t.route ? routeLabel(t.route) : t.errorCode ?? '—'}
                                        </td>
                                        <td>
                                            <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                                        </td>
                                        <td className={`num ${t.latencyMs && t.latencyMs > 8000 ? 'vita-bad' : ''}`}>{ms(t.latencyMs)}</td>
                                        <td>
                                            {t.rating === 'up' && <ThumbsUp size={14} className="vita-good" />}
                                            {t.rating === 'down' && <ThumbsDown size={14} className="vita-bad" />}
                                        </td>
                                    </tr>
                                    {open === t.turnId && (
                                        <tr className="vita-detail-row">
                                            <td colSpan={7}>
                                                <Detail t={t} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <div className="vita-pager">
                        <button className="vita-btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                            ← Newer
                        </button>
                        <span className="vita-muted vita-small">
                            {offset + 1}–{offset + data.items.length} of {num(data.total)}
                        </span>
                        <button className="vita-btn" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
                            Older →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TurnsTab;
