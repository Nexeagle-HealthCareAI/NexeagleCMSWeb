import type { ReactNode } from 'react';
import type { Lang, Opportunity, Site } from '../types';
import { OPPORTUNITIES, SITES, langLabel, siteLabel, sourceLabel } from '../keywordUtils';

// Small pieces shared by the Keywords tabs.

/** 8 weeks of demand as a thin line; the last week is marked. Decorative: the numbers are in the row. */
export function Sparkline({ values, width = 84, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="hw-muted">—</span>;
  const max = Math.max(1, ...values);
  const step = (width - 4) / (values.length - 1);
  const pts = values.map((v, i) => [2 + i * step, height - 3 - ((height - 6) * v) / max] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="kw-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" />
    </svg>
  );
}

export const LangTag = ({ lang }: { lang: Lang | string }) => <span className={`kw-lang kw-l-${lang}`}>{langLabel(lang)}</span>;

export const OppTag = ({ kind }: { kind: Opportunity | string }) => (
  <span className={`kw-opp kw-o-${kind}`}>{OPPORTUNITIES[kind as Opportunity]?.label ?? kind}</span>
);

export const SiteTag = ({ site }: { site: Site | string }) => <span className={`kw-site kw-s-${site}`}>{siteLabel(site)}</span>;

export const SourceList = ({ sources }: { sources: string }) => (
  <span className="hw-muted wa-small">{sources.split(',').filter(Boolean).map(sourceLabel).join(' · ')}</span>
);

/** Both / Doctor Dekho / nexeagle.com. */
export function SitePicker({ value, onChange }: { value: Site | ''; onChange: (s: Site | '') => void }) {
  const all: { id: Site | ''; label: string }[] = [{ id: '', label: 'Both' }, ...SITES];
  return (
    <div className="sc-seg" role="group" aria-label="Website">
      {all.map(s => <button key={s.id || 'both'} type="button" className={value === s.id ? 'on' : ''} aria-pressed={value === s.id} onClick={() => onChange(s.id)}>{s.label}</button>)}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="hw-empty">{children}</p>;
}

/** A labelled select with an "All" choice. */
export function Filter({ label, value, onChange, options, all = 'All' }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; all?: string }) {
  return (
    <label className="kw-filter">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        <option value="">{all}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
