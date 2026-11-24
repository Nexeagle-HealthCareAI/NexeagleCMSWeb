import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, ChevronDown, ChevronRight, ChevronUp, Link2, Maximize2, PanelRight, Plus, Siren, Trash2, UserCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ItemPriority, UpdateItemPayload, WorkItem, WorkItemDetail, WorkStatus, WorkUser } from '../types';
import {
  allowedParentTypes, childTypesFor, describeChange, formatWhen, parentRequired, PRIORITIES, toUpdatePayload,
} from '../workMeta';
import { errorMessage, workService } from '../services/workService';
import { Avatar, Dialog, StatusPill, TypeIcon } from './parts';
import EscalateDialog from './EscalateDialog';
import WorkEditor from './WorkEditor';
import MentionField from './MentionField';
import { mentionedIn, splitMentions } from '../chatMeta';
import { useAuthStore } from '../../../store/useAuthStore';
import { canEditDocs, canExportWork, canViewDocs } from '../access';
import ShareItem from './ShareItem';
import { docsService } from '../docs/docsService';
import { DocIcon } from '../docs/DocIcon';
import DocPicker from '../docs/DocPicker';
import DocAdder, { type AddMode } from '../docs/DocAdder';
import type { Doc } from '../docs/types';

export type ItemView = 'window' | 'panel';

interface Props {
  itemId: string;
  items: WorkItem[];
  users: WorkUser[];
  /** The project's board columns. */
  statuses: WorkStatus[];
  currentUserId: string | null;
  canEdit: boolean;
  /** Holds work.delete: may delete this item and remove other people's comments. */
  canDelete: boolean;
  onClose: () => void;
  /** The list should load again: something about this item changed. */
  onChanged: () => void;
  onOpen: (itemId: string) => void;
  onAddChild: (parent: WorkItem) => void;
  onDeleted: () => void;
  /** window: a large window over the board (the default); panel: beside the list. */
  view?: ItemView;
  onViewChange?: (view: ItemView) => void;
  /** The items before and after this one in the list, to step through without closing. */
  previousId?: string | null;
  nextId?: string | null;
  /** The board shown now; an item opened from elsewhere (a tag, the chat) may be on another one. */
  projectId?: string;
  onProjectFound?: (projectId: string) => void;
}

/** The item page, shown as a panel on the right so the list stays in view. */
export default function ItemDrawer({ itemId, items, users, statuses, currentUserId, canEdit, canDelete, onClose, onChanged, onOpen, onAddChild, onDeleted, projectId, onProjectFound, view = 'panel', onViewChange, previousId, nextId }: Props) {
  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [labels, setLabels] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [draft, setDraft] = useState('');
  const [textVersion, setTextVersion] = useState(0);
  const [blockReason, setBlockReason] = useState('');
  const [askBlock, setAskBlock] = useState(false);
  const [comment, setComment] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [typedKey, setTypedKey] = useState('');
  const panel = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const permissions = useAuthStore(s => s.permissions) || [];
  const seesDocs = canViewDocs(permissions);
  const linksDocs = canEdit && canEditDocs(permissions);
  const [linked, setLinked] = useState<Doc[]>([]);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<{ mode: AddMode; files?: File[] } | null>(null);
  const [dropping, setDropping] = useState(false);
  // People who can be tagged here (@Name), and every name, so tags show in the text.
  const [taggableIds, setTaggableIds] = useState<string[]>([]);
  const taggable = users.filter(u => taggableIds.includes(u.userId));
  const names = users.map(u => u.fullName);
  const found = useRef(onProjectFound);
  useEffect(() => { found.current = onProjectFound; }, [onProjectFound]);
  const tags = (text: string) => splitMentions(text, names).map((part, i) => (part.mention ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>));

  const show = useCallback((d: WorkItemDetail) => {
    setItem(d);
    setTitle(d.title);
    setPoints(d.storyPoints === null ? '' : String(d.storyPoints));
    setLabels(d.labels.join(', '));
    setBlockReason(d.blockedReason || '');
  }, []);

  /** After something outside the form changed the item (an escalation adds a history line). */
  const reloadItem = useCallback(async () => {
    try { show(await workService.item(itemId)); } catch { /* the panel keeps what it has */ }
  }, [itemId, show]);

  useEffect(() => {
    let alive = true;
    setItem(null);
    setError('');
    setEditingText(false);
    setAskBlock(false);
    setShowHistory(false);
    workService.item(itemId)
      .then(d => { if (alive) { show(d); setTextVersion(v => v + 1); } })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not open this item.')); });
    return () => { alive = false; };
  }, [itemId, show]);

  // Opened from a tag or a link: show the item's own board behind it.
  useEffect(() => {
    if (item && projectId && item.projectId !== projectId) found.current?.(item.projectId);
  }, [item, projectId]);

  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    setTaggableIds([]);
    workService.taggable(itemId).then(ids => { if (alive) setTaggableIds(ids); }).catch(() => undefined);
    return () => { alive = false; };
  }, [itemId, canEdit]);

  // Documents tagged on this item. Ones in a folder locked to the reader are not sent at all.
  useEffect(() => {
    if (!seesDocs) return;
    let alive = true;
    setLinked([]);
    docsService.itemDocuments(itemId).then(list => { if (alive) setLinked(list); }).catch(() => undefined);
    return () => { alive = false; };
  }, [itemId, seesDocs]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.wk-overlay')) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => { panel.current?.focus(); }, [itemId]);

  /** Sends the item with these fields changed. On failure the fields go back to what was saved. */
  const save = async (patch: Partial<UpdateItemPayload>): Promise<boolean> => {
    if (!item) return false;
    setSaving(true);
    try {
      const saved = await workService.updateItem(item.workItemId, { ...toUpdatePayload(item), ...patch });
      show(saved);
      onChanged();
      return true;
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save. Try again.'));
      show(item);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const isWindow = view === 'window';
  const shell = `wk-drawer ${isWindow ? 'is-window' : ''}`;
  // Unsaved typing: clicking outside the window must not throw it away.
  const dirty = !!comment.trim() || editingText || askBlock;
  /** In window mode the item sits in a large window over the board; a click outside closes it. */
  const frame = (content: React.ReactElement) => (isWindow ? (
    <div className="wk-window-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !dirty) onClose(); }}>{content}</div>
  ) : content);

  if (error) {
    return frame(
      <aside className={shell} aria-label="Work item" ref={panel} tabIndex={-1}>
        <div className="wk-drawer-head"><span /><button type="button" className="wk-iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <p className="wk-error" role="alert">{error}</p>
      </aside>
    );
  }
  if (!item) {
    return frame(<aside className={shell} aria-label="Work item" aria-busy="true" ref={panel} tabIndex={-1}><p className="wk-muted">Loading…</p></aside>);
  }
  const assignedToMe = !!currentUserId && item.assigneeUserId === currentUserId;
  const canTakeIt = canEdit && !!currentUserId && !assignedToMe && users.some(u => u.userId === currentUserId);

  const parentTypes = allowedParentTypes(item.itemType);
  const parentChoices = items.filter(i => parentTypes.includes(i.itemType) && i.workItemId !== item.workItemId).sort((a, b) => a.number - b.number);
  const canHaveChildren = childTypesFor(item.itemType).length > 0;

  const commitTitle = () => {
    const next = title.trim();
    if (!next) { setTitle(item.title); return; }
    if (next !== item.title) void save({ title: next });
  };
  const commitPoints = () => {
    const next = points.trim() === '' ? null : Number(points);
    if (next !== null && (Number.isNaN(next) || next < 0 || next > 999)) { toast.error('Story points must be a number from 0 to 999.'); setPoints(item.storyPoints === null ? '' : String(item.storyPoints)); return; }
    if (next !== item.storyPoints) void save({ storyPoints: next });
  };
  const commitLabels = () => {
    const next = Array.from(new Set(labels.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)));
    if (next.join(',') !== item.labels.join(',')) void save({ labels: next });
    else setLabels(item.labels.join(', '));
  };
  const saveText = async () => {
    const text = draft.trim() ? draft : null;
    if (await save({ description: text, descriptionMentionUserIds: text ? mentionedIn(text, taggable) : [] })) { setEditingText(false); setTextVersion(v => v + 1); }
  };
  const block = async () => {
    if (!blockReason.trim()) { toast.error('Say what is blocking this item.'); return; }
    const reason = blockReason.trim();
    if (await save({ isBlocked: true, blockedReason: reason, blockedMentionUserIds: mentionedIn(reason, taggable) })) setAskBlock(false);
  };
  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      const body = comment.trim();
      const added = await workService.addComment(item.workItemId, body, mentionedIn(body, taggable));
      setItem({ ...item, comments: [...item.comments, added] });
      setComment('');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not add the comment.'));
    }
  };
  const removeComment = async (commentId: string) => {
    try {
      await workService.deleteComment(commentId);
      setItem({ ...item, comments: item.comments.filter(c => c.commentId !== commentId) });
    } catch (e) {
      toast.error(errorMessage(e, 'Could not remove the comment.'));
    }
  };
  const linkDoc = async (doc: Doc) => {
    try {
      await docsService.link(item.workItemId, doc.documentId);
      setLinked(prev => [...prev, doc].sort((a, b) => a.name.localeCompare(b.name)));
      setPicking(false);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not link the document.'));
    }
  };
  const unlinkDoc = async (doc: Doc) => {
    try {
      await docsService.unlink(item.workItemId, doc.documentId);
      setLinked(prev => prev.filter(d => d.documentId !== doc.documentId));
    } catch (e) {
      toast.error(errorMessage(e, 'Could not remove the link.'));
    }
  };
  const remove = async () => {
    try {
      await workService.deleteItem(item.workItemId);
      toast.success(`${item.key} deleted`);
      onDeleted();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not delete this item.'));
      setConfirmDelete(false);
    }
  };

  return frame(
    <aside className={shell} aria-label={`${item.key} ${item.title}`} ref={panel} tabIndex={-1}>
      <div className="wk-drawer-head">
        <div className="wk-crumbs">
          {item.parentId && item.parentKey && (
            <>
              <button type="button" className="wk-link" onClick={() => onOpen(item.parentId!)} title={item.parentTitle || undefined}>{item.parentKey}</button>
              <ChevronRight size={14} aria-hidden="true" />
            </>
          )}
          <TypeIcon type={item.itemType} withLabel />
          <span className="wk-key">{item.key}</span>
          {saving && <span className="wk-muted" role="status">Saving…</span>}
        </div>
        <div className="wk-drawer-tools">
          {(previousId !== undefined || nextId !== undefined) && (
            <>
              <button type="button" className="wk-iconbtn" disabled={!previousId} onClick={() => previousId && onOpen(previousId)} aria-label="Previous item" title="Previous item"><ChevronUp size={18} /></button>
              <button type="button" className="wk-iconbtn" disabled={!nextId} onClick={() => nextId && onOpen(nextId)} aria-label="Next item" title="Next item"><ChevronDown size={18} /></button>
            </>
          )}
          {onViewChange && (isWindow
            ? <button type="button" className="wk-iconbtn" onClick={() => onViewChange('panel')} aria-label="Show beside the list" title="Show beside the list"><PanelRight size={17} /></button>
            : <button type="button" className="wk-iconbtn" onClick={() => onViewChange('window')} aria-label="Open in a large window" title="Open in a large window"><Maximize2 size={17} /></button>)}
          <ShareItem itemId={item.workItemId} itemKey={item.key} title={item.title} canExport={canExportWork(permissions)} />
          {canEdit && <button type="button" className="wk-iconbtn" onClick={() => setEscalating(true)} aria-label="Escalate" title="Escalate"><Siren size={17} /></button>}
          {canDelete && <button type="button" className="wk-iconbtn" onClick={() => { setTypedKey(''); setConfirmDelete(true); }} aria-label="Delete item" title="Delete"><Trash2 size={17} /></button>}
          <button type="button" className="wk-iconbtn" onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
        </div>
      </div>

      <input
        className="wk-title-input" aria-label="Title" value={title} maxLength={300} readOnly={!canEdit}
        onChange={e => setTitle(e.target.value)} onBlur={commitTitle}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />

      {item.isBlocked && (
        <div className="wk-blocked" role="status">
          <Ban size={16} aria-hidden="true" />
          <span><strong>Blocked.</strong> {item.blockedReason ? tags(item.blockedReason) : null}</span>
          {canEdit && <button type="button" className="wk-link" onClick={() => void save({ isBlocked: false, blockedReason: null })}>Unblock</button>}
        </div>
      )}

      <div className="wk-item-body">
      <div className="wk-item-side">
        <h3 className="wk-side-title">Details</h3>
      <div className="wk-fields">
        <label className="wk-field is-status">
          <span>Status</span>
          <select className={`wk-status-select wk-status-${item.statusCategory.toLowerCase()}`} value={item.status} disabled={!canEdit} onChange={e => void save({ status: e.target.value })}>
            {statuses.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            {!statuses.some(s => s.key === item.status) && <option value={item.status}>{item.statusName}</option>}
          </select>
        </label>
        <label className="wk-field">
          <span>Assignee</span>
          <select value={item.assigneeUserId || ''} disabled={!canEdit} onChange={e => void save({ assigneeUserId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
            {item.assigneeUserId && !users.some(u => u.userId === item.assigneeUserId) && <option value={item.assigneeUserId}>{item.assigneeName || 'Former staff'}</option>}
          </select>
          {canTakeIt && <button type="button" className="wk-link wk-take" onClick={() => void save({ assigneeUserId: currentUserId })}><UserCheck size={14} aria-hidden="true" /> Assign to me</button>}
        </label>
        <label className="wk-field">
          <span>Priority</span>
          <select value={item.priority} disabled={!canEdit} onChange={e => void save({ priority: e.target.value as ItemPriority })}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="wk-field">
          <span>Story points</span>
          <input inputMode="decimal" value={points} readOnly={!canEdit} onChange={e => setPoints(e.target.value)} onBlur={commitPoints} placeholder="None" />
        </label>
        <label className="wk-field">
          <span>Start date</span>
          <input type="date" value={item.startDate || ''} max={item.dueDate || undefined} disabled={!canEdit} onChange={e => void save({ startDate: e.target.value || null })} />
        </label>
        <label className="wk-field">
          <span>Due date</span>
          <input type="date" value={item.dueDate || ''} min={item.startDate || undefined} disabled={!canEdit} onChange={e => void save({ dueDate: e.target.value || null })} />
        </label>
        {parentTypes.length > 0 && (
          <label className="wk-field">
            <span>Parent</span>
            <select value={item.parentId || ''} disabled={!canEdit} onChange={e => void save({ parentId: e.target.value || null })}>
              {!parentRequired(item.itemType) && <option value="">No parent</option>}
              {parentChoices.map(i => <option key={i.workItemId} value={i.workItemId}>{i.key} · {i.title}</option>)}
            </select>
          </label>
        )}
        <label className="wk-field is-wide">
          <span>Labels</span>
          <input value={labels} readOnly={!canEdit} onChange={e => setLabels(e.target.value)} onBlur={commitLabels} placeholder="Separate with commas, e.g. billing, abdm" />
        </label>
      </div>

      {canEdit && !item.isBlocked && (
        askBlock ? (
          <div className="wk-blockform">
            <div className="wk-field">
              <span>What is blocking it? Type @ to tag who can help.</span>
              <MentionField value={blockReason} onChange={setBlockReason} users={taggable} maxLength={300} label="What is blocking it?" autoFocus onSubmit={() => void block()} />
            </div>
            <button type="button" className="wk-btn" onClick={() => setAskBlock(false)}>Cancel</button>
            <button type="button" className="wk-btn is-primary" onClick={() => void block()}>Mark blocked</button>
          </div>
        ) : (
          <button type="button" className="wk-btn is-quiet" onClick={() => setAskBlock(true)}><Ban size={15} aria-hidden="true" /> Mark as blocked</button>
        )
      )}

        <p className="wk-muted wk-meta">Reported by {item.reporterName || 'someone'} · created {formatWhen(item.createdAt)} · updated {formatWhen(item.updatedAt)}</p>
      </div>
      <div className="wk-item-main">
      <section className="wk-section" aria-labelledby="wk-desc-h">
        <div className="wk-section-head">
          <h3 id="wk-desc-h">Description</h3>
          {canEdit && !editingText && <button type="button" className="wk-link" onClick={() => { setDraft(item.description || ''); setEditingText(true); }}>{item.description ? 'Edit' : 'Add'}</button>}
        </div>
        {editingText ? (
          <>
            <WorkEditor key={`edit-${textVersion}`} initialMarkdown={item.description || ''} editable onChange={setDraft} label="Description" mentionUsers={taggable} mentionNames={names} />
            <div className="wk-form-actions">
              <button type="button" className="wk-btn" onClick={() => setEditingText(false)}>Cancel</button>
              <button type="button" className="wk-btn is-primary" disabled={saving} onClick={() => void saveText()}>Save</button>
            </div>
          </>
        ) : item.description ? (
          <WorkEditor key={`read-${textVersion}`} initialMarkdown={item.description} editable={false} onChange={() => undefined} label="Description" mentionNames={names} />
        ) : (
          <p className="wk-muted">No description yet.</p>
        )}
      </section>

      {(canHaveChildren || item.children.length > 0) && (
        <section className="wk-section" aria-labelledby="wk-child-h">
          <div className="wk-section-head">
            <h3 id="wk-child-h">{item.itemType === 'Epic' || item.itemType === 'Feature' ? 'Items under this' : 'Subtasks'}{item.children.length > 0 && <span className="wk-count">{item.doneChildCount}/{item.childCount} done</span>}</h3>
            {canEdit && canHaveChildren && <button type="button" className="wk-link" onClick={() => onAddChild(item)}><Plus size={14} aria-hidden="true" /> Add</button>}
          </div>
          {item.children.length === 0 ? <p className="wk-muted">Nothing here yet.</p> : (
            <ul className="wk-children">
              {item.children.map(c => (
                <li key={c.workItemId}>
                  <button type="button" onClick={() => onOpen(c.workItemId)}>
                    <TypeIcon type={c.itemType} />
                    <span className="wk-key">{c.key}</span>
                    <span className="wk-children-title">{c.title}</span>
                    <StatusPill name={c.statusName} category={c.statusCategory} />
                    <Avatar name={c.assigneeName} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {seesDocs && (
        <section
          className={`wk-section ${dropping ? 'is-dropping' : ''}`} aria-labelledby="wk-doc-h"
          // Files dropped here open "Add a document" with them ready to upload.
          onDragOver={linksDocs ? e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } } : undefined}
          onDragLeave={linksDocs ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); } : undefined}
          onDrop={linksDocs ? e => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDropping(false);
            setAdding({ mode: 'upload', files: Array.from(e.dataTransfer.files) });
          } : undefined}
        >
          <div className="wk-section-head">
            <h3 id="wk-doc-h">Linked documents{linked.length > 0 && <span className="wk-count">{linked.length}</span>}</h3>
            {linksDocs && (
              <span className="wk-doc-actions">
                <button type="button" className="wk-link" onClick={() => setAdding({ mode: 'upload' })}><Plus size={14} aria-hidden="true" /> Add a document</button>
                <button type="button" className="wk-link" onClick={() => setPicking(true)}><Link2 size={14} aria-hidden="true" /> Link a document</button>
              </span>
            )}
          </div>
          {linked.length === 0 ? <p className="wk-muted">{linksDocs ? 'No documents yet. Add one, link one from Docs, or drop files here.' : 'No documents linked.'}</p> : (
            <ul className="wk-doclinks" aria-label="Linked documents">
              {linked.map(d => (
                <li key={d.documentId}>
                  <button type="button" className="wk-doclink" onClick={() => navigate(`/work?tab=docs&doc=${encodeURIComponent(d.documentId)}`)} title={d.path.length > 0 ? d.path.join(' › ') : 'Top level'}>
                    <DocIcon doc={d} /><span>{d.name}</span>
                  </button>
                  {linksDocs && <button type="button" className="wk-link" onClick={() => void unlinkDoc(d)} aria-label={`Remove the link to ${d.name}`}>Remove</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="wk-section" aria-labelledby="wk-com-h">
        <div className="wk-section-head"><h3 id="wk-com-h">Comments{item.comments.length > 0 && <span className="wk-count">{item.comments.length}</span>}</h3></div>
        <ul className="wk-comments">
          {item.comments.map(c => (
            <li key={c.commentId} className={currentUserId && c.mentionUserIds?.includes(currentUserId) ? 'is-for-me' : undefined}>
              <Avatar name={c.authorName} />
              <div>
                <p className="wk-comment-meta"><strong>{c.authorName}</strong> <span>{formatWhen(c.createdAt)}</span>
                  {(canDelete || (canEdit && c.authorUserId === currentUserId)) && <button type="button" className="wk-link" onClick={() => void removeComment(c.commentId)}>Remove</button>}
                </p>
                <p className="wk-comment-body">{tags(c.body)}</p>
              </div>
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="wk-commentbox">
            <MentionField value={comment} onChange={setComment} users={taggable} multiline maxLength={10000} placeholder="Add a comment… type @ to tag someone"
              label="Add a comment" onSubmit={() => void addComment()} />
            <button type="button" className="wk-btn is-primary" disabled={!comment.trim()} onClick={() => void addComment()}>Comment</button>
          </div>
        )}
      </section>

      <section className="wk-section" aria-labelledby="wk-his-h">
        <div className="wk-section-head">
          <h3 id="wk-his-h">History</h3>
          <button type="button" className="wk-link" aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}>{showHistory ? 'Hide' : `Show ${item.history.length}`}</button>
        </div>
        {showHistory && (
          <ul className="wk-history">
            {item.history.map(h => <li key={h.historyId}><strong>{h.actorName}</strong> {describeChange(h.field, h.oldValue, h.newValue)} <span>{formatWhen(h.createdAt)}</span></li>)}
          </ul>
        )}
      </section>

      </div>
      </div>

      {adding && (
        <DocAdder
          workItemId={item.workItemId} itemKey={item.key} itemTitle={item.title} mode={adding.mode} files={adding.files}
          onClose={() => setAdding(null)}
          onAdded={doc => setLinked(prev => [...prev.filter(d => d.documentId !== doc.documentId), doc].sort((a, b) => a.name.localeCompare(b.name)))}
          onOpenPage={documentId => { setAdding(null); navigate(`/work?tab=docs&doc=${encodeURIComponent(documentId)}`); }}
        />
      )}
      {picking && <DocPicker alreadyLinked={linked.map(d => d.documentId)} onClose={() => setPicking(false)} onPick={d => void linkDoc(d)} />}

      {escalating && (
        <EscalateDialog item={item} users={users} currentUserId={currentUserId} onClose={() => setEscalating(false)} onDone={() => { setEscalating(false); void reloadItem(); }} />
      )}
      {confirmDelete && (
        <Dialog title={`Delete ${item.key}?`} onClose={() => setConfirmDelete(false)}>
          <p className="wk-dialog-text">“{item.title}” will be removed from the board for everyone, with its comments and history.</p>
          <label className="wk-field">
            <span>Type {item.key} to confirm</span>
            <input data-autofocus value={typedKey} onChange={e => setTypedKey(e.target.value)} autoComplete="off" spellCheck={false}
              onKeyDown={e => { if (e.key === 'Enter' && typedKey.trim().toUpperCase() === item.key.toUpperCase()) void remove(); }} />
          </label>
          <div className="wk-form-actions">
            <button type="button" className="wk-btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <button type="button" className="wk-btn is-danger" disabled={typedKey.trim().toUpperCase() !== item.key.toUpperCase()} onClick={() => void remove()}>Delete</button>
          </div>
        </Dialog>
      )}
    </aside>
  );
}
