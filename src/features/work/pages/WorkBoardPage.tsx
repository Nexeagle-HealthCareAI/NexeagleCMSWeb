import { useSearchParams } from 'react-router-dom';
import { FileText, FolderTree, Link2, ListChecks, Lock, UploadCloud } from 'lucide-react';
import WorkManagement from '../components/WorkManagement';
import '../work.css';

const TABS = [
  { key: 'work', label: 'Work management', Icon: ListChecks },
  { key: 'docs', label: 'Docs', Icon: FileText },
] as const;

/** Daily Work Board: the team's own tracker (tab 1) and document space (tab 2). */
export default function WorkBoardPage() {
  const [params, setParams] = useSearchParams();
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

      {tab === 'work' ? <WorkManagement /> : <DocsComingNext />}
    </div>
  );
}

function DocsComingNext() {
  const parts = [
    { Icon: FolderTree, title: 'Folders', text: 'Nested folders you arrange by drag and drop.' },
    { Icon: FileText, title: 'Written pages', text: 'A full editor for notes, specs and meeting minutes.' },
    { Icon: UploadCloud, title: 'Uploads', text: 'Word, PDF, Excel and image files, with preview and versions.' },
    { Icon: Lock, title: 'Sensitive folders', text: 'Locked to the people you name, with a log of every open.' },
    { Icon: Link2, title: 'Links to tasks', text: 'Tag a document in a task and open it in one click.' },
  ];
  return (
    <section className="wk-docs-next" aria-labelledby="wk-docs-h">
      <h2 id="wk-docs-h">Docs is being built next</h2>
      <p>Work management is ready to use now. This tab will hold the team's documents:</p>
      <ul>
        {parts.map(({ Icon, title, text }) => (
          <li key={title}><span className="wk-docs-ico"><Icon size={18} aria-hidden="true" /></span><span><strong>{title}</strong>{text}</span></li>
        ))}
      </ul>
    </section>
  );
}
