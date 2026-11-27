import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import '../healthWiki/healthWiki.css';
import '../whatsapp/whatsapp.css';
import '../social/social.css';
import './google.css';
import { GOOGLE_MOCK, googleCan } from './access';
import { googleService, googleError } from './services/googleService';
import type { GoogleAccount } from './types';
import { SITES } from './googleUtils';
import OverviewTab from './components/OverviewTab';
import PagesTab from './components/PagesTab';
import AdsTab from './components/AdsTab';
import LeadsTab from './components/LeadsTab';
import SetupTab from './components/SetupTab';

// Google: Google Analytics, Google Ads, Search Console and Google lead forms, one account per website (nexeagle.com,
// Doctor Dekho). Numbers are read live from Google; leads land in the CRM; CRM results go back to Google Ads.
// Design: project doc claude/google-analytics-ads-plan.md and the "CMS Google section" canvas.

export const GOOGLE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'ads', label: 'Ads' },
  { id: 'leads', label: 'Leads' },
  { id: 'setup', label: 'Setup' },
] as const;
type TabId = (typeof GOOGLE_TABS)[number]['id'];

const KEY = 'cms.google.account';
const remembered = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const remember = (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* private window */ } };

export default function GooglePage() {
  const { tab } = useParams<{ tab?: string }>();
  const perms = useAuthStore(s => s.permissions) || [];
  const can = googleCan(perms);
  const [accounts, setAccounts] = useState<GoogleAccount[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(remembered());
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    googleService.accounts()
      .then(list => {
        if (!live) return;
        setAccounts(list);
        setError(null);
        setAccountId(cur => (cur && list.some(a => a.accountId === cur) ? cur : list[0]?.accountId ?? null));
      })
      .catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [version]);

  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const pick = (id: string) => { setAccountId(id); remember(id); };

  if (tab && !GOOGLE_TABS.some(t => t.id === tab)) return <Navigate to="/google" replace />;
  const current: TabId = (tab as TabId) || 'overview';
  if (current === 'ads' && !can.ads) return <Navigate to="/google" replace />;
  const account = accounts?.find(a => a.accountId === accountId) ?? null;
  const visible = GOOGLE_TABS.filter(t => t.id !== 'ads' || can.ads);
  const site = SITES.find(s => s.id === account?.site)?.label;
  const needsSetup = account && (!account.signedIn || !account.hasAnalytics);

  return (
    <div className="hw-page wa-page sc-page gg-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><LineChart size={24} /> Google</h1>
          <p className="hw-sub sc-assets">
            {site && <span>Website · {site}</span>}
            {account?.ga4PropertyName && <span><i className="sc-dot gg-ga" />Analytics · {account.ga4PropertyName}</span>}
            {account?.adsAccountName && can.ads && <span><i className="sc-dot gg-ads" />Google Ads · {account.adsAccountName}</span>}
            {!account?.ga4PropertyName && 'Google Analytics, Google Ads, Search Console and Google lead forms for each website.'}
            {GOOGLE_MOCK && <span className="hw-tag">Example data</span>}
          </p>
        </div>
        {accounts && accounts.length > 0 && (
          <label className="sc-switch">
            <span>Account</span>
            <select value={accountId ?? ''} onChange={e => pick(e.target.value)} aria-label="Account">
              {accounts.map(a => <option key={a.accountId} value={a.accountId}>{a.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && <div className="wa-banner" role="status">{error}</div>}
      {needsSetup && current !== 'setup' && (
        <div className="wa-banner" role="status">
          <b>{account.name} is not connected to Google yet.</b> {can.connect ? <Link to="/google/setup">Open Setup</Link> : 'Someone with “Connect Google accounts” finishes this in Setup.'}
        </div>
      )}

      <div className="hw-panel">
        <nav className="hw-tabs" aria-label="Google">
          {visible.map(t => (
            <NavLink key={t.id} to={t.id === 'overview' ? '/google' : `/google/${t.id}`} end className={() => `hw-tab${current === t.id ? ' on' : ''}`}>{t.label}</NavLink>
          ))}
        </nav>
        <div className="wa-body">
          {accounts == null && !error && <p className="hw-muted wa-pad">Loading…</p>}
          {accounts && accounts.length === 0 && current !== 'setup' && (
            <div className="wa-pad">
              <p className="hw-muted">No website is connected to Google yet.</p>
              {can.connect && <Link className="hw-btn hw-btn-primary" to="/google/setup">Open Setup</Link>}
            </div>
          )}
          {accounts && (account || current === 'setup') && (
            <>
              {current === 'overview' && account && <OverviewTab key={account.accountId} account={account} />}
              {current === 'pages' && account && <PagesTab key={account.accountId} account={account} />}
              {current === 'ads' && account && <AdsTab key={account.accountId} account={account} />}
              {current === 'leads' && account && <LeadsTab key={account.accountId} account={account} />}
              {current === 'setup' && <SetupTab key={account?.accountId ?? 'none'} account={account} can={can} onChanged={refresh} onCreated={id => { pick(id); refresh(); }} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
