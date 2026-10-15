import React from 'react';
import type { Range } from '../services/vitaService';
import { vitaError, vitaService } from '../services/vitaService';
import { ms, num, routeLabel, useLoad, when } from './format';
import { Empty, ErrorBox } from './shared';

const REASON_LABEL: Record<string, string> = {
    wrong: 'Wrong',
    incomplete: 'Incomplete',
    not_relevant: 'Not relevant',
    too_long: 'Too long',
    other: 'Other',
    none: 'No reason given',
};

const FeedbackTab: React.FC<{ range: Range; hospitalId?: string }> = ({ range, hospitalId }) => {
    const [rating, setRating] = React.useState<'' | 'up' | 'down'>('down');
    const { data, error, reload } = useLoad(() => vitaService.feedback(range, rating || undefined, hospitalId), [range, rating, hospitalId]);
    const downs = data?.reasons.filter((r) => r.rating === 'down') ?? [];
    const totalDown = downs.reduce((s, r) => s + r.count, 0);

    return (
        <div className="vita-stack">
            <div className="vita-filters">
                <div className="insights-filter-toggle">
                    {(
                        [
                            ['down', '👎 Not helpful'],
                            ['up', '👍 Helpful'],
                            ['', 'All'],
                        ] as const
                    ).map(([v, label]) => (
                        <button key={v || 'all'} className={`insights-filter-btn ${rating === v ? 'active' : ''}`} onClick={() => setRating(v)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {downs.length > 0 && (
                <div className="vita-reasons">
                    {downs.map((r) => (
                        <div key={r.reason} className="vita-reason">
                            <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                            <div className="vita-bar-track">
                                <div className="vita-bar-fill vita-bar-fill-warn" style={{ width: `${(r.count / Math.max(1, totalDown)) * 100}%` }} />
                            </div>
                            <b>{num(r.count)}</b>
                        </div>
                    ))}
                </div>
            )}

            {error ? (
                <ErrorBox message={vitaError(error)} onRetry={reload} />
            ) : !data ? (
                <Empty>Loading…</Empty>
            ) : data.items.length === 0 ? (
                <Empty>No feedback in this period.</Empty>
            ) : (
                <div className="vita-feedback-list">
                    {data.items.map((f) => (
                        <article key={f.id} className={`vita-feedback vita-feedback-${f.rating}`}>
                            <header>
                                <span>{f.rating === 'up' ? '👍' : '👎'}</span>
                                {f.reason && <b>{REASON_LABEL[f.reason] ?? f.reason}</b>}
                                <span className="vita-muted vita-small">
                                    {when(f.createdAt)} · {routeLabel(f.route)} · {ms(f.latencyMs)}
                                </span>
                            </header>
                            {f.comment && <div className="vita-quote">“{f.comment}”</div>}
                            <div className="vita-detail-label">Question</div>
                            <div className="vita-bubble vita-bubble-user">{f.question}</div>
                            <div className="vita-detail-label">Vita answered</div>
                            <div className="vita-bubble">{f.answer}</div>
                            {f.citations.length > 0 && (
                                <div className="vita-chips">
                                    {f.citations.map((c, i) => (
                                        <span key={i} className="vita-chip" title={c.title}>
                                            {c.docId} §{c.section}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedbackTab;
