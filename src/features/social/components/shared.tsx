import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { socialService, socialError } from '../services/socialService';
import { channelName, PRODUCTS, STATUS_LABEL } from '../socialUtils';
import type { SocialLead, SocialMakeLead } from '../types';

// Small pieces shared by the Social tabs.

export function ChannelTag({ channel }: { channel: string }) {
  const c = channel === 'messenger' ? 'facebook' : channel;
  return <span className={`sc-chan sc-chan-${c}`}>{channelName(channel)}</span>;
}

const STATUS_CLASS: Record<string, string> = {
  Published: 'wa-st-ok', Scheduled: 'wa-st-wait', AwaitingApproval: 'wa-st-warn', SentBack: 'wa-st-warn', Failed: 'wa-st-bad',
  Publishing: 'wa-b-sending', Draft: '', Cancelled: '',
};
export const StatusTag = ({ status }: { status: string }) => <span className={`wa-st ${STATUS_CLASS[status] ?? ''}`}>{STATUS_LABEL[status] ?? status}</span>;

/** A single-series bar chart with a hover tip per day; the same look as WhatsApp → Billing. */
export function Bars({ items, label, format }: { items: { key: string; label: string; value: number }[]; label: string; format: (v: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  const top = items.reduce((b, i) => (i.value > b.value ? i : b), items[0] ?? { key: '', label: '', value: 0 });
  return (
    <>
      <div className="wa-bars" role="img" aria-label={`${label}, highest ${format(top.value)} on ${top.label}`}>
        {items.map(i => (
          <div key={i.key} className="wa-bar-col" tabIndex={0}>
            <div className="wa-bar-stack" style={{ height: `${(i.value / max) * 100}%` }}><div className="wa-s1" style={{ flex: 1 }} /></div>
            <div className="wa-tip"><b>{i.label}</b><span>{format(i.value)}</span></div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div className="wa-axis"><span>{items[0].label}</span><span>highest {format(top.value)} · {top.label}</span><span>{items[items.length - 1].label}</span></div>
      )}
    </>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="wa-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wa-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="wa-row wa-between"><h3 className="wa-h2">{title}</h3><button type="button" className="hw-btn" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

/** A post's picture or video from the CMS's own storage (needs sign-in, so it is fetched as a blob). */
export function MediaThumb({ mediaKey, mime, alt, className }: { mediaKey: string; mime: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    socialService.media(mediaKey).then(b => { if (live) { made = URL.createObjectURL(b); setUrl(made); } }).catch(() => { /* placeholder stays */ });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [mediaKey]);
  if (!url) return <div className={`sc-ph ${className ?? ''}`}>{mime.startsWith('video/') ? 'Video' : 'Picture'}</div>;
  return mime.startsWith('video/')
    ? <video className={className} src={url} muted playsInline controls aria-label={alt} />
    : <img className={className} src={url} alt={alt} />;
}

/** Make a CRM lead from a conversation or a comment. */
export function MakeLead({ name: initialName, onMake, disabled }: { name?: string; onMake: (p: SocialMakeLead) => Promise<SocialLead>; disabled?: boolean }) {
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState('');
  const [busy, setBusy] = useState(false);
  const make = async () => {
    if (!name.trim()) { toast.error('Give their name.'); return; }
    setBusy(true);
    try {
      await onMake({ name: name.trim(), phone: phone.trim() || undefined, interestedIn: interest || undefined });
      toast.success('Lead made in the CRM.');
    } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
  };
  return (
    <div className="sc-makelead">
      <label className="wa-field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} disabled={disabled} /></label>
      <label className="wa-field"><span>Phone (if they gave it)</span><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" disabled={disabled} /></label>
      <label className="wa-field"><span>Interested in</span>
        <select value={interest} onChange={e => setInterest(e.target.value)} disabled={disabled}>
          <option value="">—</option>
          {PRODUCTS.map(p => <option key={p}>{p}</option>)}
        </select>
      </label>
      <button type="button" className="hw-btn hw-btn-primary" onClick={make} disabled={busy || disabled}>{busy ? 'Making…' : 'Make lead'}</button>
    </div>
  );
}
