import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { Ban, CalendarClock } from 'lucide-react';
import type { ItemStatus, WorkItem } from '../types';
import { formatDay, isOverdue, STATUSES, STATUS_LABEL } from '../workMeta';
import { Avatar, PriorityMark, TypeIcon } from './parts';

interface Props {
  items: WorkItem[];
  openId: string | null;
  canEdit: boolean;
  onOpen: (itemId: string) => void;
  onMove: (item: WorkItem, status: ItemStatus) => void;
}

/**
 * The same items as the list, as cards in one column per status. Dragging a card to another column
 * changes its status. Works with a mouse, a finger (press and hold) and the keyboard (Space to pick
 * up, Left and Right to change column, Space to drop).
 */
export default function BoardView({ items, openId, canEdit, onOpen, onMove }: Props) {
  const [dragging, setDragging] = useState<WorkItem | null>(null);
  const sensors = useSensors(
    // A small movement before a drag starts, so a plain click still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: jumpColumns }),
  );

  const columns = useMemo(() => {
    const by: Record<ItemStatus, WorkItem[]> = { ToDo: [], InProgress: [], InReview: [], Done: [] };
    for (const i of items) by[i.status].push(i);
    for (const s of STATUSES) by[s].sort((a, b) => a.rank - b.rank || a.number - b.number);
    return by;
  }, [items]);

  const start = (e: DragStartEvent) => setDragging(items.find(i => i.workItemId === e.active.id) || null);
  const end = (e: DragEndEvent) => {
    setDragging(null);
    const item = items.find(i => i.workItemId === e.active.id);
    const target = e.over?.id as ItemStatus | undefined;
    if (item && target && STATUSES.includes(target) && target !== item.status) onMove(item, target);
  };

  return (
    <DndContext
      sensors={sensors} onDragStart={start} onDragEnd={end} onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${nameOf(items, String(active.id))}.`,
          onDragOver: ({ active, over }) => (over ? `${nameOf(items, String(active.id))} is over ${STATUS_LABEL[over.id as ItemStatus]}.` : ''),
          onDragEnd: ({ active, over }) => (over ? `${nameOf(items, String(active.id))} moved to ${STATUS_LABEL[over.id as ItemStatus]}.` : 'Move cancelled.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="wk-board" aria-label="Board">
        {STATUSES.map(status => (
          <Column key={status} status={status} count={columns[status].length} active={!!dragging && dragging.status !== status}>
            {columns[status].map(item => (
              <Card key={item.workItemId} item={item} open={openId === item.workItemId} canEdit={canEdit} onOpen={onOpen} ghost={dragging?.workItemId === item.workItemId} />
            ))}
            {columns[status].length === 0 && <p className="wk-board-none">{dragging ? 'Drop here' : 'Nothing here'}</p>}
          </Column>
        ))}
      </div>
      <DragOverlay>{dragging ? <CardFace item={dragging} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

/** With the keyboard, Left and Right move a picked-up card one whole column at a time. */
const jumpColumns: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
  const card = context.collisionRect;
  if (!card) return undefined;
  event.preventDefault();
  const columns = STATUSES.map(s => context.droppableRects.get(s)).filter((r): r is NonNullable<typeof r> => !!r);
  if (columns.length === 0) return undefined;
  const centre = card.left + card.width / 2;
  let at = columns.findIndex(c => centre >= c.left && centre <= c.right);
  if (at < 0) at = 0;
  const next = Math.min(columns.length - 1, Math.max(0, at + (event.code === 'ArrowRight' ? 1 : -1)));
  const target = columns[next];
  return { x: target.left + (target.width - card.width) / 2, y: currentCoordinates.y };
};

const nameOf = (items: WorkItem[], id: string) => {
  const item = items.find(i => i.workItemId === id);
  return item ? `${item.key} ${item.title}` : 'the card';
};

function Column({ status, count, active, children }: { status: ItemStatus; count: number; active: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`wk-col ${isOver && active ? 'is-over' : ''}`} aria-label={`${STATUS_LABEL[status]}, ${count} items`}>
      <h3 className="wk-col-head"><span className={`wk-col-dot wk-status-${status.toLowerCase()}`} aria-hidden="true" />{STATUS_LABEL[status]}<span className="wk-count">{count}</span></h3>
      <div className="wk-col-body">{children}</div>
    </section>
  );
}

function Card({ item, open, canEdit, onOpen, ghost }: { item: WorkItem; open: boolean; canEdit: boolean; onOpen: (id: string) => void; ghost: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.workItemId, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      className={`wk-card-item ${open ? 'is-open' : ''} ${ghost ? 'is-ghost' : ''}`}
      role="button" tabIndex={0} aria-label={`${item.key} ${item.title}. ${STATUS_LABEL[item.status]}.${canEdit ? ' Press Enter to open, Space to move.' : ''}`}
      onClick={() => onOpen(item.workItemId)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onOpen(item.workItemId); } else listeners?.onKeyDown?.(e); }}
    >
      <CardFace item={item} />
    </div>
  );
}

function CardFace({ item, lifted }: { item: WorkItem; lifted?: boolean }) {
  const late = isOverdue(item);
  return (
    <div className={`wk-card-face ${lifted ? 'is-lifted' : ''}`}>
      <p className="wk-card-title">{item.title}</p>
      {(item.isBlocked && item.status !== 'Done' || item.dueDate || item.labels.length > 0) && (
        <p className="wk-card-tags">
          {item.isBlocked && item.status !== 'Done' && <span className="wk-tag is-blocked"><Ban size={12} aria-hidden="true" /> Blocked</span>}
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
