import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { WaNumber, WaProfile, WaRate, WaSettings } from '../types';
import { money, when } from '../waUtils';

// The number's health (from Meta), the business profile people see in WhatsApp, the monthly budget,
// sending speed and the price list used for estimates. Meta changes prices on 1 Jan, 1 Apr, 1 Jul and 1 Oct.

const VERTICALS: [string, string][] = [
  ['HEALTH', 'Medical and health'], ['PROF_SERVICES', 'Professional services'], ['EDU', 'Education'], ['NONPROFIT', 'Non-profit'],
  ['OTHER', 'Other'], ['FINANCE', 'Finance'], ['RETAIL', 'Shopping and retail'], ['EVENT_PLAN', 'Events'], ['TRAVEL', 'Travel'],
  ['HOTEL', 'Hotel and lodging'], ['RESTAURANT', 'Restaurant'], ['GOVT', 'Public service'], ['AUTO', 'Automotive'], ['BEAUTY', 'Beauty and spa'],
  ['APPAREL', 'Clothing'], ['ENTERTAIN', 'Entertainment'], ['GROCERY', 'Food and grocery'], ['UNDEFINED', 'Not set'],
];

const LIMIT_LABEL: Record<string, string> = {
  TIER_50: '50 people a day', TIER_250: '250 people a day', TIER_1K: '1,000 people a day', TIER_10K: '10,000 people a day',
  TIER_100K: '100,000 people a day', TIER_UNLIMITED: 'No daily limit',
};

export default function SettingsTab({ can }: { can: WaCan }) {
  return (
    <div className="wa-pad wa-settings">
      <NumberCard />
      <ProfileCard canEdit={can.settings} />
      <MoneyCard canEdit={can.settings} />
    </div>
  );
}

function NumberCard() {
  const [n, setN] = useState<WaNumber | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { waService.number().then(setN).catch(e => setError(waError(e))); }, []);
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">Number</h3>
      {error && <p className="hw-err">{error}</p>}
      {!n && !error && <p className="hw-muted">Asking Meta…</p>}
      {n && !n.connected && <p className="hw-muted">{n.problem || 'Not connected on this environment.'}</p>}
      {n?.connected && (
        <dl className="wa-dl">
          <dt>Number</dt><dd>{n.displayPhone}</dd>
          <dt>Display name</dt><dd>{n.verifiedName}{n.nameStatus && n.nameStatus !== 'APPROVED' ? <span className="hw-muted"> · {n.nameStatus.toLowerCase().replace(/_/g, ' ')}</span> : null}</dd>
          <dt>Quality</dt><dd><span className={`wa-quality wa-q-${(n.quality ?? '').toLowerCase()}`}>{n.quality === 'GREEN' ? 'High' : n.quality === 'YELLOW' ? 'Medium' : n.quality === 'RED' ? 'Low' : n.quality ?? '—'}</span> <small className="hw-muted">Blocks and reports lower it; low quality can lower the daily limit.</small></dd>
          <dt>Daily limit</dt><dd>{LIMIT_LABEL[n.messagingLimit ?? ''] ?? n.messagingLimit ?? '—'} <small className="hw-muted">new people a business may start chats with in 24 hours</small></dd>
          {n.throughput && <><dt>Speed</dt><dd>{n.throughput.toLowerCase()}</dd></>}
        </dl>
      )}
    </section>
  );
}

function ProfileCard({ canEdit }: { canEdit: boolean }) {
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
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">Business profile</h3>
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

function MoneyCard({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<WaSettings | null>(null);
  const [budget, setBudget] = useState('');
  const [speed, setSpeed] = useState('20');
  const [rates, setRates] = useState<WaRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const take = (x: WaSettings) => {
    setS(x);
    setBudget(x.monthlyBudget != null ? String(x.monthlyBudget) : '');
    setSpeed(String(x.sendPerSecond));
    setRates(x.rates.map(r => ({ ...r })));
  };
  useEffect(() => { waService.settings().then(take).catch(e => setError(waError(e))); }, []);

  const save = async () => {
    const b = budget.trim() === '' ? null : Number(budget);
    if (b != null && (Number.isNaN(b) || b < 0)) { toast.error('The budget is not a number.'); return; }
    setBusy(true);
    try {
      take(await waService.saveSettings({ monthlyBudget: b, sendPerSecond: Number(speed) || 20, rates: rates.map(r => ({ ...r, country: r.country.trim().toUpperCase(), category: r.category.trim().toLowerCase(), rate: Number(r.rate) })) }));
      toast.success('Saved');
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };

  const setRate = (i: number, x: Partial<WaRate>) => setRates(cur => cur.map((r, j) => (j === i ? { ...r, ...x } : r)));
  const cur = s?.currency ?? 'INR';

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">Budget and prices</h3>
      {error && <p className="hw-err">{error}</p>}
      {s && (
        <fieldset disabled={!canEdit} className="wa-plain">
          <div className="wa-grid2">
            <label className="wa-field"><span>Monthly budget ({cur}, before GST)</span>
              <input type="number" min={0} step="100" value={budget} placeholder="No limit" onChange={e => setBudget(e.target.value)} />
              <small className="hw-muted">A broadcast that would pass it waits for someone who may approve WhatsApp spending.</small>
            </label>
            <label className="wa-field"><span>Broadcast speed (messages a second)</span>
              <input type="number" min={1} max={80} value={speed} onChange={e => setSpeed(e.target.value)} />
              <small className="hw-muted">WhatsApp's usual limit is 80; lower is gentler on the number's quality.</small>
            </label>
          </div>
          <div className="wa-field">
            <span>Price per delivered message, used for estimates</span>
            <table className="wa-mini">
              <thead><tr><th>Country</th><th>Kind</th><th className="wa-num">Price ({cur})</th><th>Updated</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {rates.map((r, i) => (
                  <tr key={i}>
                    <td><input type="text" maxLength={2} value={r.country} onChange={e => setRate(i, { country: e.target.value })} aria-label="Country code" className="wa-in-sm" /></td>
                    <td>
                      <select value={r.category} onChange={e => setRate(i, { category: e.target.value })} aria-label="Kind">
                        {['marketing', 'utility', 'authentication', 'service'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="wa-num"><input type="number" min={0} step="0.0001" value={r.rate} onChange={e => setRate(i, { rate: e.target.value as unknown as number })} aria-label="Price" className="wa-in-sm" /></td>
                    <td className="wa-small hw-muted">{when(r.updatedAt)}</td>
                    {canEdit && <td><button type="button" className="hw-btn" onClick={() => setRates(cur2 => cur2.filter((_, j) => j !== i))} aria-label="Remove price"><Trash2 size={13} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {canEdit && <button type="button" className="hw-btn" onClick={() => setRates(r => [...r, { country: 'IN', category: 'marketing', rate: 0, currency: cur }])}><Plus size={13} /> Add a price</button>}
            <small className="hw-muted">
              Check these against Meta's current WhatsApp rate card for India whenever Meta changes prices. Country “**” is used for any country not listed.
              {rates.find(r => r.country === 'IN' && r.category === 'marketing') && <> Now: 1,000 marketing messages in India ≈ {money(1000 * Number(rates.find(r => r.country === 'IN' && r.category === 'marketing')!.rate), cur)}.</>}
            </small>
          </div>
          {canEdit && <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div>}
        </fieldset>
      )}
    </section>
  );
}
