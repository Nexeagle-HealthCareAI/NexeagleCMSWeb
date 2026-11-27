import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { waService, waError } from '../services/waService';
import type { WaProfile } from '../types';

// The business profile people see when they open the number's profile in WhatsApp (Meta's
// whatsapp_business_profile). Used in Settings and as a step of Setup. The display name is not here:
// Meta reviews it, and it is changed in WhatsApp Manager.

const VERTICALS: [string, string][] = [
  ['HEALTH', 'Medical and health'], ['PROF_SERVICES', 'Professional services'], ['EDU', 'Education'], ['NONPROFIT', 'Non-profit'],
  ['OTHER', 'Other'], ['FINANCE', 'Finance'], ['RETAIL', 'Shopping and retail'], ['EVENT_PLAN', 'Events'], ['TRAVEL', 'Travel'],
  ['HOTEL', 'Hotel and lodging'], ['RESTAURANT', 'Restaurant'], ['GOVT', 'Public service'], ['AUTO', 'Automotive'], ['BEAUTY', 'Beauty and spa'],
  ['APPAREL', 'Clothing'], ['ENTERTAIN', 'Entertainment'], ['GROCERY', 'Food and grocery'], ['UNDEFINED', 'Not set'],
];

export default function ProfileCard({ canEdit, title = 'Business profile', onSaved }: { canEdit: boolean; title?: string; onSaved?: () => void }) {
  const [p, setP] = useState<WaProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { waService.profile().then(setP).catch(e => setError(waError(e))); }, []);
  useEffect(() => {
    if (!picture) { setPreview(null); return; }
    const u = URL.createObjectURL(picture);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [picture]);

  const set = (x: Partial<WaProfile>) => setP(cur => (cur ? { ...cur, ...x } : cur));
  const save = async () => {
    if (!p) return;
    setBusy(true);
    try {
      setP(await waService.saveProfile({ ...p, websites: p.websites.map(w => w.trim()).filter(Boolean) }, picture));
      setPicture(null);
      toast.success('Profile saved at WhatsApp');
      onSaved?.();
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">{title}</h3>
      <p className="hw-muted wa-small">What people see when they open the number's profile in WhatsApp.</p>
      {error && <p className="hw-muted">{error}</p>}
      {p && (
        <fieldset disabled={!canEdit} className="wa-plain">
          <div className="wa-profile-pic">
            {preview || p.pictureUrl ? <img src={preview ?? p.pictureUrl ?? ''} alt="Profile picture" /> : <div className="wa-avatar wa-avatar-lg">?</div>}
            {canEdit && (
              <label className="wa-field">
                <span>Picture (square JPG or PNG, at least 192 × 192, up to 5 MB)</span>
                <input type="file" accept="image/jpeg,image/png" onChange={e => setPicture(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          <label className="wa-field"><span>About <small className="hw-muted">{p.about?.length ?? 0}/139</small></span><input type="text" maxLength={139} value={p.about ?? ''} onChange={e => set({ about: e.target.value })} /></label>
          <label className="wa-field"><span>Description <small className="hw-muted">{p.description?.length ?? 0}/512</small></span><textarea rows={3} maxLength={512} value={p.description ?? ''} onChange={e => set({ description: e.target.value })} /></label>
          <div className="wa-grid2">
            <label className="wa-field"><span>Email</span><input type="text" maxLength={128} value={p.email ?? ''} onChange={e => set({ email: e.target.value })} /></label>
            <label className="wa-field"><span>Category</span>
              <select value={p.vertical ?? 'UNDEFINED'} onChange={e => set({ vertical: e.target.value })}>
                {VERTICALS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="wa-field"><span>Address</span><input type="text" maxLength={256} value={p.address ?? ''} onChange={e => set({ address: e.target.value })} /></label>
          <div className="wa-grid2">
            {[0, 1].map(i => (
              <label key={i} className="wa-field"><span>Website {i + 1}</span>
                <input type="text" placeholder="https://" value={p.websites[i] ?? ''} onChange={e => { const w = [...p.websites]; w[i] = e.target.value; set({ websites: w }); }} />
              </label>
            ))}
          </div>
          {canEdit && <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button></div>}
        </fieldset>
      )}
    </section>
  );
}

