import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { ArrowLeft, ArrowRight, Ban, CalendarClock, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { WorkItem, WorkStatus } from '../types';
import { formatDay, isDone, isOverdue } from '../workMeta';
import { Avatar, PriorityMark, TypeIcon } from './parts';

interface Props {
  items: WorkItem[];
  /** The project's columns, in order. */
  statuses: WorkStatus[];
  openId: string | null;
  canEdit: boolean;
  /** May add, rename and reorder columns. */
  canManage: boolean;
  /** May remove a column (work.delete). */
  canDelete: boolean;
  onOpen: (itemId: string) => void;
  onMove: (item: WorkItem, statusKey: string) => void;
  onAddColumn: () => void;
  onEditColumn: (status: WorkStatus) => void;
  onRemoveColumn: (status: WorkStatus) => void;
  /** Move a column one place: -1 left, 1 right. */
  onShiftColumn: (status: WorkStatus, by: -1 | 1) => void;
}

/**
 * The same items as the list, as cards in one column per status. Dragging a card to another column
 * changes its status. Works with a mouse, a finger (press and hold) and the keyboard (Space to pick
 * up, Left and Right to change column, Space to drop). The columns are the project's own: people
 * with work.manage add, rename, reorder and remove them from each column's menu.
 */
export default function BoardView({ items, statuses, openId, canEdit, canManage, canDelete, onOpen, onMove, onAddColumn, onEditColumn, onRemoveColumn, onShiftColumn }: Props) {
  const [dragging, setDragging] = useState<WorkItem | null>(null);
  const keys = useMemo(() => statuses.map(s => s.key), [statuses]);
  const nameOfStatus = (key: unknown) => statuses.find(s => s.key === key)?.name ?? 'the column';

  const jumpColumns = useMemo<KeyboardCoordinateGetter>(() => (event, { currentCoordinates, context }) => {
    // With the keyboard, Left and Right move a picked-up card one whole column at a time.
    if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
    const card = context.collisionRect;
    if (!card) return undefined;
    event.preventDefault();
    const columns = keys.map(k => context.droppableRects.get(k)).filter((r): r is NonNullable<typeof r> => !!r);
    if (columns.length === 0) return undefined;
    const centre = card.left + card.width / 2;
    let at = columns.findIndex(c => centre >= c.left && centre <= c.right);
    if (at < 0) at = 0;
    const next = Math.min(columns.length - 1, Math.max(0, at + (event.code === 'ArrowRight' ? 1 : -1)));
    const target = columns[next];
    return { x: target.left + (target.width - card.width) / 2, y: currentCoordinates.y };
  }, [keys]);

  const sensors = useSensors(
    // A small movement before a drag starts, so a plain click still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: jumpColumns }),
  );

  const columns = useMemo(() => {
    const by = new Map<string, WorkItem[]>(keys.map(k => [k, []]));
    for (const i of items) by.get(i.status)?.push(i);
    for (const list of by.values()) list.sort((a, b) => a.rank - b.rank || a.number - b.number);
    return by;
  }, [items, keys]);

  const start = (e: DragStartEvent) => setDragging(items.find(i => i.workItemId === e.active.id) || null);
  const end = (e: DragEndEvent) => {
    setDragging(null);
    const item = items.find(i => i.workItemId === e.active.id);
    const target = e.over ? String(e.over.id) : '';
    if (item && keys.includes(target) && target !== item.status) onMove(item, target);
  };
  const cardName = (id: unknown) => {
    const item = items.find(i => i.workItemId === id);
    return item ? `${item.key} ${item.title}` : 'the card';
  };

  return (
    <DndContext
      sensors={sensors} onDragStart={start} onDragEnd={end} onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${cardName(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${cardName(active.id)} is over ${nameOfStatus(over.id)}.` : ''),
          onDragEnd: ({ active, over }) => (over ? `${cardName(active.id)} moved to ${nameOfStatus(over.id)}.` : 'Move cancelled.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="wk-board" aria-label="Board" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(220px, 1fr))${canManage ? ' 160px' : ''}` }}>
        {statuses.map((status, index) => {
          const cards = columns.get(status.key) || [];
          return (
            <Column
              key={status.statusId} status={status} count={cards.length} active={!!dragging && dragging.status !== status.key}
              menu={canManage || canDelete ? (
                <ColumnMenu
                  canManage={canManage} canDelete={canDelete}
                  status={status} first={index === 0} last={index === statuses.length - 1}
                  onEdit={() => onEditColumn(status)} onRemove={() => onRemoveColumn(status)} onShift={by => onShiftColumn(status, by)}
                />
              ) : null}
            >
              {cards.map(item => (
                <Card key={item.workItemId} item={item} open={openId === item.workItemId} canEdit={canEdit} onOpen={onOpen} ghost={dragging?.workItemId === item.workItemId} />
              ))}
              {cards.length === 0 && <p className="wk-board-none">{dragging ? 'Drop here' : 'Nothing here'}</p>}
            </Column>
          );
        })}
        {canManage && (
          <button type="button" className="wk-col-add" onClick={onAddColumn}><Plus size={16} aria-hidden="true" /> Add column</button>
        )}
      </div>
      <DragOverlay>{dragging ? <CardFace item={dragging} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, count, active, menu, children }: { status: WorkStatus; count: number; active: boolean; menu: ReactNode; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key });
  return (
    <section ref={setNodeRef} className={`wk-col ${isOver && active ? 'is-over' : ''}`} aria-label={`${status.name}, ${count} items`}>
      <div className="wk-col-head">
        <h3><span className={`wk-col-dot wk-status-${status.category.toLowerCase()}`} aria-hidden="true" />{status.name}<span className="wk-count">{count}</span></h3>
        {menu}
      </div>
      <div className="wk-col-body">{children}</div>
    </section>
  );
}

/** The "…" on a column: rename, move left or right, remove. */
function ColumnMenu({ status, first, last, canManage, canDelete, onEdit, onRemove, onShift }: { status: WorkStatus; canManage: boolean; canDelete: boolean; first: boolean; last: boolean; onEdit: () => void; onRemove: () => void; onShift: (by: -1 | 1) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const run = (action: () => void) => () => { setOpen(false); action(); };

  return (
    <div className="wk-menu" ref={box}>
      <button type="button" className="wk-iconbtn is-small" aria-haspopup="menu" aria-expanded={open} aria-label={`Column options for ${status.name}`} title="Column options" onClick={() => setOpen(v => !v)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="wk-menu-list" role="menu">
          {canManage && (
            <>
              <button type="button" role="menuitem" onClick={run(onEdit)}><Pencil size={15} aria-hidden="true" /> Rename or change meaning</button>
              <button type="button" role="menuitem" disabled={first} onClick={run(() => onShift(-1))}><ArrowLeft size={15} aria-hidden="true" /> Move left</button>
              <button type="button" role="menuitem" disabled={last} onClick={run(() => onShift(1))}><ArrowRight size={15} aria-hidden="true" /> Move right</button>
            </>
          )}
          {canDelete && <button type="button" role="menuitem" className="is-danger" onClick={run(onRemove)}><Trash2 size={15} aria-hidden="true" /> Remove column</button>}
        </div>
      )}
    </div>
  );
}

function Card({ item, open, canEdit, onOpen, ghost }: { item: WorkItem; open: boolean; canEdit: boolean; onOpen: (id: string) => void; ghost: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.workItemId, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      className={`wk-card-item ${open ? 'is-open' : ''} ${ghost ? 'is-ghost' : ''}`}
      role="button" tabIndex={0} aria-label={`${item.key} ${item.title}. ${item.statusName}.${canEdit ? ' Press Enter to open, Space to move.' : ''}`}
      onClick={() => onOpen(item.workItemId)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onOpen(item.workItemId); } else listeners?.onKeyDown?.(e); }}
    >
      <CardFace item={item} />
    </div>
  );
}

function CardFace({ item, lifted }: { item: WorkItem; lifted?: boolean }) {
  const late = isOverdue(item);
  const blocked = item.isBlocked && !isDone(item);
  return (
    <div className={`wk-card-face ${lifted ? 'is-lifted' : ''}`}>
      <p className="wk-card-title">{item.title}</p>
      {(blocked || item.dueDate || item.labels.length > 0) && (
        <p className="wk-card-tags">
          {blocked && <span className="wk-tag is-blocked"><Ban size={12} aria-hidden="true" /> Blocked</span>}
          {item.dueDate && <span className={`wk-tag ${late ? 'is-late' : ''}`}><CalendarClock size={12} aria-hidden="true" /> {formatDay(item.dueDate)}</span>}
          {item.labels.slice(0, 2).map(l => <span key={l} className="wk-tag">{l}</span>)}
        </p>
      )}
      <div className="wk-card-foot">
        <TypeIcon type={item.itemType} />
        <span className="wk-key">{item.key}</span>
        {item.parentKey && <span className="wk-card-parent" title={item.parentTitle || undefined}>in {item.parentKey}</span>}
        <span className="wk-card-right">
          {item.storyPoints !== null && <span className="wk-points" title="Story points">{item.storyPoints}</span>}
          <PriorityMark priority={item.priority} />
          <Avatar name={item.assigneeName} />
        </span>
      </div>
    </div>
  );
}
