import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Check, RefreshCw, ScanSearch, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    routerAgentsService, errorText,
    type AgentServiceStatus, type LearningItem, type LearningStatus, type LearningSummary,
} from '../services/routerAgentsService';
import { num, pct, useLoad, when } from '../../vitaAgents/components/format';
import { Card, Empty, ErrorBox, Pill } from '../../vitaAgents/components/shared';
import { SOURCES, SPECIALTIES, specialtyName } from './labels';

const STATUS_TABS: { id: LearningStatus; label: string }[] = [
    { id: 'pending', label: 'To review' },
    { id: 'awaiting', label: 'Approved, waiting for rebuild' },
    { id: 'learned', label: 'Learned' },
    { id: 'rejected', label: 'Ignored' },
];

const SPECIALTY_OPTIONS = Object.entries(SPECIALTIES).sort((a, b) => a[1].localeCompare(b[1]));
const PAGE = 15;

/** The loop, drawn as steps with live counts. */
const LoopDiagram: React.FC<{ s: LearningSummary; status: AgentServiceStatus | null; decisions: number | null }> = ({ s, status, decisions }) => {
    const rb = status?.rebuild;
    const steps = [
        { n: decisions === null ? '—' : num(decisions), title: 'Agent decides', text: 'Every answer is logged: specialty, confidence, speed.' },
        { n: num(s.pending), title: 'Mistakes waiting', text: 'Booked a different specialty, no match, unsure, emergency, user said wrong.' },
        { n: num(s.approved + s.rejected), title: 'A person reviews', text: 'Pick the right specialty, or ignore noise. Nothing is learned without this.' },
        { n: num(s.awaitingRebuild), title: 'Added to training', text: 'Approved phrases join the training data.' },
        {
            n: rb?.state === 'running' ? '…' : rb?.state === 'done' ? (rb.promoted ? '✓' : '=') : rb?.state === 'failed' ? '!' : '—',
            title: 'Rebuild and test',
            text: 'A new model is trained and tested on sentences it never saw. It goes live only if it is not worse.',
        },
        { n: num(s.learned), title: 'Learned', text: 'Corrections inside the model now answering patients.' },
    ];
    return (
        <ol className="ra-loop">
            {steps.map((st, i) => (
                <li key={st.title} className="ra-loop-step">
                    <div className="ra-loop-num">{st.n}</div>
                    <div className="ra-loop-title"><span className="ra-loop-idx">{i + 1}</span>{st.title}</div>
                    <div className="ra-loop-text">{st.text}</div>
                    {i < steps.length - 1 && <ArrowRight className="ra-loop-arrow" size={16} />}
                </li>
            ))}
        </ol>
    );
};

const ReviewRow: React.FC<{ item: LearningItem; canManage: boolean; onDone: () => void }> = ({ item, canManage, onDone }) => {
    const suggested = item.actualSpecialtyId && SPECIALTIES[item.actualSpecialtyId]
        ? item.actualSpecialtyId
        : item.predictedSpecialtyId && SPECIALTIES[item.predictedSpecialtyId] ? item.predictedSpecialtyId : '';
    const [specialty, setSpecialty] = React.useState(suggested);
    const [busy, setBusy] = React.useState(false);
    const src = SOURCES[item.source] ?? { label: item.source, hint: '' };
    const pending = item.status === 'pending';

    const act = async (action: 'approve' | 'reject') => {
        if (action === 'approve' && !specialty) {
            toast.error('Choose the right specialty first.');
            return;
        }
        setBusy(true);
        try {
            await routerAgentsService.review(item.itemId, action, action === 'approve' ? specialty : undefined,
                action === 'reject' ? 'Not useful for training' : undefined);
            toast.success(action === 'approve'
                ? `Added to training as ${specialtyName(specialty)}. It is learned at the next rebuild.`
                : 'Ignored. It will not be used for training.');
            onDone();
        } catch (e) {
            toast.error(errorText(e, 'Could not save the review.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <tr>
            <td className="vita-wrap">
                <div className="ra-phrase">“{item.queryText}”</div>
                {item.source === 'emergency_check' && pending && (
                    <div className="vita-small ra-emergency-note">
                        Emergency alerts come from fixed safety rules, not from learning. Teach only the right specialty here;
                        a wrong alarm or a missed emergency should be reported to the router team.
                    </div>
                )}
                <div className="vita-muted vita-small">
                    {item.agent === 'chat' ? 'Chat agent' : 'Symptom router'} · last seen {when(item.lastSeenAt)}
                    {item.occurrences > 1 && <> · <strong>{num(item.occurrences)}×</strong></>}
                </div>
            </td>
            <td><Pill tone={item.source === 'emergency_check' ? 'bad' : item.source === 'booking_correction' || item.source === 'user_feedback' ? 'warn' : 'neutral'}><span title={src.hint}>{src.label}</span></Pill></td>
            <td className="vita-nowrap">
                {specialtyName(item.predictedSpecialtyId)}
                {item.confidence != null && <div className="vita-muted vita-small">{pct(item.confidence)} sure</div>}
            </td>
            <td className="vita-nowrap">{item.actualSpecialtyId ? specialtyName(item.actualSpecialtyId) : <span className="vita-muted">—</span>}</td>
            <td className="ra-actions">
                {pending ? (
                    canManage ? (
                        <>
                            <select className="vita-input ra-select" value={specialty} onChange={e => setSpecialty(e.target.value)} disabled={busy} aria-label="Correct specialty">
                                <option value="">Correct specialty…</option>
                                {SPECIALTY_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </select>
                            <button className="vita-btn vita-btn-sm ra-approve" onClick={() => act('approve')} disabled={busy || !specialty} title="Add this phrase to training with the chosen specialty">
                                <Check size={13} /> Teach
                            </button>
                            <button className="vita-btn vita-btn-sm" onClick={() => act('reject')} disabled={busy} title="Noise, test text or not a health query: do not learn from it">
                                <X size={13} /> Ignore
                            </button>
                        </>
                    ) : <span className="vita-muted vita-small">Needs insights.manage to review</span>
                ) : item.status === 'approved' ? (
                    <span className="vita-small">
                        Taught as <strong>{specialtyName(item.approvedSpecialtyId)}</strong>
                        {item.modelVersionLearned
                            ? <div className="vita-good">Learned in {item.modelVersionLearned}</div>
                            : <div className="vita-muted">Waiting for the next rebuild</div>}
                        <div className="vita-muted">{item.reviewedBy ?? ''} {when(item.reviewedAt)}</div>
                    </span>
                ) : (
                    <span className="vita-small vita-muted">Ignored {item.reviewedBy ? `by ${item.reviewedBy}` : ''} {when(item.reviewedAt)}</span>
                )}
            </td>
        </tr>
    );
};

export const LearningSection: React.FC<{
    summary: LearningSummary | null;
    summaryError: unknown;
    reloadSummary: () => void;
    status: AgentServiceStatus | null;
    reloadStatus: () => void;
    canManage: boolean;
    decisionsInPeriod: number | null;
}> = ({ summary, summaryError, reloadSummary, status, reloadStatus, canManage, decisionsInPeriod }) => {
    const [tab, setTab] = React.useState<LearningStatus>('pending');
    const [source, setSource] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [scanning, setScanning] = React.useState(false);
    const [rebuilding, setRebuilding] = React.useState(false);

    React.useEffect(() => {
        const h = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
        return () => clearTimeout(h);
    }, [search]);

    const items = useLoad(
        () => routerAgentsService.learningItems({ page, limit: PAGE, status: tab, source: source || undefined, search: query || undefined }),
        [page, tab, source, query],
    );

    const afterReview = () => {
        items.reload();
        reloadSummary();
    };

    const scan = async () => {
        setScanning(true);
        try {
            const r = await routerAgentsService.scan();
            toast.success(r.found ? `${r.found} new booking corrections added to the queue.` : 'No new booking corrections.');
            afterReview();
        } catch (e) {
            toast.error(errorText(e, 'Scan failed.'));
        } finally {
            setScanning(false);
        }
    };

    const rebuild = async () => {
        setRebuilding(true);
        try {
            const r = await routerAgentsService.rebuild();
            toast.success(r.message);
            reloadStatus();
        } catch (e) {
            toast.error(errorText(e, 'Could not start the rebuild.'));
        } finally {
            setRebuilding(false);
        }
    };

    if (summaryError && !summary) return <ErrorBox message={errorText(summaryError, 'Could not load the learning loop.')} onRetry={reloadSummary} />;
    if (!summary) return <Empty>Loading…</Empty>;
    const running = status?.rebuild?.state === 'running';
    const data = items.data;

    return (
        <div className="vita-stack">
            <Card title="How the agent learns from its mistakes"
                right={canManage && (
                    <div className="ra-head-actions">
                        <button className="vita-btn" onClick={scan} disabled={scanning} title="Look for Doctor Dekho bookings that went to a different specialty than suggested (last 30 days)">
                            <ScanSearch size={14} /> {scanning ? 'Scanning…' : 'Find new mistakes'}
                        </button>
                        <button className="vita-btn ra-primary" onClick={rebuild} disabled={rebuilding || running}
                            title="Train a new model with everything approved, test it, and put it live only if it is not worse">
                            <RefreshCw size={14} className={running ? 'vita-spin' : ''} />
                            {running ? `Rebuilding: ${status?.rebuild?.step ?? ''}` : `Rebuild model${summary.awaitingRebuild ? ` (${summary.awaitingRebuild} to learn)` : ''}`}
                        </button>
                    </div>
                )}>
                <LoopDiagram s={summary} status={status} decisions={decisionsInPeriod} />
                <p className="vita-muted vita-small ra-note">
                    Safety: the agent never changes itself from patient behaviour alone. A person decides what it learns, and the emergency
                    rules are fixed in code, not learned. A rebuilt model is tested on {status?.validation?.rows ? num(status.validation.rows) : 'about 1,500'} held-out
                    sentences and replaces the current one only if accuracy does not fall and confident mistakes do not rise.
                    {summary.lastScanAt && ` Last scan for booking corrections: ${when(summary.lastScanAt)}.`}
                </p>
                {status?.rebuild?.state === 'done' && status.rebuild.verdict && (
                    <div className={`ra-verdict ${status.rebuild.promoted ? 'ok' : 'kept'}`}>
                        Last rebuild ({when(status.rebuild.finishedAt)}): {status.rebuild.promoted ? 'new model is live' : 'kept the current model'}. {status.rebuild.verdict}
                    </div>
                )}
                {status?.rebuild?.state === 'failed' && <div className="ra-verdict kept">Last rebuild failed: {status.rebuild.error}</div>}
            </Card>

            <div className="vita-grid-2">
                <Card title="Mistakes found, reviewed and learned, per week">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={summary.weekly.map(w => ({ ...w, week: new Date(`${w.weekStart}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))}
                            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="found" name="Found" fill="#eb6834" />
                            <Bar dataKey="reviewed" name="Reviewed" fill="#2a78d6" />
                            <Bar dataKey="learned" name="Learned" fill="#1baf7a" />
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="vita-muted vita-small">Healthy: "Learned" keeps up with "Found", and "Found" shrinks over time as the agent stops repeating the same mistakes.</p>
                </Card>
                <Card title="Waiting for review, by kind">
                    {summary.pendingBySource.length === 0 ? <Empty>Nothing waiting. 🎉</Empty> : (
                        <ul className="vita-list">
                            {summary.pendingBySource.map(r => (
                                <li key={r.name}>
                                    <button className={`vita-link ra-source ${source === r.name ? 'active' : ''}`} onClick={() => { setSource(source === r.name ? '' : r.name); setTab('pending'); setPage(1); }}>
                                        {SOURCES[r.name]?.label ?? r.name}
                                    </button>
                                    <span className="vita-muted vita-small ra-source-hint">{SOURCES[r.name]?.hint}</span>
                                    <span className="vita-count">{num(r.count)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <Card title="Review queue" right={
                <div className="vita-filters">
                    <input className="vita-input" placeholder="Search phrases" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search phrases" />
                    <select className="vita-input" value={source} onChange={e => { setSource(e.target.value); setPage(1); }} aria-label="Kind">
                        <option value="">All kinds</option>
                        {Object.entries(SOURCES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                    </select>
                </div>
            }>
                <div className="insights-filter-toggle ra-status-tabs" role="group" aria-label="Status">
                    {STATUS_TABS.map(t => (
                        <button key={t.id} className={`insights-filter-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setPage(1); }}>
                            {t.label}
                            {t.id === 'pending' && summary.pending > 0 && ` (${num(summary.pending)})`}
                            {t.id === 'awaiting' && summary.awaitingRebuild > 0 && ` (${num(summary.awaitingRebuild)})`}
                            {t.id === 'learned' && summary.learned > 0 && ` (${num(summary.learned)})`}
                        </button>
                    ))}
                </div>
                {items.error && !data ? <ErrorBox message={errorText(items.error, 'Could not load the queue.')} onRetry={items.reload} />
                    : !data ? <Empty>Loading…</Empty>
                    : data.data.length === 0 ? <Empty>{tab === 'pending' ? 'Nothing to review. New mistakes appear here as patients use the agents.' : 'Nothing here yet.'}</Empty>
                    : (
                        <div className={`vita-scroll ${items.loading ? 'vita-loading' : ''}`}>
                            <table className="vita-table">
                                <thead>
                                    <tr>
                                        <th>What the patient wrote</th>
                                        <th>Why it is here</th>
                                        <th>Agent said</th>
                                        <th>Patient chose</th>
                                        <th>{tab === 'pending' ? 'Teach the agent' : 'Outcome'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.data.map(i => <ReviewRow key={i.itemId} item={i} canManage={canManage} onDone={afterReview} />)}
                                </tbody>
                            </table>
                        </div>
                    )}
                {data && data.pagination.totalPages > 1 && (
                    <div className="vita-pager">
                        <span className="vita-muted vita-small">{num(data.pagination.totalItems)} items</span>
                        <span>
                            <button className="vita-btn vita-btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span className="vita-small">Page {page} of {data.pagination.totalPages}</span>{' '}
                            <button className="vita-btn vita-btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                        </span>
                    </div>
                )}
                <p className="vita-muted vita-small">
                    Phrases are kept only for doubtful or wrong answers, so a person can teach the agent. Unreviewed phrases are deleted after a year.
                </p>
            </Card>
        </div>
    );
};

export default LearningSection;
