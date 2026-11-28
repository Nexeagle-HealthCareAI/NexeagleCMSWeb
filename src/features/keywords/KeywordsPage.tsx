import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import '../healthWiki/healthWiki.css';
import '../whatsapp/whatsapp.css';
import '../social/social.css';
import '../google/google.css';
import './keywords.css';
import { KEYWORDS_MOCK, keywordsCan } from './access';
import { keywordsService } from './services/keywordsService';
import type { Site } from './types';
import { istTime } from './keywordUtils';
import { SitePicker } from './components/shared';
import OverviewTab from './components/OverviewTab';
import KeywordsTab from './components/KeywordsTab';
import TopicsTab from './components/TopicsTab';
import ContentTab from './components/ContentTab';
import SetupTab from './components/SetupTab';

// Keywords: every search phrase for Doctor Dekho and nexeagle.com in one place, collected each morning from Search
// Console, Google Ads, Keyword Planner and Doctor Dekho's own search; grouped into topics, ranked by opportunity and
// turned into a content plan in English, Hindi, Hinglish and Bengali.
// Design: project doc claude/keyword-content-engine-plan.md and the "CMS Keywords section" canvas.

export const KEYWORD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'topics', label: 'Topics' },
  { id: 'content', label: 'Content plan' },
  { id: 'setup', label: 'Setup' },
] as const;
type TabId = (typeof KEYWORD_TABS)[number]['id'];

const KEY = 'cms.keywords.site';
const remembered = (): Site | '' => { try { const v = localStorage.getItem(KEY); return v === 'doctordekho' || v === 'nexeagle' ? v : ''; } catch { return ''; } };
const remember = (s: Site | '') => { try { localStorage.setItem(KEY, s); } catch { /* private window */ } };

export default function KeywordsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const perms = useAuthStore(s => s.permissions) || [];
  const can = keywordsCan(perms);
  const [site, setSite] = useState<Site | ''>(remembered());
  const [collected, setCollected] = useState<{ at?: string | null; sources: number } | null>(null);
  const [opportunities, setOpportunities] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    keywordsService.topics(site).then(t => { if (live) setOpportunities(t.filter(x => x.reason).length); }).catch(() => { /* the tab shows the error */ });
    keywordsService.overview(site)
      .then(o => { if (live) setCollected({ at: o.collectedAt, sources: o.sources.filter(s => s.state === 'ok').length }); })
      .catch(() => { /* the tab shows the error */ });
    return () => { live = false; };
  }, [site, version]);

  const changed = useCallback(() => setVersion(v => v + 1), []);
  const pick = (s: Site | '') => { setSite(s); remember(s); };

  if (tab && !KEYWORD_TABS.some(t => t.id === tab)) return <Navigate to="/keywords" replace />;
  const current: TabId = (tab as TabId) || 'overview';

  return (
    <div className="hw-page wa-page sc-page gg-page kw-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><Search size={24} /> Keywords</h1>
          <p className="hw-sub">
            {collected?.at ? `Collected ${istTime(collected.at)} from ${collected.sources} source${collected.sources === 1 ? '' : 's'} · last 28 days compared with the 28 before`
              : 'What people in India search for, from Search Console, Google Ads, Keyword Planner and Doctor Dekho’s own search, in one place.'}
            {KEYWORDS_MOCK && <span className="hw-tag">Example data</span>}
          </p>
        </div>
        {current !== 'setup' && <SitePicker value={site} onChange={pick} />}
      </div>

      <div className="hw-panel">
        <nav className="hw-tabs" aria-label="Keywords">
          {KEYWORD_TABS.map(t => (
            <NavLink key={t.id} to={t.id === 'overview' ? '/keywords' : `/keywords/${t.id}`} end className={() => `hw-tab${current === t.id ? ' on' : ''}`}>
              {t.label}{t.id === 'topics' && opportunities > 0 && <span className="kw-badge" aria-label={`${opportunities} with an opportunity`}>{opportunities}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="wa-body">
          {current === 'overview' && <OverviewTab site={site} />}
          {current === 'keywords' && <KeywordsTab site={site} can={can} onChanged={changed} />}
          {current === 'topics' && <TopicsTab site={site} can={can} onChanged={changed} />}
          {current === 'content' && <ContentTab site={site} can={can} onChanged={changed} />}
          {current === 'setup' && <SetupTab can={can} onChanged={changed} />}
        </div>
      </div>
    </div>
  );
}
