import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { canSeeSensitiveDocs } from '../access';
import { dayLabel, describeActivity, isFlagged, SOURCE_LABEL } from '../activityMeta';
import type { ActivitySource, WorkActivity, WorkProject, WorkUser } from '../types';
import { errorMessage, workService } from '../services/workService';
import { Avatar } from './parts';

const PAGE = 100;
const PERIODS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: -1 },
] as const;
type Period = typeof PERIODS[number]['key'];

function startOf(period: Period): string | undefined {
  const p = PERIODS.find(x => x.key === period)!;
  if (p.days < 0) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - p.days);
  return d.toISOString();
}
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Tab 3 of the Daily Work Board: who did what, newest first. Needs the work.audit permission. */
export default function ActivityTab() {
  const navigate = useNavigate();
  const showDocs = canSeeSensitiveDocs(useAuthStore(s => s.permissions) || []);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [source, setSource] = useState<ActivitySource | ''>('');
  const [period, setPeriod] = useState<Period>('7');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [rows, setRows] = useState<WorkActivity[]>([]);
  /** The choices the rows on screen were loaded for; anything else means a load is under way. */
  const [loadedFor, setLoadedFor] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([workService.users(), workService.projects()])
      .then(([u, p]) => { if (alive) { setUsers(u); setProjects(p); } })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const query = useMemo(() => ({
    userId: userId || undefined, projectId: projectId || undefined, source: source || undefined, from: startOf(period), take: PAGE,
  }), [userId, projectId, source, period]);

  const wanted = `${JSON.stringify(query)}#${version}`;
  const loading = loadedFor !== wanted;
  useEffect(() => {
    let alive = true;
    workService.activity(query)
      .then(list => { if (!alive) return; setRows(list); setMore(list.length === PAGE); setError(''); })
      .catch(e => { if (alive) { setRows([]); setError(errorMessage(e, 'Could not load the activity log.')); } })
      .finally(() => { if (alive) setLoadedFor(wanted); });
    return () => { alive = false; };
  }, [query, wanted]);

  const loadMore = useCallback(async () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    try {
      const next = await workService.activity({ ...query, before: last.createdAt });
      setRows(prev => [...prev, ...next]);
      setMore(next.length === PAGE);
    } catch (e) {
      setError(errorMessage(e, 'Could not load more.'));
    }
  }, [rows, query]);

  const shown = flaggedOnly ? rows.filter(isFlagged) : rows;
  const days = useMemo(() => {
    const groups: { day: string; rows: WorkActivity[] }[] = [];
    for (const row of shown) {
      const day = dayLabel(row.createdAt);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.day === day) lastGroup.rows.push(row); else groups.push({ day, rows: [row] });
    }
    return groups;
  }, [shown]);

  const sources = (Object.keys(SOURCE_LABEL) as ActivitySource[]).filter(s => s !== 'docs' || showDocs);

  return (
    <div className="wk-activity">
      <div className="wk-filters">
        <select value={userId} onChange={e => setUserId(e.target.value)} aria-label="Person">
          <option value="">Everyone</option>
          {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
        </select>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} aria-label="Board">
          <option value="">All boards</option>
          {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.key} · {p.name}</option>)}
        </select>
        <select value={source} onChange={e => setSource(e.target.value as ActivitySource | '')} aria-label="Kind of activity">
          <option value="">Every kind</option>
          {sources.map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Period">
          {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <label className="wk-check wk-activity-flag">
          <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
          <span><AlertTriangle size={15} aria-hidden="true" /> Needs a look only</span>
        </label>
        <button type="button" className="wk-btn" onClick={() => setVersion(v => v + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
      </div>
      {projectId && <p className="wk-hint">Documents and visits do not belong to one board, so they are left out while a board is chosen.</p>}

      {error && <p className="wk-error" role="alert">{error}</p>}
      {loading ? <p className="wk-muted">Loading activity…</p> : shown.length === 0 ? (
        <div className="wk-empty"><h2>Nothing here</h2><p>No activity matches these choices. Try a longer period.</p></div>
      ) : (
        <div className="wk-activity-list" aria-label="Activity log">
          {days.map(group => (
            <section key={group.day}>
              <h3>{group.day}</h3>
              <ul>
                {group.rows.map((a, i) => (
                  <li key={`${a.createdAt}-${i}`} className={isFlagged(a) ? 'is-flagged' : ''}>
                    <time dateTime={a.createdAt}>{time(a.createdAt)}</time>
                    <Avatar name={a.actorName} />
                    <p>
                      <strong>{a.actorName}</strong> {describeActivity(a)}
                      {a.workItemId && (
                        <> · <button type="button" className="wk-link" onClick={() => navigate(`/work?item=${encodeURIComponent(a.workItemId!)}`)}>{a.itemKey}</button> <span className="wk-muted">{a.itemTitle}</span></>
                      )}
                      {a.source === 'docs' && a.documentId && (
                        <> <button type="button" className="wk-link" onClick={() => navigate(`/work?tab=docs&doc=${encodeURIComponent(a.documentId!)}`)}>Open</button></>
                      )}
                      {a.source === 'sessions' && a.detail && <small>{a.detail}</small>}
                    </p>
                    {isFlagged(a) && <AlertTriangle size={16} className="wk-activity-mark" aria-label="Needs a look" />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && !flaggedOnly && <button type="button" className="wk-btn" onClick={() => void loadMore()}>Load older activity</button>}
        </div>
      )}
    </div>
  );
}
