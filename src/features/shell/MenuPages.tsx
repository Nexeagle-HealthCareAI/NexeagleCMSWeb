import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApprovalsTab } from '../subscriptions/ApprovalsTab';
import { RadApprovalsTab } from '../subscriptions/RadApprovalsTab';
import { PlansTab } from '../subscriptions/PlansTab';
import { ReferralCodesTab } from '../subscriptions/ReferralCodesTab';
import { InsightsTab } from '../insights/components/InsightsTab';
import { RouterAgentsTab } from '../routerAgents/pages/RouterAgentsTab';
import { HospitalOperationsTab } from '../operations/components/HospitalOperationsTab';
import { useCountsStore } from '../../store/useCountsStore';
import '../dashboard/pages/PremiumHospitals.css';

/**
 * Pages that used to be tabs inside other pages (Manage Subscription, Doctor
 * Dekho, Onboarded Hospitals) and now have their own place in the menu.
 * Each one renders the same component as before, under a plain page heading.
 */
const PageHead: React.FC<{ title: string; sub: string; children?: React.ReactNode }> = ({ title, sub, children }) => (
    <header className="ne-page-head">
        <div>
            <h1>{title}</h1>
            <p>{sub}</p>
        </div>
        {children}
    </header>
);

export const ApprovalsPage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const product = params.get('product') === '1rad' ? '1rad' : '1hms';
    const hms = useCountsStore(s => s.hmsPending);
    const rad = useCountsStore(s => s.radPending);
    const refresh = useCountsStore(s => s.refreshApprovals);
    const pick = (p: '1hms' | '1rad') => setParams(p === '1rad' ? { product: '1rad' } : {}, { replace: true });
    // Re-count when leaving the page, so the menu badge reflects anything approved here.
    React.useEffect(() => () => { void refresh(); }, [refresh]);
    return (
        <div className="ne-page">
            <PageHead title="Payment approvals" sub="A plan starts only after you approve its payment.">
                <div className="ne-seg" role="tablist" aria-label="Product">
                    <button type="button" role="tab" aria-selected={product === '1hms'} className={product === '1hms' ? 'is-on' : ''} onClick={() => pick('1hms')}>
                        1HMS{hms > 0 && <span className="ne-seg-count">{hms}</span>}
                    </button>
                    <button type="button" role="tab" aria-selected={product === '1rad'} className={product === '1rad' ? 'is-on' : ''} onClick={() => pick('1rad')}>
                        1Rad{rad > 0 && <span className="ne-seg-count">{rad}</span>}
                    </button>
                </div>
            </PageHead>
            {product === '1rad' ? <RadApprovalsTab key="rad" /> : <ApprovalsTab key="hms" />}
        </div>
    );
};

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
