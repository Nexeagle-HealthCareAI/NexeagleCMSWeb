import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, History, ListChecks, MessagesSquare } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { canAuditWork, canExportWork, canViewDocs } from '../access';
import ActivityTab from '../components/ActivityTab';
import ChatTab from '../components/ChatTab';
import PresenceBar from '../components/PresenceBar';
import ScreenGuard, { ProtectedBadge } from '../components/ScreenGuard';
import WorkManagement from '../components/WorkManagement';
import DocsTab from '../docs/DocsTab';
import '../work.css';
import '../docs/docs.css';

const TABS = [
  { key: 'work', label: 'Work management', Icon: ListChecks },
  { key: 'docs', label: 'Docs', Icon: FileText },
  { key: 'chat', label: 'Chat', Icon: MessagesSquare },
  { key: 'activity', label: 'Activity', Icon: History },
] as const;

/** Daily Work Board: the team's own tracker (tab 1) and document space (tab 2). */
export default function WorkBoardPage() {
  const [params, setParams] = useSearchParams();
  const permissions = useAuthStore(s => s.permissions) || [];
  const audit = canAuditWork(permissions);
  const asked = params.get('tab');
  const tab = asked === 'docs' ? 'docs' : asked === 'chat' ? 'chat' : asked === 'activity' && audit ? 'activity' : 'work';
  const [unreadChat, setUnreadChat] = useState(0);
  const guarded = !canExportWork(permissions);

  const choose = (key: string) => {
    const next = new URLSearchParams();
    if (key !== 'work') next.set('tab', key);
    setParams(next);
  };

  return (
    <div className="ne-page wk-page">
      {guarded && <ScreenGuard />}
      <header className="ne-page-head">
        <div>
          <h1>Daily Work Board {guarded && <ProtectedBadge />}</h1>
          <p>Plan, track and finish the team's work in one place.</p>
        </div>
      </header>
      <PresenceBar onUnread={setUnreadChat} />

      <div className="ne-tabsbar" role="tablist" aria-label="Daily Work Board">
        {TABS.filter(t => t.key !== 'activity' || audit).map(({ key, label, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`ne-tabsbar-item wk-tab ${tab === key ? 'is-on' : ''}`} onClick={() => choose(key)}>
            <Icon size={17} aria-hidden="true" /> {label}
            {key === 'chat' && unreadChat > 0 && <span className="wk-badge" aria-label={`${unreadChat} unread`}>{unreadChat > 99 ? '99+' : unreadChat}</span>}
          </button>
        ))}
      </div>

      {tab === 'chat' ? <ChatTab /> : tab === 'activity' ? <ActivityTab /> : tab === 'work' ? <WorkManagement /> : canViewDocs(permissions) ? <DocsTab /> : (
        <div className="wk-empty">
          <h2>You do not have access to Docs</h2>
          <p>Ask an administrator for the “View documents” permission, then sign in again.</p>
        </div>
      )}
    </div>
  );
}
