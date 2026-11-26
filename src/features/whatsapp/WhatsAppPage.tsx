import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import '../healthWiki/healthWiki.css';
import './whatsapp.css';
import { WA_MOCK, waCan } from './access';
import { waService, waError } from './services/waService';
import type { WaNumber } from './types';
import InboxTab from './components/InboxTab';
import BroadcastsTab from './components/BroadcastsTab';
import TemplatesTab from './components/TemplatesTab';
import ContactsTab from './components/ContactsTab';
import BillingTab from './components/BillingTab';
import SettingsTab from './components/SettingsTab';
import SetupTab from './components/SetupTab';

// WhatsApp: the CMS's own marketing number (not the Doctor Dekho bot's). Inbox, broadcasts,
// templates and their approval, contacts and opt-in, spend against the budget, business profile.
// Design: project doc claude/whatsapp-marketing-design.md.

export const WA_TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'broadcasts', label: 'Broadcasts' },
  { id: 'templates', label: 'Templates' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'billing', label: 'Billing' },
  { id: 'settings', label: 'Settings' },
  { id: 'setup', label: 'Setup' },
] as const;
type TabId = (typeof WA_TABS)[number]['id'];

export default function WhatsAppPage() {
  const { tab } = useParams<{ tab?: string }>();
  const perms = useAuthStore(s => s.permissions) || [];
  const can = waCan(perms);
  const [number, setNumber] = useState<WaNumber | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [numberVersion, setNumberVersion] = useState(0);

  useEffect(() => {
    let live = true;
    waService.number()
      .then(n => { if (live) { setNumber(n); setNumberError(null); } })
      .catch(e => { if (live) setNumberError(waError(e)); });
    return () => { live = false; };
  }, [numberVersion]);

  if (tab && !WA_TABS.some(t => t.id === tab)) return <Navigate to="/whatsapp" replace />;
  const current: TabId = (tab as TabId) || 'inbox';

  return (
    <div className="hw-page wa-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><MessageCircle size={24} /> WhatsApp</h1>
          <p className="hw-sub">
            {number?.connected
              ? <>Marketing number <b>{number.displayPhone}</b>{number.verifiedName ? <> · {number.verifiedName}</> : null}</>
              : 'The marketing number: chats, broadcasts, templates and spend.'}
            {WA_MOCK && <span className="hw-tag">Example data</span>}
          </p>
        </div>
        {number?.connected && number.quality && (
          <span className={`wa-quality wa-q-${number.quality.toLowerCase()}`} title="Meta's quality rating for this number">
            Quality: {number.quality === 'GREEN' ? 'High' : number.quality === 'YELLOW' ? 'Medium' : number.quality === 'RED' ? 'Low' : number.quality}
          </span>
        )}
      </div>

      {(numberError || (number && !number.connected)) && current !== 'setup' && (
        <div className="wa-banner" role="status">
          <b>The WhatsApp number is not connected yet.</b> {number?.problem || numberError}
          {' '}<Link to="/whatsapp/setup">Open Setup</Link>
        </div>
      )}

      <div className="hw-panel">
        <nav className="hw-tabs" aria-label="WhatsApp">
          {WA_TABS.map(t => (
            <NavLink key={t.id} to={t.id === 'inbox' ? '/whatsapp' : `/whatsapp/${t.id}`} end className={() => `hw-tab${current === t.id ? ' on' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="wa-body">
          {current === 'inbox' && <InboxTab can={can} />}
          {current === 'broadcasts' && <BroadcastsTab can={can} />}
          {current === 'templates' && <TemplatesTab can={can} />}
          {current === 'contacts' && <ContactsTab can={can} />}
          {current === 'billing' && <BillingTab />}
          {current === 'settings' && <SettingsTab can={can} />}
          {current === 'setup' && <SetupTab can={can} onConnected={() => setNumberVersion(v => v + 1)} />}
        </div>
      </div>
    </div>
  );
}
