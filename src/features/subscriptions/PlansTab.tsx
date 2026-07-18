import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Save, X, Trash2, Sparkles, IndianRupee, Users, BedDouble, ListChecks, Wand2 } from 'lucide-react';
import { api } from '../../services/api';
import './ManagePlansPage.css';

type VariantCycle = 'Quarterly' | 'Half-Yearly' | 'Yearly';
const VARIANT_CYCLES: VariantCycle[] = ['Quarterly', 'Half-Yearly', 'Yearly'];
const VARIANT_MULTIPLIER: Record<VariantCycle, number> = { Quarterly: 3, 'Half-Yearly': 6, Yearly: 12 };
const DEFAULT_VARIANT_DISCOUNT: Record<VariantCycle, number> = { Quarterly: 5, 'Half-Yearly': 10, Yearly: 15 };

type BillingCycleTab = 'Monthly' | VariantCycle;
const BILLING_CYCLE_TABS: BillingCycleTab[] = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

// Dedicated EasyHMS plan catalog (dbo.EasyHmsSubscriptionPlans via CMSAPI's
// EasyHmsSubscriptionPlansController) — kept separate from 1Rad's own plan management, since
// doctor/bed limits and the Enterprise tier are EasyHMS-specific concepts.
interface EasyHmsSubscriptionPlan {
    planId: string;
    name: string;
    basePrice: number;
    discountPrice: number;
    billingCycle: string;
    isActive: boolean;
    // Newline-separated in the editor; stored/sent as a JSON string array.
    features: string[];
    // null = unlimited (used for the Enterprise tier).
    maxDoctors: number | null;
    maxBeds: number | null;
    isEnterprise: boolean;
}

const parseFeatures = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const EMPTY_PLAN: EasyHmsSubscriptionPlan = {
    planId: '', name: '', basePrice: 2500, discountPrice: 1099, billingCycle: 'Monthly',
    isActive: true, features: [], maxDoctors: null, maxBeds: null, isEnterprise: false,
};

export const PlansTab: React.FC = () => {
    const [plans, setPlans] = useState<EasyHmsSubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [cycleTab, setCycleTab] = useState<BillingCycleTab>('Monthly');
    const [editingPlan, setEditingPlan] = useState<EasyHmsSubscriptionPlan | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generatingFor, setGeneratingFor] = useState<EasyHmsSubscriptionPlan | null>(null);
    const [variantDiscounts, setVariantDiscounts] = useState<Record<VariantCycle, number>>(DEFAULT_VARIANT_DISCOUNT);
    const [generating, setGenerating] = useState(false);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await api.get('/EasyHmsSubscriptionPlans');
            const normalized: EasyHmsSubscriptionPlan[] = (response.data ?? []).map((p: any) => ({
                ...p,
                features: parseFeatures(p.features),
                maxDoctors: p.maxDoctors ?? null,
                maxBeds: p.maxBeds ?? null,
                isEnterprise: !!p.isEnterprise,
            }));
            setPlans(normalized);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const closeDrawer = () => {
        if (saving) return;
        setEditingPlan(null);
        setIsCreating(false);
    };

    const handleSave = async (plan: EasyHmsSubscriptionPlan) => {
        try {
            setSaving(true);
            // Backend stores Features as a raw JSON string, not an array.
            const payload = { ...plan, features: JSON.stringify(plan.features ?? []) };
            if (isCreating) {
                const { planId, ...body } = payload;
                await api.post('/EasyHmsSubscriptionPlans', body);
            } else {
                await api.put(`/EasyHmsSubscriptionPlans/${plan.planId}`, payload);
            }
            setEditingPlan(null);
            setIsCreating(false);
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error saving plan.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (planId: string) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;

        try {
            await api.delete(`/EasyHmsSubscriptionPlans/${planId}`);
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error deleting plan.");
        }
    };

    const savingsPercent = editingPlan && !editingPlan.isEnterprise && editingPlan.discountPrice < editingPlan.basePrice && editingPlan.basePrice > 0
        ? Math.round(((editingPlan.basePrice - editingPlan.discountPrice) / editingPlan.basePrice) * 100)
        : null;

    const openGenerateVariants = (plan: EasyHmsSubscriptionPlan) => {
        setVariantDiscounts(DEFAULT_VARIANT_DISCOUNT);
        setGeneratingFor(plan);
    };

    const closeGenerateVariants = () => {
        if (generating) return;
        setGeneratingFor(null);
    };

    const plansInTab = plans.filter(p => p.billingCycle === cycleTab);

    const variantExists = (plan: EasyHmsSubscriptionPlan, cycle: VariantCycle) =>
        plans.some(p => p.name === plan.name && p.billingCycle === cycle);

    const computeVariantPrice = (amount: number, cycle: VariantCycle, discountPercent: number) =>
        Math.round(amount * VARIANT_MULTIPLIER[cycle] * (1 - discountPercent / 100));

    const handleGenerateVariants = async () => {
        if (!generatingFor) return;
        const toCreate = VARIANT_CYCLES.filter(cycle => !variantExists(generatingFor, cycle));
        if (toCreate.length === 0) {
            alert('Quarterly, Half-Yearly and Yearly versions of this plan already exist.');
            return;
        }

        try {
            setGenerating(true);
            for (const cycle of toCreate) {
                const discount = variantDiscounts[cycle];
                const { planId, ...rest } = generatingFor;
                const payload = {
                    ...rest,
                    basePrice: Math.round(generatingFor.basePrice * VARIANT_MULTIPLIER[cycle]),
                    discountPrice: computeVariantPrice(generatingFor.discountPrice, cycle, discount),
                    billingCycle: cycle,
                    features: JSON.stringify(generatingFor.features ?? []),
                };
                await api.post('/EasyHmsSubscriptionPlans', payload);
            }
            setGeneratingFor(null);
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || 'Error generating plan variants.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div>
            <div className="manage-plans-header">
                <div>
                    <p>Configure pricing, doctor/bed limits, and features — changes appear on the EasyHMS subscription page immediately.</p>
                </div>
                <button
                    className="add-plan-btn"
                    onClick={() => {
                        setIsCreating(true);
                        setEditingPlan({ ...EMPTY_PLAN, billingCycle: cycleTab });
                    }}
                >
                    <Plus size={16} /> New Plan
                </button>
            </div>

            <div className="application-tabs">
                {BILLING_CYCLE_TABS.map(cycle => {
                    const count = plans.filter(p => p.billingCycle === cycle).length;
                    return (
                        <button
                            key={cycle}
                            className={`tab-btn ${cycleTab === cycle ? 'active' : ''}`}
                            onClick={() => setCycleTab(cycle)}
                        >
                            {cycle} {count > 0 && `(${count})`}
                        </button>
                    );
                })}
            </div>

            <div className="plans-grid">
                {loading ? <p>Loading...</p> : plansInTab.length === 0 ? (
                    <div className="plans-empty-state">
                        <p>No {cycleTab} plans yet.</p>
                        <button
                            className="add-plan-btn"
                            onClick={() => {
                                setIsCreating(true);
                                setEditingPlan({ ...EMPTY_PLAN, billingCycle: cycleTab });
                            }}
                        >
                            <Plus size={16} /> New {cycleTab} Plan
                        </button>
                    </div>
                ) : plansInTab.map(plan => (
                    <div key={plan.planId} className={`plan-card ${!plan.isActive ? 'inactive' : ''}`}>
                        <div className="plan-card-header">
                            <h3>{plan.name}</h3>
                            <div style={{display: 'flex', gap: '8px'}}>
                                {plan.billingCycle === 'Monthly' && !plan.isEnterprise && (
                                    <button className="icon-btn" title="Generate Quarterly / Half-Yearly / Yearly" onClick={() => openGenerateVariants(plan)}><Wand2 size={16}/></button>
                                )}
                                <button className="icon-btn" onClick={() => { setEditingPlan(plan); setIsCreating(false); }}><Edit2 size={16}/></button>
                                <button className="icon-btn delete-btn" onClick={() => handleDelete(plan.planId)} style={{color: '#ef4444'}}><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="plan-card-body">
                            {plan.isEnterprise ? (
                                <div className="price-row">
                                    <span className="label">Pricing:</span>
                                    <span className="value highlight">Custom — Contact Us</span>
                                </div>
                            ) : (
                                <>
                                    <div className="price-row">
                                        <span className="label">Base Price:</span>
                                        <span className="value strike">₹{plan.basePrice}</span>
                                    </div>
                                    <div className="price-row">
                                        <span className="label">Discounted:</span>
                                        <span className="value highlight">₹{plan.discountPrice}</span>
                                    </div>
                                </>
                            )}
                            <div className="price-row">
                                <span className="label">Cycle:</span>
                                <span className="value">{plan.billingCycle}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Doctors:</span>
                                <span className="value">{plan.maxDoctors ?? 'Unlimited'}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Beds:</span>
                                <span className="value">{plan.maxBeds ?? 'Unlimited'}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Status:</span>
                                <span className="value">{plan.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            {plan.features.length > 0 && (
                                <ul style={{ marginTop: '10px', paddingLeft: '18px', fontSize: '13px', color: '#475569' }}>
                                    {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {editingPlan && (
                <div className="plan-drawer-overlay" onClick={closeDrawer}>
                    <div className="plan-drawer" onClick={e => e.stopPropagation()}>
                        <div className="plan-drawer-header">
                            <div className="plan-drawer-header-icon">
                                {isCreating ? <Plus size={20} /> : <Edit2 size={20} />}
                            </div>
                            <div className="plan-drawer-header-text">
                                <h3>{isCreating ? 'Create New Plan' : 'Edit Plan'}</h3>
                                <p>Changes go live on the EasyHMS subscription page immediately.</p>
                            </div>
                            <button className="plan-drawer-close" onClick={closeDrawer} disabled={saving}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="plan-drawer-body">
                            <div className="plan-drawer-section">
                                <div className="plan-drawer-section-title">Basic Details</div>
                                <div className="form-grid">
                                    <div>
                                        <label>Plan Name</label>
                                        <input type="text" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} />
                                    </div>
                                    <div>
                                        <label>Billing Cycle</label>
                                        <select value={editingPlan.billingCycle} onChange={e => setEditingPlan({...editingPlan, billingCycle: e.target.value})}>
                                            <option>Monthly</option>
                                            <option>Quarterly</option>
                                            <option>Half-Yearly</option>
                                            <option>Yearly</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="plan-drawer-section">
                                <div className="plan-drawer-section-title"><IndianRupee size={14} /> Pricing</div>
                                <div className="form-grid">
                                    <div>
                                        <label>Base Price (₹)</label>
                                        <input type="number" value={editingPlan.basePrice} onChange={e => setEditingPlan({...editingPlan, basePrice: parseFloat(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label>Discount Price (₹)</label>
                                        <input type="number" value={editingPlan.discountPrice} onChange={e => setEditingPlan({...editingPlan, discountPrice: parseFloat(e.target.value)})} />
                                    </div>
                                </div>
                                {savingsPercent !== null && savingsPercent > 0 && (
                                    <div className="plan-drawer-savings-badge">
                                        <Sparkles size={12} /> {savingsPercent}% off base price
                                    </div>
                                )}
                            </div>

                            <div className="plan-drawer-section">
                                <div className="plan-drawer-section-title"><Users size={14} /> Capacity Limits</div>
                                <div className="form-grid">
                                    <div>
                                        <label><Users size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />Max Doctors (blank = unlimited)</label>
                                        <input
                                            type="number" min={0}
                                            value={editingPlan.maxDoctors ?? ''}
                                            disabled={editingPlan.isEnterprise}
                                            onChange={e => setEditingPlan({...editingPlan, maxDoctors: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
                                        />
                                    </div>
                                    <div>
                                        <label><BedDouble size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />Max Beds (blank = unlimited)</label>
                                        <input
                                            type="number" min={0}
                                            value={editingPlan.maxBeds ?? ''}
                                            disabled={editingPlan.isEnterprise}
                                            onChange={e => setEditingPlan({...editingPlan, maxBeds: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
                                        />
                                    </div>
                                </div>
                                <label className="plan-drawer-toggle-row">
                                    <input
                                        type="checkbox"
                                        checked={editingPlan.isEnterprise}
                                        onChange={e => setEditingPlan({
                                            ...editingPlan,
                                            isEnterprise: e.target.checked,
                                            // Enterprise has no fixed limits/price on the tile — clear them so a stale
                                            // number never accidentally applies once the flag is toggled on.
                                            maxDoctors: e.target.checked ? null : editingPlan.maxDoctors,
                                            maxBeds: e.target.checked ? null : editingPlan.maxBeds,
                                        })}
                                    />
                                    <div>
                                        <div className="plan-drawer-toggle-title">Enterprise Plan</div>
                                        <div className="plan-drawer-toggle-subtitle">No fixed price or limits — tile shows "Contact Us"</div>
                                    </div>
                                </label>
                            </div>

                            <div className="plan-drawer-section">
                                <div className="plan-drawer-section-title"><ListChecks size={14} /> Features</div>
                                <textarea
                                    rows={6}
                                    className="plan-drawer-textarea"
                                    placeholder={"One feature per line, e.g.\nAppointment Scheduling\nBilling & Invoicing\n24x7 Support"}
                                    value={editingPlan.features.join('\n')}
                                    onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n')})}
                                    onBlur={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n').map(f => f.trim()).filter(Boolean)})}
                                />
                            </div>

                            <label className="plan-drawer-toggle-row">
                                <input type="checkbox" checked={editingPlan.isActive} onChange={e => setEditingPlan({...editingPlan, isActive: e.target.checked})} />
                                <div>
                                    <div className="plan-drawer-toggle-title">Active</div>
                                    <div className="plan-drawer-toggle-subtitle">Inactive plans are hidden from the subscription page</div>
                                </div>
                            </label>
                        </div>

                        <div className="plan-drawer-footer">
                            <button className="cancel-btn" onClick={closeDrawer} disabled={saving}><X size={16}/> Cancel</button>
                            <button className="save-btn" onClick={() => handleSave(editingPlan)} disabled={saving}>
                                <Save size={16}/> {saving ? 'Saving…' : 'Save Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {generatingFor && (
                <div className="variants-modal-overlay" onClick={closeGenerateVariants}>
                    <div className="variants-modal" onClick={e => e.stopPropagation()}>
                        <div className="plan-drawer-header" style={{ borderRadius: '16px 16px 0 0' }}>
                            <div className="plan-drawer-header-icon"><Wand2 size={20} /></div>
                            <div className="plan-drawer-header-text">
                                <h3>Generate Billing Cycle Variants</h3>
                                <p>Creates Quarterly, Half-Yearly &amp; Yearly versions of "{generatingFor.name}" from its Monthly price (₹{generatingFor.discountPrice}/mo).</p>
                            </div>
                            <button className="plan-drawer-close" onClick={closeGenerateVariants} disabled={generating}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="variants-modal-body">
                            {VARIANT_CYCLES.map(cycle => {
                                const exists = variantExists(generatingFor, cycle);
                                const price = computeVariantPrice(generatingFor.discountPrice, cycle, variantDiscounts[cycle]);
                                return (
                                    <div key={cycle} className="variant-row">
                                        <div className="variant-row-top">
                                            <span className="variant-row-cycle">{cycle}</span>
                                            {exists ? (
                                                <span className="variant-row-exists">Already exists — will be skipped</span>
                                            ) : (
                                                <span className="variant-row-price">₹{price.toLocaleString('en-IN')}</span>
                                            )}
                                        </div>
                                        <div className="variant-discount-input">
                                            <input
                                                type="number" min={0} max={90}
                                                value={variantDiscounts[cycle]}
                                                disabled={exists}
                                                onChange={e => setVariantDiscounts({ ...variantDiscounts, [cycle]: Number(e.target.value) })}
                                            />
                                            <span>% extra off, on top of the Monthly discount</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="plan-drawer-footer">
                            <button className="cancel-btn" onClick={closeGenerateVariants} disabled={generating}><X size={16}/> Cancel</button>
                            <button className="save-btn" onClick={handleGenerateVariants} disabled={generating}>
                                <Wand2 size={16}/> {generating ? 'Generating…' : 'Generate Plans'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlansTab;
