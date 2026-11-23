import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { SiteVisitsPanel } from './SiteVisitsPanel';
import { PatientLoginsPanel } from './PatientLoginsPanel';
import { OnlineAppointmentsPanel } from './OnlineAppointmentsPanel';
import { AuthFunnelPanel } from './AuthFunnelPanel';
import { BookingFunnelPanel } from './BookingFunnelPanel';
import { SearchLogPanel } from './SearchLogPanel';
import { WeeklyGrowthPanel } from './WeeklyGrowthPanel';
import { WhatsAppBotPanel } from './WhatsAppBotPanel';
import { DoctorDekhoDailyPanel } from './DoctorDekhoDailyPanel';
import { BarChart3, Users, CalendarDays, KeyRound, Filter, Search, TrendingUp, MessageCircle, Stethoscope } from 'lucide-react';
import '../../dashboard/pages/PremiumHospitals.css';
import './Insights.css';

type InsightsSubTab = 'growth' | 'whatsapp' | 'doctordekho' | 'visits' | 'logins' | 'appointments' | 'authFunnel' | 'bookingFunnel' | 'searches';
const SUB_TABS: InsightsSubTab[] = ['growth', 'whatsapp', 'doctordekho', 'visits', 'logins', 'appointments', 'authFunnel', 'bookingFunnel', 'searches'];

export const InsightsTab: React.FC = () => {
    // The open tab is in the address (?tab=), so a link or a reload lands on it.
    const [params, setParams] = useSearchParams();
    const asked = params.get('tab') as InsightsSubTab | null;
    const activeSubTab: InsightsSubTab = asked && SUB_TABS.includes(asked) ? asked : 'growth';
    const setActiveSubTab = (tab: InsightsSubTab) => {
        const next = new URLSearchParams(params);
        next.set('tab', tab);
        setParams(next, { replace: true });
    };

    const tabs: { key: InsightsSubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'growth', label: 'Weekly growth', icon: <TrendingUp size={16} /> },
        { key: 'whatsapp', label: 'WhatsApp bot', icon: <MessageCircle size={16} /> },
        { key: 'doctordekho', label: 'Doctor Dekho daily', icon: <Stethoscope size={16} /> },
        { key: 'visits', label: 'Site Visits', icon: <BarChart3 size={16} /> },
        { key: 'logins', label: 'Patient Logins', icon: <Users size={16} /> },
        { key: 'appointments', label: 'Appointments', icon: <CalendarDays size={16} /> },
        { key: 'authFunnel', label: 'Auth Funnel', icon: <KeyRound size={16} /> },
        { key: 'bookingFunnel', label: 'Booking Funnel', icon: <Filter size={16} /> },
        { key: 'searches', label: 'All Searches', icon: <Search size={16} /> },
    ];

    return (
        <div className="insights-premium-container">
            <div className="insights-subtabs">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        aria-pressed={activeSubTab === t.key}
                        className={`insights-subtab-btn ${activeSubTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveSubTab(t.key)}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            <div className="insights-panel-animated" key={activeSubTab}>
                {activeSubTab === 'growth' && <WeeklyGrowthPanel />}
                {activeSubTab === 'whatsapp' && <WhatsAppBotPanel />}
                {activeSubTab === 'doctordekho' && <DoctorDekhoDailyPanel />}
                {activeSubTab === 'visits' && <SiteVisitsPanel />}
                {activeSubTab === 'logins' && <PatientLoginsPanel />}
                {activeSubTab === 'appointments' && <OnlineAppointmentsPanel />}
                {activeSubTab === 'authFunnel' && <AuthFunnelPanel />}
                {activeSubTab === 'bookingFunnel' && <BookingFunnelPanel />}
                {activeSubTab === 'searches' && <SearchLogPanel />}
            </div>
        </div>
    );
};

export default InsightsTab;
