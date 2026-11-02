import React, { useState } from 'react';
import { SiteVisitsPanel } from './SiteVisitsPanel';
import { PatientLoginsPanel } from './PatientLoginsPanel';
import { OnlineAppointmentsPanel } from './OnlineAppointmentsPanel';
import { AuthFunnelPanel } from './AuthFunnelPanel';
import { BookingFunnelPanel } from './BookingFunnelPanel';
import { SearchLogPanel } from './SearchLogPanel';
import { BarChart3, Users, CalendarDays, KeyRound, Filter, Search } from 'lucide-react';
import '../../dashboard/pages/PremiumHospitals.css';
import './Insights.css';

type InsightsSubTab = 'visits' | 'logins' | 'appointments' | 'authFunnel' | 'bookingFunnel' | 'searches';

export const InsightsTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<InsightsSubTab>('visits');

    const tabs: { key: InsightsSubTab; label: string; icon: React.ReactNode }[] = [
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
                        className={`insights-subtab-btn ${activeSubTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveSubTab(t.key)}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            <div className="insights-panel-animated" key={activeSubTab}>
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
