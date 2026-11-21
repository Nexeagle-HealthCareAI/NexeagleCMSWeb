import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, CalendarClock, ChevronDown, ChevronRight, Columns3, List as ListIcon, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { canEditWork, canManageWork } from '../access';
import type { ItemStatus, ItemType, WorkItem, WorkProject, WorkUser } from '../types';
import { buildTree, formatDay, isOverdue, ITEM_TYPES, STATUSES, STATUS_LABEL, toUpdatePayload } from '../workMeta';
import { errorMessage, workService } from '../services/workService';
import { Avatar, PriorityMark, StatusPill, TypeIcon } from './parts';
import BoardView from './BoardView';
import CreateItemDialog from './CreateItemDialog';
import ItemDrawer from './ItemDrawer';
import NewProjectDialog from './NewProjectDialog';

const PROJECT_KEY = 'wk.project';
const remembered = (): string => { try { return localStorage.getItem(PROJECT_KEY) || ''; } catch { return ''; } };
const remember = (id: string) => { try { localStorage.setItem(PROJECT_KEY, id); } catch { /* private window: nothing to keep */ } };

type View = 'list' | 'board';
const VIEW_KEY = 'wk.view';
const rememberedView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'; } catch { return 'list'; } };

/** Tab 1 of the Daily Work Board: every item of one project, nested by parent, with filters. */
export default function WorkManagement() {
  const permissions = useAuthStore(s => s.permissions) || [];
  const me = useAuthStore(s => s.user);
  const canEdit = canEditWork(permissions);
  const canManage = canManageWork(permissions);
  const [params, setParams] = useSearchParams();
  const openId = params.get('item');

  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  const [query, setQuery] = useState('');
  const [type, setType] = useState<ItemType | ''>('');
  const [status, setStatus] = useState<ItemStatus | 'open' | ''>('');
  const [assignee, setAssignee] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ parent: WorkItem | null } | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [view, setView] = useState<View>(rememberedView);
  const chooseView = (next: View) => { setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* nothing to keep */ } };

  // Projects and people, once.
  useEffect(() => {
    let alive = true;
    Promise.all([workService.projects(), workService.users()])
      .then(([p, u]) => {
        if (!alive) return;
        const open = p.filter(x => !x.isArchived);
        setProjects(open);
        setUsers(u);
        const saved = remembered();
        setProjectId(open.some(x => x.projectId === saved) ? saved : open[0]?.projectId || '');
        if (open.length === 0) setLoading(false);
      })
      .catch(e => { if (alive) { setError(errorMessage(e, 'Could not load the work board.')); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  // Items of the chosen project; `version` loads them again after a change.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    workService.items(projectId)
      .then(list => { if (alive) { setItems(list); setError(''); } })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not load the items.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  const project = projects.find(p => p.projectId === projectId) || null;

  const chooseProject = (id: string) => {
    if (id === projectId) return;
    remember(id);
    setItems([]);
    setLoading(true);
    setProjectId(id);
    setCollapsed(new Set());
    closeItem();
  };

  const openItem = useCallback((id: string) => {
    setParams(prev => { const next = new URLSearchParams(prev); next.set('item', id); return next; });
  }, [setParams]);
  const closeItem = useCallback(() => {
    setParams(prev => { const next = new URLSearchParams(prev); next.delete('item'); return next; });
  }, [setParams]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ids = new Set<string>();
    for (const i of items) {
      if (type && i.itemType !== type) continue;
      if (status === 'open' ? i.status === 'Done' : status && i.status !== status) continue;
      if (assignee === 'none' ? i.assigneeUserId !== null : assignee && i.assigneeUserId !== assignee) continue;
      if (q && !(`${i.key} ${i.title} ${i.labels.join(' ')} ${i.assigneeName || ''}`.toLowerCase().includes(q))) continue;
      ids.add(i.workItemId);
    }
    return ids;
  }, [items, query, type, status, assignee]);

  const filtering = !!(query.trim() || type || status || assignee);
  // While filtering, nothing is collapsed: a match hidden inside a closed parent would look like no match.
  const rows = useMemo(() => buildTree(items, shown, filtering ? new Set() : collapsed), [items, shown, collapsed, filtering]);

  // The board shows the work itself. Epics and features are containers, so they stay in the list
  // unless the type filter asks for them.
  const boardItems = useMemo(
    () => items.filter(i => shown.has(i.workItemId) && (type ? true : i.itemType !== 'Epic' && i.itemType !== 'Feature')),
    [items, shown, type],
  );

  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = { ToDo: 0, InProgress: 0, InReview: 0, Done: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);
  const blocked = items.filter(i => i.isBlocked && i.status !== 'Done').length;

  const toggle = (id: string) => setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  /** Status straight from the list. The API wants the whole item, so it is read first. */
  const changeStatus = async (item: WorkItem, next: ItemStatus) => {
    const before = items;
    setItems(items.map(i => (i.workItemId === item.workItemId ? { ...i, status: next } : i)));
    try {
      const detail = await workService.item(item.workItemId);
      await workService.updateItem(item.workItemId, { ...toUpdatePayload(detail), status: next });
      reload();
    } catch (e) {
      setItems(before);
      toast.error(errorMessage(e, 'Could not change the status.'));
    }
  };

  const clearFilters = () => { setQuery(''); setType(''); setStatus(''); setAssignee(''); };

  if (!loading && projects.length === 0 && !error) {
    return (
      <div className="wk-empty">
        <h2>No projects yet</h2>
        <p>A project holds the work for one product, such as 1HMS or 1Rad.</p>
        {canManage ? <button type="button" className="wk-btn is-primary" onClick={() => setAddingProject(true)}><Plus size={16} aria-hidden="true" /> New project</button>
          : <p className="wk-muted">Ask an administrator to add the first project.</p>}
        {addingProject && <NewProjectDialog onClose={() => setAddingProject(false)} onCreated={p => { setProjects([p]); setProjectId(p.projectId); setAddingProject(false); }} />}
      </div>
    );
  }

  return (
    <div className={`wk-layout ${openId ? 'has-drawer' : ''}`}>
      <div className="wk-main">
        <div className="wk-bar">
          <div className="ne-seg" role="tablist" aria-label="Project">
            {projects.map(p => (
              <button key={p.projectId} type="button" role="tab" aria-selected={p.projectId === projectId} className={p.projectId === projectId ? 'is-on' : ''} onClick={() => chooseProject(p.projectId)} title={p.name}>
                {p.key}
              </button>
            ))}
            {canManage && <button type="button" onClick={() => setAddingProject(true)} aria-label="New project" title="New project"><Plus size={16} aria-hidden="true" /></button>}
          </div>
          <div className="wk-bar-right">
            <div className="ne-seg" role="group" aria-label="View">
              <button type="button" className={view === 'list' ? 'is-on' : ''} aria-pressed={view === 'list'} onClick={() => chooseView('list')}><ListIcon size={16} aria-hidden="true" /> List</button>
              <button type="button" className={view === 'board' ? 'is-on' : ''} aria-pressed={view === 'board'} onClick={() => chooseView('board')}><Columns3 size={16} aria-hidden="true" /> Board</button>
            </div>
            {canEdit && project && (
              <button type="button" className="wk-btn is-primary" onClick={() => setCreating({ parent: null })}><Plus size={16} aria-hidden="true" /> New item</button>
            )}
          </div>
        </div>

        {project && (
          <div className="wk-summary" aria-label={`${project.name} at a glance`}>
            <strong>{project.name}</strong>
            {STATUSES.map(s => <span key={s}><b>{counts[s]}</b> {STATUS_LABEL[s].toLowerCase()}</span>)}
            {blocked > 0 && <span className="is-blocked"><Ban size={14} aria-hidden="true" /><b>{blocked}</b> blocked</span>}
          </div>
        )}

        <div className="wk-filters">
          <label className="wk-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by key, title, label or person" aria-label="Search items" />
          </label>
          <select value={type} onChange={e => setType(e.target.value as ItemType | '')} aria-label="Type">
            <option value="">All types</option>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as ItemStatus | 'open' | '')} aria-label="Status">
            <option value="">All statuses</option>
            <option value="open">Not done</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Assignee">
            <option value="">Everyone</option>
            {me?.id && users.some(u => u.userId === me.id) && <option value={me.id}>Assigned to me</option>}
            <option value="none">Unassigned</option>
            {users.filter(u => u.userId !== me?.id).map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
          </select>
          {filtering && <button type="button" className="wk-link" onClick={clearFilters}>Clear</button>}
        </div>

        {error && <div className="wk-error" role="alert">{error} <button type="button" className="wk-link" onClick={() => { setLoading(true); reload(); }}>Try again</button></div>}

        {view === 'board' && !loading && items.length > 0 ? (
          <>
            <BoardView items={boardItems} openId={openId} canEdit={canEdit} onOpen={openItem} onMove={(item, next) => void changeStatus(item, next)} />
            <p className="wk-muted wk-board-note">
              {boardItems.length} cards{type ? '' : ' · epics and features are in the list view'}{canEdit ? ' · drag a card to change its status' : ''}
            </p>
          </>
        ) : (
        <div className="wk-card">
          {loading ? <p className="wk-muted wk-pad">Loading…</p> : rows.length === 0 ? (
            <div className="wk-empty is-inline">
              {items.length === 0 ? (
                <>
                  <h2>Nothing in {project?.name} yet</h2>
                  <p>Start with an epic for a large goal, or a task for a single job.</p>
                  {canEdit && <button type="button" className="wk-btn is-primary" onClick={() => setCreating({ parent: null })}><Plus size={16} aria-hidden="true" /> New item</button>}
                </>
              ) : (
                <>
                  <h2>No items match</h2>
                  <p>Try other words or clear the filters.</p>
                  <button type="button" className="wk-btn" onClick={clearFilters}>Clear filters</button>
                </>
              )}
            </div>
          ) : (
            <ul className="wk-list" aria-label="Work items">
              {rows.map(({ item, depth, hasChildren }) => {
                const closed = collapsed.has(item.workItemId) && !filtering;
                const dimmed = filtering && !shown.has(item.workItemId);
                return (
                  <li key={item.workItemId} className={`wk-row ${openId === item.workItemId ? 'is-open' : ''} ${dimmed ? 'is-dim' : ''} ${item.status === 'Done' ? 'is-done' : ''}`} style={{ paddingLeft: 12 + depth * 22 }}>
                    {hasChildren ? (
                      <button type="button" className="wk-caret" onClick={() => toggle(item.workItemId)} aria-expanded={!closed} aria-label={`${closed ? 'Show' : 'Hide'} items under ${item.key}`} disabled={filtering}>
                        {closed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                    ) : <span className="wk-caret" aria-hidden="true" />}
                    <TypeIcon type={item.itemType} />
                    <button type="button" className="wk-row-main" onClick={() => openItem(item.workItemId)}>
                      <span className="wk-key">{item.key}</span>
                      <span className="wk-row-title">{item.title}</span>
                    </button>
                    <span className="wk-row-tags">
                      {item.isBlocked && item.status !== 'Done' && <span className="wk-tag is-blocked" title={item.blockedReason || 'Blocked'}><Ban size={12} aria-hidden="true" /> Blocked</span>}
                      {item.dueDate && <span className={`wk-tag ${isOverdue(item) ? 'is-late' : ''}`} title={isOverdue(item) ? 'Past its due date' : 'Due date'}><CalendarClock size={12} aria-hidden="true" /> {formatDay(item.dueDate)}</span>}
                      {item.labels.slice(0, 2).map(l => <span key={l} className="wk-tag">{l}</span>)}
                      {item.childCount > 0 && <span className="wk-tag" title="Items under this that are done">{item.doneChildCount}/{item.childCount}</span>}
                    </span>
                    {item.storyPoints !== null && <span className="wk-points" title="Story points">{item.storyPoints}</span>}
                    <PriorityMark priority={item.priority} />
                    {canEdit ? (
                      <select className={`wk-status-select wk-status-${item.status.toLowerCase()}`} value={item.status} aria-label={`Status of ${item.key}`} onChange={e => void changeStatus(item, e.target.value as ItemStatus)}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    ) : <StatusPill status={item.status} />}
                    <Avatar name={item.assigneeName} />
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && items.length > 0 && <div className="wk-foot">{filtering ? `${shown.size} of ${items.length} items match` : `${items.length} items`}</div>}
        </div>
        )}
      </div>

      {openId && (
        <ItemDrawer
          itemId={openId} items={items} users={users} currentUserId={me?.id ?? null} canEdit={canEdit} canManage={canManage}
          onClose={closeItem} onChanged={reload} onOpen={openItem}
          onAddChild={parent => setCreating({ parent })}
          onDeleted={() => { closeItem(); reload(); }}
        />
      )}

      {creating && project && (
        <CreateItemDialog
          project={project} items={items} users={users} parent={creating.parent}
          onClose={() => setCreating(null)}
          onCreated={created => { setCreating(null); reload(); openItem(created.workItemId); }}
        />
      )}
      {addingProject && (
        <NewProjectDialog onClose={() => setAddingProject(false)} onCreated={p => { setProjects(prev => [...prev, p]); setAddingProject(false); chooseProject(p.projectId); }} />
      )}
    </div>
  );
}
