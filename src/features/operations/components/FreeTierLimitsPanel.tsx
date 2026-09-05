import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    getGlobalFreeTierLimit, setGlobalFreeTierLimit,
    getHospitalFreeTierOverrides, setHospitalFreeTierOverride,
    type HospitalFreeTierLimitItem,
} from '../services/freeTierSettingsService';

const inputStyle: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#334155',
    width: 100,
};

export const FreeTierLimitsPanel: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const [globalLimit, setGlobalLimitState] = useState<number | null>(null);
    const [globalInput, setGlobalInput] = useState('');
    const [savingGlobal, setSavingGlobal] = useState(false);

    const [hospitals, setHospitals] = useState<HospitalFreeTierLimitItem[]>([]);
    const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
    const [savingHospitalId, setSavingHospitalId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [global, hospitalList] = await Promise.all([
                getGlobalFreeTierLimit(),
                getHospitalFreeTierOverrides(),
            ]);
            setGlobalLimitState(global.globalMonthlyLimit);
            setGlobalInput(String(global.globalMonthlyLimit));
            setHospitals(hospitalList);
            setOverrideInputs(Object.fromEntries(hospitalList.map(h => [h.hospitalId, h.monthlyLimit != null ? String(h.monthlyLimit) : ''])));
        } catch {
            toast.error('Could not load free-tier limit settings.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (expanded) load(); }, [expanded, load]);

    const handleSaveGlobal = async () => {
        const value = Number(globalInput);
        if (!Number.isFinite(value) || value <= 0) {
            toast.error('Enter a whole number greater than zero.');
            return;
        }
        try {
            setSavingGlobal(true);
            const res = await setGlobalFreeTierLimit(Math.round(value));
            if (!res.success) throw new Error(res.message ?? 'Failed');
            setGlobalLimitState(Math.round(value));
            toast.success('Global free-tier limit updated.');
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Could not save.');
        } finally {
            setSavingGlobal(false);
        }
    };

    const handleSaveOverride = async (hospitalId: string) => {
        const raw = (overrideInputs[hospitalId] ?? '').trim();
        const value = raw === '' ? null : Number(raw);
        if (value != null && (!Number.isFinite(value) || value < 0)) {
            toast.error('Enter a whole number, or leave blank to use the global default.');
            return;
        }
        try {
            setSavingHospitalId(hospitalId);
            const res = await setHospitalFreeTierOverride(hospitalId, value != null ? Math.round(value) : null);
            if (!res.success) throw new Error(res.message ?? 'Failed');
            toast.success(res.message || 'Saved.');
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Could not save.');
        } finally {
            setSavingHospitalId(null);
        }
    };

    return (
        <div className="premium-table-card" style={{ marginBottom: 24 }}>
            <button
                onClick={() => setExpanded(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 20, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <div>
                    <h2 className="premium-table-title" style={{ margin: 0 }}>Free-Tier Monthly Limit</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        {globalLimit != null ? `Global default: ${globalLimit} patient management actions/month` : 'Global default + per-hospital overrides for the usage-based free tier.'}
                    </p>
                </div>
                {expanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </button>

            {expanded && (
                <div style={{ padding: '0 20px 20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                            <Loader2 className="animate-spin" size={20} color="#94a3b8" />
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: 14, background: '#f8fafc', borderRadius: 10 }}>
                                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Global default (applies to every hospital with no override)</label>
                                <input type="number" min={1} style={inputStyle} value={globalInput} onChange={e => setGlobalInput(e.target.value)} />
                                <button
                                    onClick={handleSaveGlobal}
                                    disabled={savingGlobal}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                >
                                    {savingGlobal ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save
                                </button>
                            </div>

                            <div className="premium-responsive-wrapper">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Hospital</th>
                                            <th>Override (blank = global default)</th>
                                            <th>Effective Limit</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hospitals.map(h => (
                                            <tr key={h.hospitalId} className="premium-row">
                                                <td className="premium-hospital-name">{h.hospitalName}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        style={inputStyle}
                                                        placeholder="Global default"
                                                        value={overrideInputs[h.hospitalId] ?? ''}
                                                        onChange={e => setOverrideInputs(prev => ({ ...prev, [h.hospitalId]: e.target.value }))}
                                                    />
                                                </td>
                                                <td>{h.effectiveLimit}</td>
                                                <td>
                                                    <button
                                                        onClick={() => handleSaveOverride(h.hospitalId)}
                                                        disabled={savingHospitalId === h.hospitalId}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                                                    >
                                                        {savingHospitalId === h.hospitalId ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />} Save
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {hospitals.length === 0 && (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>No hospitals found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FreeTierLimitsPanel;
