import { NavLink } from 'react-router-dom';

/** Switches between the Health Wiki areas of the CMS. */
export default function SectionNav({ pendingContributors = 0 }: { pendingContributors?: number }) {
  const cls = ({ isActive }: { isActive: boolean }) => `hw-nav${isActive ? ' on' : ''}`;
  return (
    <nav className="hw-navbar" aria-label="Health Wiki sections">
      <NavLink to="/health-wiki" end className={cls}>Articles</NavLink>
      <NavLink to="/health-wiki/contributors" className={cls}>
        Contributors{pendingContributors > 0 && <span className="hw-count" title="Waiting for verification or approval">{pendingContributors}</span>}
      </NavLink>
    </nav>
  );
}
