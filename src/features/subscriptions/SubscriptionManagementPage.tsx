import React, { useState } from 'react';
import { PlansTab } from './PlansTab';
import { ApprovalsTab } from './ApprovalsTab';
import './SubscriptionManagementPage.css';

type MainTab = 'plans' | 'approvals';

const SubscriptionManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<MainTab>('plans');

    return (
        <div className="subscription-mgmt-page">
            <div className="subscription-mgmt-header">
                <h1>Manage Subscription</h1>
                <p>Configure EasyHMS plans and review payment approvals — all in one place.</p>
            </div>

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
