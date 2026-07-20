import React, { useState } from 'react';
import { PlansTab } from './PlansTab';
import { ApprovalsTab } from './ApprovalsTab';
import '../../dashboard/pages/PremiumHospitals.css';
import './SubscriptionManagementPage.css';

type MainTab = 'plans' | 'approvals';

const SubscriptionManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<MainTab>('plans');

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Manage Subscription</h1>
                    <p className="premium-subtitle">Configure EasyHMS plans and review payment approvals — all in one place.</p>
                </div>
            </header>

            <div className="subscription-mgmt-tabs">
                <button
                    className={`subscription-mgmt-tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
                    onClick={() => setActiveTab('plans')}
                >
                    Plans
                </button>
                <button
                    className={`subscription-mgmt-tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('approvals')}
                >
                    Approvals
                </button>
            </div>

            {activeTab === 'plans' ? <PlansTab /> : <ApprovalsTab />}
        </div>
    );
};

export default SubscriptionManagementPage;
