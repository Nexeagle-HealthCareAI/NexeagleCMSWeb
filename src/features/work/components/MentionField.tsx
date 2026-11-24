import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { WorkUser } from '../types';
import { insertMention, mentionQuery } from '../chatMeta';
import { Avatar } from './parts';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** People who can be tagged here. */
  users: WorkUser[];
  /** A text area (comments) or a one-line box (what is blocking an item). */
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  label: string;
  maxLength?: number;
  autoFocus?: boolean;
  readOnly?: boolean;
  /** Enter in a one-line box, Ctrl+Enter in a text area. */
  onSubmit?: () => void;
}

/**
 * A text box where typing @ offers the people who can be tagged; picking one writes "@Full Name".
 * Who is tagged is read back from the text with mentionedIn() when it is saved.
 */
export default function MentionField({ value, onChange, users, multiline, rows = 2, placeholder, label, maxLength, autoFocus, readOnly, onSubmit }: Props) {
  const [suggest, setSuggest] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    return users.filter(u => u.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [suggest, users]);

  const pick = (user: WorkUser) => {
    if (!suggest) return;
    const cursor = input.current?.selectionStart ?? value.length;
    const next = insertMention(value, cursor, suggest.start, user.fullName);
    onChange(next.text);
    setSuggest(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.cursor, next.cursor); });
  };

  const typed = (text: string, cursor: number | null) => {
    onChange(text);
    setSuggest(users.length > 0 ? mentionQuery(text, cursor ?? text.length) : null);
    setIndex(0);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (suggest && options.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[index]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSuggest(null); return; }
    }
    if (!onSubmit || e.key !== 'Enter') return;
    if (!multiline || e.ctrlKey || e.metaKey) { e.preventDefault(); onSubmit(); }
  };

  const common = {
    value, placeholder, maxLength, autoFocus, readOnly,
    'aria-label': label,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': !!suggest && options.length > 0,
    onKeyDown: onKey,
    onBlur: () => setSuggest(null),
  };

  return (
    <div className="wk-mention">
      {suggest && options.length > 0 && (
        <ul className="wk-chat-suggest wk-mention-suggest" role="listbox" aria-label="People to tag">
          {options.map((u, i) => (
            <li key={u.userId} role="option" aria-selected={i === index} className={i === index ? 'is-on' : ''} onMouseDown={e => { e.preventDefault(); pick(u); }}>
              <Avatar name={u.fullName} /> {u.fullName}
            </li>
          ))}
        </ul>
      )}
      {multiline ? (
        <textarea ref={input} rows={rows} {...common} onChange={e => typed(e.target.value, e.target.selectionStart)} />
      ) : (
        <input ref={input} {...common} onChange={e => typed(e.target.value, e.target.selectionStart)} />
      )}
    </div>
  );
}
