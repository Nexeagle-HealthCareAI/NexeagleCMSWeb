import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Save, X } from 'lucide-react';
import { api } from '../../services/api';
import './ManagePlansPage.css';

interface SubscriptionPlan {
    planId: string;
    name: string;
    basePrice: number;
    discountPrice: number;
    billingCycle: string;
    isActive: boolean;
}

const ManagePlansPage: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await api.get('/SubscriptionPlans');
            setPlans(response.data);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleSave = async (plan: SubscriptionPlan) => {
        try {
            if (isCreating) {
                await api.post('/SubscriptionPlans', plan);
            } else {
                await api.put(`/SubscriptionPlans/${plan.planId}`, plan);
            }
            alert("Plan saved successfully!");
            setEditingPlan(null);
            setIsCreating(false);
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error saving plan.");
        }
    };

    return (
        <div className="manage-plans-page">
            <div className="manage-plans-header">
                <div>
                    <h1>Manage Subscription Plans</h1>
                    <p>Configure base prices, discount prices, and billing cycles</p>
                </div>
                <button 
                    className="add-plan-btn"
                    onClick={() => {
                        setIsCreating(true);
                        setEditingPlan({ planId: '', name: '', basePrice: 2500, discountPrice: 1099, billingCycle: 'Monthly', isActive: true });
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
                        <div style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '10px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                                <input type="checkbox" checked={editingPlan.isActive} onChange={e => setEditingPlan({...editingPlan, isActive: e.target.checked})} />
                                Is Active
                            </label>
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
                            <button className="icon-btn" onClick={() => { setEditingPlan(plan); setIsCreating(false); }}><Edit2 size={16}/></button>
                        </div>
                        <div className="plan-card-body">
                            <div className="price-row">
                                <span className="label">Base Price:</span>
                                <span className="value strike">₹{plan.basePrice}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Discounted:</span>
                                <span className="value highlight">₹{plan.discountPrice}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Cycle:</span>
                                <span className="value">{plan.billingCycle}</span>
                            </div>
                            <div className="price-row">
                                <span className="label">Status:</span>
                                <span className="value">{plan.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManagePlansPage;
