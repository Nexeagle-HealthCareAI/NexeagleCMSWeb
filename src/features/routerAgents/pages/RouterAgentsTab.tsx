import React from 'react';
import { Activity, Brain, Database, GitCommitVertical, ListChecks, MessageSquareWarning, RefreshCw } from 'lucide-react';
import { routerAgentsService, errorText, type AgentKind } from '../services/routerAgentsService';
import { useLoad, when } from '../../vitaAgents/components/format';
import { Empty, ErrorBox, Pill } from '../../vitaAgents/components/shared';
import { todayIst, istDaysAgo } from '../../insights/utils/istDate';
import { useAuthStore } from '../../../store/useAuthStore';
import { TrainingDataPanel } from '../../insights/components/TrainingDataPanel';
import { FeedbackLogPanel } from '../../insights/components/FeedbackLogPanel';
import { OverviewSection } from '../components/OverviewSection';
import { LearningSection } from '../components/LearningSection';
import { ModelsSection } from '../components/ModelsSection';
import { DecisionsSection } from '../components/DecisionsSection';
import { AGENT_NAMES, callerName } from '../components/labels';
import '../../insights/components/Insights.css';
import '../../vitaAgents/pages/VitaAgents.css';
import './RouterAgents.css';

// Doctor Dekho page -> "AI Agents": the 1HMS-NLP-Router agents (symptom router used by Doctor Dekho,
// the WhatsApp bot and VoiceRx; the multi-turn chat agent) and how they learn from their mistakes.

const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'learning', label: 'Learning from mistakes', icon: Brain },
    { id: 'models', label: 'Model versions', icon: GitCommitVertical },
    { id: 'decisions', label: 'Decisions', icon: ListChecks },
    { id: 'training', label: 'Training data', icon: Database },
    { id: 'feedback', label: 'Booking feedback', icon: MessageSquareWarning },
] as const;
export type RouterAgentsTabId = (typeof TABS)[number]['id'];

const RANGES = [
    { id: 7, label: '7 days' },
    { id: 30, label: '30 days' },
    { id: 90, label: '90 days' },
];

const STALE_MS = 60 * 60 * 1000;
const isStale = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > STALE_MS;

export const RouterAgentsTab: React.FC = () => {
    const [tab, setTab] = React.useState<RouterAgentsTabId>('overview');
    const [days, setDays] = React.useState(30);
    const [agent, setAgent] = React.useState<'' | AgentKind>('route');
    const [caller, setCaller] = React.useState('');
    const canManage = useAuthStore(s => s.permissions.includes('insights.manage'));

    const to = todayIst();
    const from = istDaysAgo(days - 1);

    const status = useLoad(() => routerAgentsService.status(), []);
    const overview = useLoad(
        () => routerAgentsService.overview(from, to, agent || undefined, caller || undefined),
        [from, to, agent, caller],
    );
    const learning = useLoad(() => routerAgentsService.learningSummary(), []);
    const models = useLoad(() => routerAgentsService.models(50), []);

    const s = status.data;
    const lastFeed = s?.lastDecisionReceivedAt ?? null;
    const feedStale = isStale(lastFeed);
    const callers = overview.data?.byCaller ?? [];

    const refreshAll = () => {
        status.reload();
        overview.reload();
        learning.reload();
        models.reload();
    };

    return (
        <div className="vita-page ra-page">
            <header className="vita-head">
                <div className="vita-title">
                    <div className="vita-title-icon"><Brain size={22} /></div>
                    <div>
                        <h1>AI Agents</h1>
                        <p>What the NLP-router agents decide, where they get it wrong, and how each mistake is taught back.</p>
                    </div>
                </div>
                <div className="ra-status">
                    {status.loading && !s ? (
                        <Pill tone="neutral">Checking router…</Pill>
                    ) : s?.reachable ? (
                        <Pill tone="good">Router online · model {s.modelVersion ?? '—'}</Pill>
                    ) : (
                        <Pill tone="bad">Router not reachable{s?.error ? `: ${s.error}` : ''}</Pill>
                    )}
                    {s && (
                        <Pill tone={feedStale ? 'warn' : 'good'}>
                            {lastFeed === null ? 'No decisions received yet' : `Last decision ${when(s.lastDecisionReceivedAt)}`}
                        </Pill>
                    )}
                    {s?.telemetry && s.telemetry.enabled === false && <Pill tone="warn">Router feed off (set HMS_CMS_API_URL)</Pill>}
                </div>
            </header>

            <div className="vita-controls ra-controls">
                <div className="insights-filter-toggle" role="group" aria-label="Agent">
                    {(['route', 'chat', ''] as const).map(a => (
                        <button key={a || 'all'} className={`insights-filter-btn ${agent === a ? 'active' : ''}`} onClick={() => setAgent(a)}>
                            {a ? AGENT_NAMES[a] : 'Both'}
                        </button>
                    ))}
                </div>
                <div className="insights-filter-toggle" role="group" aria-label="Period">
                    {RANGES.map(r => (
                        <button key={r.id} className={`insights-filter-btn ${days === r.id ? 'active' : ''}`} onClick={() => setDays(r.id)}>
                            {r.label}
                        </button>
                    ))}
                </div>
                <select className="vita-input" value={caller} onChange={e => setCaller(e.target.value)} aria-label="Caller">
                    <option value="">All callers</option>
                    {caller && !callers.some(c => c.name === caller) && <option value={caller}>{callerName(caller)}</option>}
                    {callers.map(c => (
                        <option key={c.name} value={c.name}>{callerName(c.name)} ({c.count.toLocaleString('en-IN')})</option>
                    ))}
                </select>
                <button className="vita-btn" onClick={refreshAll} disabled={overview.loading} title="Refresh">
                    <RefreshCw size={14} className={overview.loading ? 'vita-spin' : ''} /> Refresh
                </button>
            </div>

            <nav className="insights-subtabs">
                {TABS.map(t => (
                    <button key={t.id} className={`insights-subtab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        <t.icon size={15} /> {t.label}
                        {t.id === 'learning' && (learning.data?.pending ?? 0) > 0 && (
                            <span className="ra-tab-badge">{learning.data!.pending > 99 ? '99+' : learning.data!.pending}</span>
                        )}
                    </button>
                ))}
            </nav>

            {tab === 'overview' &&
                (overview.error && !overview.data ? (
                    <ErrorBox message={errorText(overview.error, 'Could not load the agent overview.')} onRetry={overview.reload} />
                ) : !overview.data ? (
                    <Empty>Loading…</Empty>
                ) : (
                    <div className={overview.loading ? 'vita-loading' : ''}>
                        <OverviewSection o={overview.data} status={s} learning={learning.data} models={models.data} goTo={t => setTab(t as RouterAgentsTabId)} />
                    </div>
                ))}
            {tab === 'learning' && (
                <LearningSection
                    summary={learning.data}
                    summaryError={learning.error}
                    reloadSummary={learning.reload}
                    status={s}
                    reloadStatus={status.reload}
                    canManage={canManage}
                    decisionsInPeriod={overview.data?.total ?? null}
                />
            )}
            {tab === 'models' && <ModelsSection status={s} reloadStatus={status.reload} canManage={canManage} />}
            {tab === 'decisions' && <DecisionsSection from={from} to={to} agent={agent || undefined} caller={caller || undefined} />}
            {tab === 'training' && <TrainingDataPanel />}
            {tab === 'feedback' && <FeedbackLogPanel />}
        </div>
    );
};

export default RouterAgentsTab;
