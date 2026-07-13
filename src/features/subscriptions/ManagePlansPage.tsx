import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Save, X, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import './ManagePlansPage.css';

interface SubscriptionPlan {
    planId: string;
    name: string;
    basePrice: number;
    discountPrice: number;
    billingCycle: string;
    applicationName: string;
    isActive: boolean;
}

const ManagePlansPage: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'1Rad' | 'EasyHMS'>('1Rad');

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
                const { planId, ...payload } = plan;
                await api.post('/SubscriptionPlans', payload);
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

    const handleDelete = async (planId: string) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;

        try {
            await api.delete(`/SubscriptionPlans/${planId}`);
            alert("Plan deleted successfully!");
            await fetchPlans();
        } catch (error: any) {
            alert(error.response?.data || "Error deleting plan.");
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
                        setEditingPlan({ planId: '', name: '', basePrice: 2500, discountPrice: 1099, billingCycle: 'Monthly', applicationName: activeTab, isActive: true });
                    }}
                >
                    <Plus size={16} /> New Plan
                </button>
            </div>

            <div className="application-tabs">
                <button 
                    className={`tab-btn ${activeTab === '1Rad' ? 'active' : ''}`}
                    onClick={() => setActiveTab('1Rad')}
                >
                    1Rad Plans
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'EasyHMS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('EasyHMS')}
                >
                    EasyHMS Plans
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
                            <label>Application</label>
                            <select value={editingPlan.applicationName || '1Rad'} onChange={e => setEditingPlan({...editingPlan, applicationName: e.target.value})}>
                                <option value="1Rad">1Rad</option>
                                <option value="EasyHMS">EasyHMS</option>
                            </select>
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
                {loading ? <p>Loading...</p> : plans.filter(p => (p.applicationName || '1Rad') === activeTab).map(plan => (
                    <div key={plan.planId} className={`plan-card ${!plan.isActive ? 'inactive' : ''}`}>
                        <div className="plan-card-header">
                            <h3>{plan.name}</h3>
                            <div style={{display: 'flex', gap: '8px'}}>
                                <button className="icon-btn" onClick={() => { setEditingPlan(plan); setIsCreating(false); }}><Edit2 size={16}/></button>
                                <button className="icon-btn delete-btn" onClick={() => handleDelete(plan.planId)} style={{color: '#ef4444'}}><Trash2 size={16}/></button>
                            </div>
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
                                <span className={`status-pill ${plan.isActive ? 'active' : 'inactive'}`}>
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManagePlansPage;
