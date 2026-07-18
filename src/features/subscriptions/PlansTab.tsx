import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Save, X, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import './ManagePlansPage.css';

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
    const [editingPlan, setEditingPlan] = useState<EasyHmsSubscriptionPlan | null>(null);
    const [isCreating, setIsCreating] = useState(false);

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

    const handleSave = async (plan: EasyHmsSubscriptionPlan) => {
        try {
            // Backend stores Features as a raw JSON string, not an array.
            const payload = { ...plan, features: JSON.stringify(plan.features ?? []) };
            if (isCreating) {
                const { planId, ...body } = payload;
                await api.post('/EasyHmsSubscriptionPlans', body);
            } else {
                await api.put(`/EasyHmsSubscriptionPlans/${plan.planId}`, payload);
            }
            alert("Plan saved successfully!");
            setEditingPlan(null);
            setIsCreating(false);
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error saving plan.");
        }
    };

    const handleDelete = async (planId: string) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;

        try {
            await api.delete(`/EasyHmsSubscriptionPlans/${planId}`);
            alert("Plan deleted successfully!");
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error deleting plan.");
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
                        setEditingPlan({ ...EMPTY_PLAN });
                    }}
                >
                    <Plus size={16} /> New Plan
                </button>
            </div>

            {editingPlan && (
                <div className="plan-editor-card">
                    <h3>{isCreating ? 'Create New Plan' : 'Edit Plan'}</h3>
                    <div className="form-grid">
                        <div>
                            <label>Plan Name</label>
                            <input type="text" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} />
                        </div>
                        <div>
                            <label>Billing Cycle</label>
                            <select value={editingPlan.billingCycle} onChange={e => setEditingPlan({...editingPlan, billingCycle: e.target.value})}>
                                <option>Monthly</option>
                                <option>Yearly</option>
                            </select>
                        </div>
                        <div>
                            <label>Base Price (₹)</label>
                            <input type="number" value={editingPlan.basePrice} onChange={e => setEditingPlan({...editingPlan, basePrice: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                            <label>Discount Price (₹)</label>
                            <input type="number" value={editingPlan.discountPrice} onChange={e => setEditingPlan({...editingPlan, discountPrice: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                            <label>Max Doctors (blank = unlimited)</label>
                            <input
                                type="number" min={0}
                                value={editingPlan.maxDoctors ?? ''}
                                disabled={editingPlan.isEnterprise}
                                onChange={e => setEditingPlan({...editingPlan, maxDoctors: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
                            />
                        </div>
                        <div>
                            <label>Max Beds (blank = unlimited)</label>
                            <input
                                type="number" min={0}
                                value={editingPlan.maxBeds ?? ''}
                                disabled={editingPlan.isEnterprise}
                                onChange={e => setEditingPlan({...editingPlan, maxBeds: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
                            />
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '10px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                                <input type="checkbox" checked={editingPlan.isActive} onChange={e => setEditingPlan({...editingPlan, isActive: e.target.checked})} />
                                Is Active
                            </label>
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '10px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
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
                                Enterprise (no fixed price — shows "Contact Us")
                            </label>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label>Features (one per line — shown as the tile's checklist)</label>
                            <textarea
                                rows={6}
                                style={{ width: '100%', fontFamily: 'inherit', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                value={editingPlan.features.join('\n')}
                                onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n')})}
                                onBlur={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n').map(f => f.trim()).filter(Boolean)})}
                            />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button className="cancel-btn" onClick={() => { setEditingPlan(null); setIsCreating(false); }}><X size={16}/> Cancel</button>
                        <button className="save-btn" onClick={() => handleSave(editingPlan)}><Save size={16}/> Save</button>
                    </div>
                </div>
            )}

            <div className="plans-grid">
                {loading ? <p>Loading...</p> : plans.map(plan => (
                    <div key={plan.planId} className={`plan-card ${!plan.isActive ? 'inactive' : ''}`}>
                        <div className="plan-card-header">
                            <h3>{plan.name}</h3>
                            <div style={{display: 'flex', gap: '8px'}}>
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
        </div>
    );
};

export default PlansTab;
