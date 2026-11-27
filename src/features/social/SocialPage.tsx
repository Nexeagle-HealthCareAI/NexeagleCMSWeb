import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import '../healthWiki/healthWiki.css';
import '../whatsapp/whatsapp.css';
import './social.css';
import { SOCIAL_MOCK, socialCan } from './access';
import { socialService, socialError } from './services/socialService';
import type { SocialAccount } from './types';
import PostsTab from './components/PostsTab';
import ComposeTab from './components/ComposeTab';
import CalendarTab from './components/CalendarTab';
import InboxTab from './components/InboxTab';
import LeadsTab from './components/LeadsTab';
import AdsTab from './components/AdsTab';
import SetupTab from './components/SetupTab';

// Social: the Facebook Page and Instagram account. Every post (also those made outside the CMS) with its
// numbers; writing, approving and scheduling posts; Messenger, Instagram messages and comments in one inbox;
// leads from lead forms, chats and comments (straight into the CRM); ad spend and cost per lead.
// Design: project doc claude/social-facebook-instagram-design.md.

export const SOCIAL_TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'compose', label: 'Compose' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'leads', label: 'Leads' },
  { id: 'ads', label: 'Ads' },
  { id: 'setup', label: 'Setup' },
] as const;
type TabId = (typeof SOCIAL_TABS)[number]['id'];

const KEY = 'cms.social.account';
const remembered = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const remember = (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* private window */ } };

export default function SocialPage() {
  const { tab, id: routeId } = useParams<{ tab?: string; id?: string }>();
  const perms = useAuthStore(s => s.permissions) || [];
  const can = socialCan(perms);
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(remembered());
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    socialService.accounts()
      .then(list => {
        if (!live) return;
        setAccounts(list);
        setError(null);
        setAccountId(cur => (cur && list.some(a => a.accountId === cur) ? cur : list[0]?.accountId ?? null));
      })
      .catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [version]);

  useEffect(() => {
    if (!accountId) return;
    let live = true;
    socialService.unread(accountId).then(n => { if (live) setUnread(n); }).catch(() => { /* badge only */ });
    return () => { live = false; };
  }, [accountId, tab]);

  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const pick = (id: string) => { setAccountId(id); remember(id); };

  if (tab && !SOCIAL_TABS.some(t => t.id === tab)) return <Navigate to="/social" replace />;
  const current: TabId = (tab as TabId) || 'posts';
  const account = accounts?.find(a => a.accountId === accountId) ?? null;
  const visible = SOCIAL_TABS.filter(t => t.id !== 'ads' || can.ads);

  return (
    <div className="hw-page wa-page sc-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><Share2 size={24} /> Social</h1>
          <p className="hw-sub sc-assets">
            {account?.pageName && <span><i className="sc-dot sc-fb" />Facebook · {account.pageName}</span>}
            {account?.igUsername && <span><i className="sc-dot sc-ig" />Instagram · @{account.igUsername}</span>}
            {account?.adAccountName && can.ads && <span>Ad account · {account.adAccountName}</span>}
            {!account?.pageName && 'Facebook and Instagram: posts, comments and messages, leads and ads.'}
            {SOCIAL_MOCK && <span className="hw-tag">Example data</span>}
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
      {accounts && account && !account.connected && current !== 'setup' && (
        <div className="wa-banner" role="status">
          <b>{account.name} is not connected to Facebook and Instagram yet.</b> {can.connect ? <Link to="/social/setup">Open Setup</Link> : 'Someone with “Connect social accounts” finishes this in Setup.'}
        </div>
      )}

      <div className="hw-panel">
        <nav className="hw-tabs" aria-label="Social">
          {visible.map(t => (
            <NavLink key={t.id} to={t.id === 'posts' ? '/social' : `/social/${t.id}`} end className={() => `hw-tab${current === t.id ? ' on' : ''}`}>
              {t.label}
              {t.id === 'inbox' && !!unread && <span className="sc-badge" aria-label={`${unread} unanswered`}>{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="wa-body">
          {accounts == null && !error && <p className="hw-muted wa-pad">Loading…</p>}
          {accounts && accounts.length === 0 && current !== 'setup' && (
            <div className="wa-pad">
              <p className="hw-muted">No Facebook Page or Instagram account is connected yet.</p>
              {can.connect && <Link className="hw-btn hw-btn-primary" to="/social/setup">Open Setup</Link>}
            </div>
          )}
          {accounts && (account || current === 'setup') && (
            <>
              {current === 'posts' && account && <PostsTab key={account.accountId} account={account} can={can} />}
              {current === 'compose' && account && <ComposeTab key={account.accountId + (routeId ?? '')} account={account} can={can} draftId={routeId} />}
              {current === 'calendar' && account && <CalendarTab key={account.accountId} account={account} can={can} />}
              {current === 'inbox' && account && <InboxTab key={account.accountId} account={account} can={can} onRead={() => setUnread(u => (u ? u - 1 : u))} />}
              {current === 'leads' && account && <LeadsTab key={account.accountId} account={account} can={can} />}
              {current === 'ads' && account && (can.ads ? <AdsTab key={account.accountId} account={account} /> : <Navigate to="/social" replace />)}
              {current === 'setup' && <SetupTab key={account?.accountId ?? 'none'} account={account} can={can} onChanged={refresh} onCreated={id => { pick(id); refresh(); }} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
