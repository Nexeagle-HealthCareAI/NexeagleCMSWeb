import React from 'react';
import { Activity, BookOpen, Bot, HeartPulse, MessageSquareWarning, MessagesSquare, RefreshCw, ThumbsUp } from 'lucide-react';
import type { Range } from '../services/vitaService';
import { vitaError, vitaService } from '../services/vitaService';
import { useLoad, when } from '../components/format';
import { Empty, ErrorBox, Pill } from '../components/shared';
import OverviewTab from '../components/OverviewTab';
import HealthTab from '../components/HealthTab';
import TurnsTab from '../components/TurnsTab';
import GapsTab from '../components/GapsTab';
import FeedbackTab from '../components/FeedbackTab';
import KnowledgeTab from '../components/KnowledgeTab';
import '../../insights/components/Insights.css';
import './VitaAgents.css';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'health', label: 'Health', icon: HeartPulse },
    { id: 'turns', label: 'Conversations', icon: MessagesSquare },
    { id: 'gaps', label: 'Knowledge gaps', icon: MessageSquareWarning },
    { id: 'feedback', label: 'Feedback', icon: ThumbsUp },
    { id: 'kb', label: 'Knowledge base', icon: BookOpen },
] as const;
type TabId = (typeof TABS)[number]['id'];

const RANGES: { id: Range; label: string }[] = [
    { id: '1h', label: '1 hour' },
    { id: '24h', label: '24 hours' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
];

const REFRESH_MS = 30_000;

const VitaAgentsPage: React.FC = () => {
    const [tab, setTab] = React.useState<TabId>(() => {
        const t = new URLSearchParams(window.location.search).get('tab');
        return (TABS.find((x) => x.id === t)?.id ?? 'overview') as TabId;
    });
    const [range, setRange] = React.useState<Range>('24h');
    const [hospitalId, setHospitalId] = React.useState('');
    const [auto, setAuto] = React.useState(true);

    // Overview also feeds the header (health pill) and the hospital filter.
    const { data: o, error, loading, reload } = useLoad(() => vitaService.overview(range, hospitalId || undefined), [range, hospitalId]);

    React.useEffect(() => {
        if (!auto || (tab !== 'overview' && tab !== 'health')) return;
        const id = setInterval(() => document.visibilityState === 'visible' && reload(), REFRESH_MS);
        return () => clearInterval(id);
    }, [auto, tab, reload]);

    const goTo = (t: string) => {
        setTab(t as TabId);
        const u = new URL(window.location.href);
        u.searchParams.set('tab', t);
        window.history.replaceState(null, '', u);
    };

    const h = o?.health;
    const hospitals = o?.hospitals ?? [];

    return (
        <div className="vita-page">
            <header className="vita-head">
                <div className="vita-title">
                    <div className="vita-title-icon">
                        <Bot size={22} />
                    </div>
                    <div>
                        <h1>Vita Agents</h1>
                        <p>Health, usage and answer quality of the 1HMS AI assistant (Jev + Train agent).</p>
                    </div>
                    {h && (
                        <Pill tone={h.status === 'ok' ? 'good' : 'bad'}>
                            {h.status === 'ok' ? 'All systems OK' : 'Degraded'} · {h.workers.length} workers
                        </Pill>
                    )}
                </div>
                <div className="vita-controls">
                    <div className="insights-filter-toggle">
                        {RANGES.map((r) => (
                            <button key={r.id} className={`insights-filter-btn ${range === r.id ? 'active' : ''}`} onClick={() => setRange(r.id)}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <select className="vita-input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} title="Hospital">
                        <option value="">All hospitals</option>
                        {hospitalId && !hospitals.some((x) => x.hospitalId === hospitalId) && <option value={hospitalId}>{hospitalId}</option>}
                        {hospitals.map((x) => (
                            <option key={x.hospitalId} value={x.hospitalId}>
                                {x.hospitalId.slice(0, 8)}… ({x.turns})
                            </option>
                        ))}
                    </select>
                    <label className="vita-check-label" title="Refresh overview and health every 30 s">
                        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto
                    </label>
                    <button className="vita-btn" onClick={reload} disabled={loading} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'vita-spin' : ''} />
                        {h ? when(h.checkedAt) : 'Refresh'}
                    </button>
                </div>
            </header>

            <nav className="insights-subtabs">
                {TABS.map((t) => (
                    <button key={t.id} className={`insights-subtab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => goTo(t.id)}>
                        <t.icon size={15} /> {t.label}
                    </button>
                ))}
            </nav>

            {(tab === 'overview' || tab === 'health') &&
                (error && !o ? (
                    <ErrorBox message={vitaError(error)} onRetry={reload} />
                ) : !o ? (
                    <Empty>Loading Vita metrics…</Empty>
                ) : tab === 'overview' ? (
                    <OverviewTab o={o} goTo={goTo} />
                ) : (
                    <HealthTab h={o.health} />
                ))}
            {tab === 'turns' && <TurnsTab range={range} hospitalId={hospitalId || undefined} />}
            {tab === 'gaps' && <GapsTab hospitalId={hospitalId || undefined} />}
            {tab === 'feedback' && <FeedbackTab range={range} hospitalId={hospitalId || undefined} />}
            {tab === 'kb' && <KnowledgeTab />}
        </div>
    );
};

export default VitaAgentsPage;
