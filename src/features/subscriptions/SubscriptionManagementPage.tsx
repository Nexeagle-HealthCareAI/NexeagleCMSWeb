import React, { useState } from 'react';
import { PlansTab } from './PlansTab';
import { ApprovalsTab } from './ApprovalsTab';
import { RadApprovalsTab } from './RadApprovalsTab';
import { ReferralCodesTab } from './ReferralCodesTab';
import '../dashboard/pages/PremiumHospitals.css';
import './SubscriptionManagementPage.css';

type MainTab = 'plans' | 'approvals' | 'rad-approvals' | 'referral-codes';

const SubscriptionManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<MainTab>('plans');

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Manage Subscription</h1>
                    <p className="premium-subtitle">Configure EasyHMS plans and review EasyHMS and 1Rad payment approvals — all in one place.</p>
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
                    className={`subscription-mgmt-tab-btn ${activeTab === 'rad-approvals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rad-approvals')}
                >
                    1Rad Approvals
                </button>
                <button
                    className={`subscription-mgmt-tab-btn ${activeTab === 'referral-codes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('referral-codes')}
                >
                    Referral Codes
                </button>
            </div>

            {activeTab === 'plans' ? <PlansTab />
                : activeTab === 'approvals' ? <ApprovalsTab />
                : activeTab === 'rad-approvals' ? <RadApprovalsTab />
                : <ReferralCodesTab />}
        </div>
    );
};

export default SubscriptionManagementPage;
