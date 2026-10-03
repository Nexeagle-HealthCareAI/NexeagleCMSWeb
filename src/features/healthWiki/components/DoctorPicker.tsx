import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DoctorOption } from '../types';

interface Props {
  label: string;
  required?: boolean;
  doctors: DoctorOption[];
  value: string | null;
  disabled?: boolean;
  error?: string;
  hint?: string;
  onChange: (doctorId: string) => void;
}

export default function DoctorPicker({ label, required, doctors, value, disabled, error, hint, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const picked = doctors.find((d) => d.doctorId === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? doctors.filter((d) => `${d.fullName} ${d.specialty ?? ''}`.toLowerCase().includes(t)) : doctors;
  }, [doctors, q]);

  return (
    <div className="hw-field hw-picker" ref={box}>
      <span className="hw-label">{label}{required && <span className="hw-err"> *</span>}</span>
      <button type="button" className="hw-chosen" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setQ(''); }}>
        {picked ? <span>{picked.fullName}<small>{picked.specialty}</small></span> : <span className="hw-muted">Choose a doctor</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="hw-menu">
          <input type="text" value={q} autoFocus placeholder="Search by name or speciality" aria-label={`Search ${label}`}
            onChange={(e) => setQ(e.target.value)} />
          <ul role="listbox" aria-label={label}>
            {shown.map((d) => (
              <li key={d.doctorId} role="option" aria-selected={d.doctorId === value}>
                <button type="button" onClick={() => { onChange(d.doctorId); setOpen(false); }}>
                  {d.fullName}<small>{d.specialty}</small>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="hw-muted hw-none">No doctor matches that search.</li>}
          </ul>
        </div>
      )}
      <div className="hw-hint"><span className="hw-err">{error}</span>{hint && <span>{hint}</span>}</div>
    </div>
  );
}
