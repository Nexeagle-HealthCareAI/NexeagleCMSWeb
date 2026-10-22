import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, CalendarClock, GraduationCap, ListChecks, PlayCircle, Radar, Settings2 } from 'lucide-react';
import { VitaMascot } from './VitaMascot';
import VitaAerie from './VitaAerie';
import { useVitaActivity } from './useVitaActivity';
import '../../insights/components/Insights.css';
import '../pages/VitaAgents.css';
import './testAgent.css';

// Shell for the Vita Test Agent pages: header + sub-tabs; each tab is a nested route (see App.tsx, /vita/*).
const TABS: { to: string; label: string; icon: React.ComponentType<{ size?: number }>; end?: boolean }[] = [
    { to: '/vita', label: 'Overview', icon: Activity, end: true },
    { to: '/vita/runs', label: 'Runs', icon: PlayCircle },
    { to: '/vita/cases', label: 'Cases', icon: ListChecks },
    { to: '/vita/coverage', label: 'Coverage', icon: Radar },
    { to: '/vita/schedules', label: 'Schedules', icon: CalendarClock },
    { to: '/vita/learning', label: 'Learning', icon: GraduationCap },
    { to: '/vita/settings', label: 'Settings', icon: Settings2 },
];

const VitaLayout: React.FC = () => {
    // Vita the mascot shows what the agent is doing in the header; the aerie below shows the eagles at home on the
    // cliff and flying to the work board when a run is called, then home again when it finishes.
    const { state, caption, repos, connected } = useVitaActivity();
    return (
    <div className="vita-page vita-ta">
        <header className="vita-head">
            <div className="vita-title">
                <div className="vita-title-mascot">
                    <VitaMascot state={state} size={64} title={caption} />
                </div>
                <div>
                    <h1>Vita Test Agent</h1>
                    <p>Autonomous testing of the NexEagle repos: PR gate, nightly runs, generated test cases and their verdicts.</p>
                    <span className="vita-mascot-caption" aria-live="polite">{caption}</span>
                </div>
            </div>
        </header>
        <VitaAerie repos={repos} connected={connected} />

        <nav className="insights-subtabs">
            {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `insights-subtab-btn ${isActive ? 'active' : ''}`}>
                    <t.icon size={15} /> {t.label}
                </NavLink>
            ))}
        </nav>

        <Outlet />
    </div>
    );
};

export default VitaLayout;

