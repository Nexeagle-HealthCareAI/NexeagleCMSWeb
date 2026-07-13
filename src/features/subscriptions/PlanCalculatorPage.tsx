import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, Check, Sparkles, Save } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import {
    planCalculatorService as svc,
    MODULE_KEYS,
    type CalculateResponse,
    type ChooseResponse,
    type ModuleChargeRow,
} from './services/planCalculatorService';
import './PlanCalculatorPage.css';

const PLATFORMS = ['EasyHMS', '1Rad'];
const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const PlanCalculatorPage: React.FC = () => {
    const permissions = useAuthStore((s) => s.permissions);
    const canManage = permissions.includes('subscriptions.manage');

    const [platform, setPlatform] = useState('EasyHMS');
    const [doctors, setDoctors] = useState(3);
    const [beds, setBeds] = useState(45);
    const [modules, setModules] = useState<Set<string>>(new Set());
    const [result, setResult] = useState<CalculateResponse | null>(null);
    const [chosen, setChosen] = useState<ChooseResponse | null>(null);
    const [busy, setBusy] = useState(false);

    const [charges, setCharges] = useState<ModuleChargeRow[]>([]);
    const [savingCharges, setSavingCharges] = useState(false);

    const toggleModule = (k: string) => {
        setModules((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };

    const calculate = useCallback(async () => {
        try {
            const res = await svc.calculate(platform, doctors, beds, [...modules]);
            setResult(res);
        } catch (e) {
            console.error('calculate failed', e);
        }
    }, [platform, doctors, beds, modules]);

    // Live recalculation (debounced) as inputs change.
    useEffect(() => {
        setChosen(null);
        const t = setTimeout(calculate, 350);
        return () => clearTimeout(t);
    }, [calculate]);

    // Load module charges for the platform.
    useEffect(() => {
        svc.getModuleCharges(platform).then(setCharges).catch(() => setCharges([]));
    }, [platform]);

    const choose = async (planId?: string) => {
        setBusy(true);
        try {
            const res = await svc.choose({ applicationName: platform, planId, doctors, beds, modules: [...modules] });
            setChosen(res);
        } catch (e: any) {
            alert(e.response?.data?.message || e.response?.data || 'Could not create the plan.');
        } finally {
            setBusy(false);
        }
    };

    const saveCharges = async () => {
        setSavingCharges(true);
        try {
            const updated = await svc.putModuleCharges(platform, charges);
            setCharges(updated);
            await calculate();
            alert('Module charges saved.');
        } catch (e: any) {
            alert(e.response?.data?.message || e.response?.data || 'Could not save charges.');
        } finally {
            setSavingCharges(false);
        }
    };

    const b = result?.breakdown;

    return (
        <div className="calc-page">
            <div className="calc-header">
                <div>
                    <h1>Plan Calculator</h1>
                    <p>Size a plan by doctors, beds, and modules — pick a ready tier or generate a custom plan.</p>
                </div>
            </div>

            <div className="calc-grid">
                {/* Inputs */}
                <div className="calc-card">
                    <div className="calc-card-title"><Calculator size={18} /> Configure</div>

                    <label className="calc-field">Platform
                        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </label>

                    <div className="calc-two">
                        <label className="calc-field">Doctors
                            <input type="number" min={0} value={doctors} onChange={(e) => setDoctors(parseInt(e.target.value) || 0)} />
                        </label>
                        <label className="calc-field">Beds
                            <input type="number" min={0} value={beds} onChange={(e) => setBeds(parseInt(e.target.value) || 0)} />
                        </label>
                    </div>

                    <div className="calc-field">
                        <span>Modules</span>
                        <div className="calc-modules">
                            {MODULE_KEYS.map((k) => (
                                <label key={k} className={`calc-chip ${modules.has(k) ? 'on' : ''}`}>
                                    <input type="checkbox" checked={modules.has(k)} onChange={() => toggleModule(k)} />
                                    {k}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Result */}
                <div className="calc-card">
                    <div className="calc-card-title"><Sparkles size={18} /> Price</div>

                    {result?.matchedTier && (
                        <div className="calc-tier">
                            <div>
                                <div className="calc-tier-name">Fits tier: <b>{result.matchedTier.name}</b></div>
                                <div className="calc-tier-cap">{result.matchedTier.maxDoctors} doctors · {result.matchedTier.maxBeds} beds</div>
                            </div>
                            <div className="calc-tier-price">{money(result.matchedTier.price)}</div>
                            {canManage && (
                                <button className="calc-btn ghost" disabled={busy} onClick={() => choose(result.matchedTier!.planId)}>
                                    Use tier
                                </button>
                            )}
                        </div>
                    )}

                    {b && (
                        <table className="calc-breakdown">
                            <tbody>
                                <tr><td>Doctors</td><td>{money(b.ratePerDoctor)} × {b.doctors}</td><td className="amt">{money(b.doctorsSubtotal)}</td></tr>
                                <tr><td>Beds</td><td>{money(b.ratePerBed)} × {b.beds}</td><td className="amt">{money(b.bedsSubtotal)}</td></tr>
                                {b.modules.map((m) => (
                                    <tr key={m.module}><td>{m.module}</td><td>module</td><td className="amt">{money(m.charge)}</td></tr>
                                ))}
                                <tr className="calc-total"><td>Total / cycle</td><td>{result && result.basePrice > b.total ? <span className="calc-strike">{money(result.basePrice)}</span> : ''}</td><td className="amt">{money(b.total)}</td></tr>
                            </tbody>
                        </table>
                    )}

                    {canManage && (
                        <button className="calc-btn primary" disabled={busy} onClick={() => choose()}>
                            <Check size={16} /> Generate custom plan
                        </button>
                    )}

                    {chosen && (
                        <div className="calc-chosen">
                            Plan ready — <b>{chosen.name}</b> ({chosen.isCustom ? 'custom' : 'tier'})
                            <div className="calc-planid">PlanId: <code>{chosen.planId}</code></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Module charge config */}
            {canManage && (
                <div className="calc-card calc-charges">
                    <div className="calc-card-title"><Save size={18} /> Module charges — {platform} <span className="calc-hint">(0 = free)</span></div>
                    <div className="calc-charge-grid">
                        {charges.map((c, i) => (
                            <label key={c.module} className="calc-field">{c.module}
                                <input type="number" min={0} value={c.charge}
                                    onChange={(e) => setCharges(charges.map((x, j) => j === i ? { ...x, charge: parseFloat(e.target.value) || 0 } : x))} />
                            </label>
                        ))}
                    </div>
                    <button className="calc-btn ghost" disabled={savingCharges} onClick={saveCharges}>Save charges</button>
                </div>
            )}
        </div>
    );
};

export default PlanCalculatorPage;
