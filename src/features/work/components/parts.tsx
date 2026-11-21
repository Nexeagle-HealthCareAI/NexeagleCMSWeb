import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Bookmark, Bug, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, CornerDownRight, Equal, Package, SquareCheck, Zap } from 'lucide-react';
import type { ItemPriority, ItemType, StatusCategory } from '../types';
import { initialsOf } from '../workMeta';

// Small pieces used across the board: type icon, status pill, priority mark, avatar, dialog.

const TYPE_ICON = { Epic: Zap, Feature: Package, Story: Bookmark, Task: SquareCheck, Bug, Subtask: CornerDownRight } as const;

export function TypeIcon({ type, withLabel }: { type: ItemType; withLabel?: boolean }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className={`wk-type wk-type-${type.toLowerCase()}`} title={withLabel ? undefined : type}>
      <span className="wk-type-ico"><Icon size={13} strokeWidth={2.4} aria-hidden="true" /></span>
      {withLabel ? <span>{type}</span> : <span className="wk-sr">{type}</span>}
    </span>
  );
}

/** Colour comes from what the column means (not started, under way, finished); the text is the team's own name for it. */
export function StatusPill({ name, category }: { name: string; category: StatusCategory }) {
  return <span className={`wk-status wk-status-${category.toLowerCase()}`}>{name}</span>;
}

const PRIORITY_ICON = { Highest: ChevronsUp, High: ChevronUp, Medium: Equal, Low: ChevronDown, Lowest: ChevronsDown } as const;

export function PriorityMark({ priority, withLabel }: { priority: ItemPriority; withLabel?: boolean }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span className={`wk-prio wk-prio-${priority.toLowerCase()}`} title={withLabel ? undefined : `${priority} priority`}>
      <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
      {withLabel ? <span>{priority}</span> : <span className="wk-sr">{priority} priority</span>}
    </span>
  );
}

export function Avatar({ name }: { name: string | null }) {
  if (!name) return <span className="wk-avatar is-empty" title="Unassigned" aria-label="Unassigned">–</span>;
  return <span className="wk-avatar" title={name} aria-label={name}>{initialsOf(name)}</span>;
}

/** Accessible dialog: Escape and a click outside close it; focus moves in and returns on close. */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button')?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); previous?.focus?.(); };
  }, []);

  return (
    <div className="wk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`wk-dialog ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={box}>
        <h2 id={id} className="wk-dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
