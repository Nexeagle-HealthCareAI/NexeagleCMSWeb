import React, { useState } from 'react';
import { SiteVisitsPanel } from './SiteVisitsPanel';
import { PatientLoginsPanel } from './PatientLoginsPanel';
import { OnlineAppointmentsPanel } from './OnlineAppointmentsPanel';
import '../../dashboard/pages/PremiumHospitals.css';
import './Insights.css';

type InsightsSubTab = 'visits' | 'logins' | 'appointments';

export const InsightsTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<InsightsSubTab>('visits');

    return (
        <div>
            <div className="insights-subtabs">
                <button
                    className={`insights-subtab-btn ${activeSubTab === 'visits' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('visits')}
                >
                    Site Visits
                </button>
                <button
                    className={`insights-subtab-btn ${activeSubTab === 'logins' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('logins')}
                >
                    Patient Logins
                </button>
                <button
                    className={`insights-subtab-btn ${activeSubTab === 'appointments' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('appointments')}
                >
                    Appointments
                </button>
            </div>

            {activeSubTab === 'visits' && <SiteVisitsPanel />}
            {activeSubTab === 'logins' && <PatientLoginsPanel />}
            {activeSubTab === 'appointments' && <OnlineAppointmentsPanel />}
        </div>
    );
};

export default InsightsTab;
