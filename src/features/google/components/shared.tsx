import type { ReactNode } from 'react';
import { PERIODS } from '../googleUtils';

// Small pieces shared by the Google tabs.

export function PeriodPicker({ value, onChange, periods = PERIODS }: { value: string; onChange: (id: string) => void; periods?: readonly { id: string; label: string }[] }) {
  return (
    <div className="sc-seg" role="group" aria-label="Period">
      {periods.map(p => <button key={p.id} type="button" className={value === p.id ? 'on' : ''} aria-pressed={value === p.id} onClick={() => onChange(p.id)}>{p.label}</button>)}
    </div>
  );
}

export function NotChosen({ children }: { children: ReactNode }) {
  return <p className="hw-muted wa-pad">{children}</p>;
}

/** A thin share bar under a name (channels, sources). */
export const Share = ({ value, max }: { value: number; max: number }) => (
  <div className="gg-share" aria-hidden="true"><div style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }} /></div>
);
