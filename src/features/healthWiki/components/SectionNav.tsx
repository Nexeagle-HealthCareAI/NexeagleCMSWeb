import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { healthWikiService } from '../services/healthWikiService';
import type { NavCounts } from '../types';
import { REFRESH_EVENT } from './navEvents';

/** Switches between the Health Wiki areas of the CMS and shows how much is waiting for the team. */
export default function SectionNav() {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      healthWikiService.navCounts().then((c) => { if (alive) setCounts(c); }).catch(() => { if (alive) setCounts(null); });
    };
    load();
    window.addEventListener(REFRESH_EVENT, load);
    return () => { alive = false; window.removeEventListener(REFRESH_EVENT, load); };
  }, [pathname]);

  const cls = ({ isActive }: { isActive: boolean }) => `hw-nav${isActive ? ' on' : ''}`;
  return (
    <nav className="hw-navbar" aria-label="Health Wiki sections">
      <NavLink to="/health-wiki" end className={cls}>Articles</NavLink>
      <NavLink to="/health-wiki/contributors" className={cls}>
        Contributors{!!counts?.pendingContributors && <span className="hw-count" title="Waiting for verification or approval">{counts.pendingContributors}</span>}
      </NavLink>
      <NavLink to="/health-wiki/topics" className={cls}>
        Topic requests{!!counts?.openTopics && <span className="hw-count" title="Waiting for a decision">{counts.openTopics}</span>}
      </NavLink>
    </nav>
  );
}
