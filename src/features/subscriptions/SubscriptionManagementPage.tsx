import React, { useState } from 'react';
import { PlansTab } from './PlansTab';
import { ApprovalsTab } from './ApprovalsTab';
import { ReferralCodesTab } from './ReferralCodesTab';
import '../dashboard/pages/PremiumHospitals.css';
import './SubscriptionManagementPage.css';

type MainTab = 'plans' | 'approvals' | 'referral-codes';

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
                <button
                    className={`subscription-mgmt-tab-btn ${activeTab === 'referral-codes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('referral-codes')}
                >
                    Referral Codes
                </button>
            </div>

            {activeTab === 'plans' ? <PlansTab /> : activeTab === 'approvals' ? <ApprovalsTab /> : <ReferralCodesTab />}
        </div>
    );
};

export default SubscriptionManagementPage;
