import React from 'react';
import { PlansTab } from '../subscriptions/PlansTab';
import { ReferralCodesTab } from '../subscriptions/ReferralCodesTab';
import { InsightsTab } from '../insights/components/InsightsTab';
import { RouterAgentsTab } from '../routerAgents/pages/RouterAgentsTab';
import { HospitalOperationsTab } from '../operations/components/HospitalOperationsTab';
import '../dashboard/pages/PremiumHospitals.css';

/**
 * Pages that used to be tabs inside other pages (Manage Subscription, Doctor
 * Dekho, Onboarded Hospitals) and now have their own place in the menu.
 * Each one renders the same component as before, under a plain page heading.
 */
export { default as ApprovalsPage } from '../approvals/ApprovalsInbox';

const PageHead: React.FC<{ title: string; sub: string; children?: React.ReactNode }> = ({ title, sub, children }) => (
    <header className="ne-page-head">
        <div>
            <h1>{title}</h1>
            <p>{sub}</p>
        </div>
        {children}
    </header>
);

export const PlansPage: React.FC = () => (
    <div className="ne-page">
        <PageHead title="Plans & prices" sub="The 1HMS plans customers can choose, and what each costs." />
        <PlansTab />
    </div>
);

export const ReferralCodesPage: React.FC = () => (
    <div className="ne-page">
        <PageHead title="Referral codes" sub="Codes that give a discount or extra months when a customer pays." />
        <ReferralCodesTab />
    </div>
);

export const InsightsPage: React.FC = () => (
    <div className="ne-page">
        <PageHead title="Patient app insights" sub="Doctor Dekho visits, sign-ins, bookings and searches." />
        <InsightsTab />
    </div>
);

export const SymptomRouterPage: React.FC = () => (
    <div className="ne-page">
        <PageHead title="Symptom router" sub="How the router sends patients to the right doctor, and what it is learning." />
        <RouterAgentsTab />
    </div>
);

export const FreeTierPage: React.FC = () => (
    <div className="ne-page">
        <PageHead title="Free tier & night jobs" sub="Free-plan limits for 1HMS hospitals and the jobs that run overnight." />
        <HospitalOperationsTab />
    </div>
);
