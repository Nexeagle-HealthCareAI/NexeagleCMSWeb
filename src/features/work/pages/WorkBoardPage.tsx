import { useSearchParams } from 'react-router-dom';
import { FileText, ListChecks } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { canViewDocs } from '../access';
import WorkManagement from '../components/WorkManagement';
import DocsTab from '../docs/DocsTab';
import '../work.css';
import '../docs/docs.css';

const TABS = [
  { key: 'work', label: 'Work management', Icon: ListChecks },
  { key: 'docs', label: 'Docs', Icon: FileText },
] as const;

/** Daily Work Board: the team's own tracker (tab 1) and document space (tab 2). */
export default function WorkBoardPage() {
  const [params, setParams] = useSearchParams();
  const permissions = useAuthStore(s => s.permissions) || [];
  const tab = params.get('tab') === 'docs' ? 'docs' : 'work';

  const choose = (key: string) => {
    const next = new URLSearchParams();
    if (key !== 'work') next.set('tab', key);
    setParams(next);
  };

  return (
    <div className="ne-page wk-page">
      <header className="ne-page-head">
        <div>
          <h1>Daily Work Board</h1>
          <p>Plan, track and finish the team's work in one place.</p>
        </div>
      </header>

      <div className="ne-tabsbar" role="tablist" aria-label="Daily Work Board">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`ne-tabsbar-item wk-tab ${tab === key ? 'is-on' : ''}`} onClick={() => choose(key)}>
            <Icon size={17} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === 'work' ? <WorkManagement /> : canViewDocs(permissions) ? <DocsTab /> : (
        <div className="wk-empty">
          <h2>You do not have access to Docs</h2>
          <p>Ask an administrator for the “View documents” permission, then sign in again.</p>
        </div>
      )}
    </div>
  );
}
