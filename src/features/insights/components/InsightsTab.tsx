import React, { useState } from 'react';
import { SiteVisitsPanel } from './SiteVisitsPanel';
import { PatientLoginsPanel } from './PatientLoginsPanel';
import { OnlineAppointmentsPanel } from './OnlineAppointmentsPanel';
import { AuthFunnelPanel } from './AuthFunnelPanel';
import { BookingFunnelPanel } from './BookingFunnelPanel';
import { SearchLogPanel } from './SearchLogPanel';
import '../../dashboard/pages/PremiumHospitals.css';
import './Insights.css';

type InsightsSubTab = 'visits' | 'logins' | 'appointments' | 'authFunnel' | 'bookingFunnel' | 'searches';

export const InsightsTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<InsightsSubTab>('visits');

    const tabs: { key: InsightsSubTab; label: string }[] = [
        { key: 'visits', label: 'Site Visits' },
        { key: 'logins', label: 'Patient Logins' },
        { key: 'appointments', label: 'Appointments' },
        { key: 'authFunnel', label: 'Auth Funnel' },
        { key: 'bookingFunnel', label: 'Booking Funnel' },
        { key: 'searches', label: 'All Searches' },
    ];

    return (
        <div>
            <div className="insights-subtabs">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        className={`insights-subtab-btn ${activeSubTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveSubTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeSubTab === 'visits' && <SiteVisitsPanel />}
            {activeSubTab === 'logins' && <PatientLoginsPanel />}
            {activeSubTab === 'appointments' && <OnlineAppointmentsPanel />}
            {activeSubTab === 'authFunnel' && <AuthFunnelPanel />}
            {activeSubTab === 'bookingFunnel' && <BookingFunnelPanel />}
            {activeSubTab === 'searches' && <SearchLogPanel />}
        </div>
    );
};

export default InsightsTab;
