import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONTRIBUTOR_TYPE_LABEL, type Contributor } from '../types';

interface Props {
  label: string;
  required?: boolean;
  /** Only people who may be chosen here; the caller filters (for example verified doctors for a reviewer). */
  options: Contributor[];
  value: string | null;
  disabled?: boolean;
  error?: string;
  hint?: string;
  onChange: (contributorId: string) => void;
}

const subtitle = (c: Contributor) => c.speciality || c.roleTitle || CONTRIBUTOR_TYPE_LABEL[c.type];

export default function ContributorPicker({ label, required, options, value, disabled, error, hint, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const picked = options.find((c) => c.contributorId === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((c) => `${c.fullName} ${subtitle(c)}`.toLowerCase().includes(t)) : options;
  }, [options, q]);

  return (
    <div className="hw-field hw-picker" ref={box}>
      <span className="hw-label">{label}{required && <span className="hw-err"> *</span>}</span>
      <button type="button" className="hw-chosen" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setQ(''); }}>
        {picked
          ? <span>{picked.fullName}{picked.type === 'INDEPENDENT_DOCTOR' && <span className="hw-tag">Independent</span>}<small>{subtitle(picked)}</small></span>
          : <span className="hw-muted">Choose a person</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="hw-menu">
          <input type="text" value={q} autoFocus placeholder="Search by name" aria-label={`Search ${label}`} onChange={(e) => setQ(e.target.value)} />
          <ul role="listbox" aria-label={label}>
            {shown.map((c) => (
              <li key={c.contributorId} role="option" aria-selected={c.contributorId === value}>
                <button type="button" onClick={() => { onChange(c.contributorId); setOpen(false); }}>
                  {c.fullName}{c.type === 'INDEPENDENT_DOCTOR' && <span className="hw-tag">Independent</span>}<small>{subtitle(c)}</small>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="hw-muted hw-none">{options.length === 0 ? 'Nobody is available yet.' : 'No one matches that search.'}</li>}
          </ul>
        </div>
      )}
      <div className="hw-hint"><span className="hw-err">{error}</span>{hint && <span>{hint}</span>}</div>
    </div>
  );
}
