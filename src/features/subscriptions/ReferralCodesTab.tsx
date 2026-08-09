import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Save, X, Percent, CalendarPlus, Wand2, Ban, CheckCircle2, Building2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { referralCodeService } from './services/referralCodeService';
import type { ReferralCodeType, ReferralCode, RewardKind } from './services/referralCodeService';
import './ManagePlansPage.css';
import './SubscriptionsPage.css';

const EMPTY_TYPE: ReferralCodeType = {
    referralCodeTypeId: '', name: '', rewardKind: 'PercentageOff', rewardValue: 5, isActive: true, createdAt: '',
};

const formatReward = (rewardKind: RewardKind, rewardValue: number) =>
    rewardKind === 'PercentageOff' ? `${rewardValue}% off` : `+${rewardValue} month${rewardValue === 1 ? '' : 's'}`;

export const ReferralCodesTab: React.FC = () => {
    const canManage = useAuthStore(s => s.hasAccess('referral-codes.manage'));

    const [types, setTypes] = useState<ReferralCodeType[]>([]);
    const [codes, setCodes] = useState<ReferralCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editingType, setEditingType] = useState<ReferralCodeType | null>(null);
    const [isCreatingType, setIsCreatingType] = useState(false);

    const [creatingCode, setCreatingCode] = useState(false);
    const [newCodeTypeId, setNewCodeTypeId] = useState('');
    const [newCodeManual, setNewCodeManual] = useState('');

    const loadAll = async () => {
        try {
            setLoading(true);
            const [typesRes, codesRes] = await Promise.all([
                referralCodeService.getAllTypes(),
                referralCodeService.getAllCodes(),
            ]);
            setTypes(typesRes);
            setCodes(codesRes);
        } catch (error) {
            console.error('Failed to load referral codes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const closeTypeDrawer = () => {
        if (saving) return;
        setEditingType(null);
        setIsCreatingType(false);
    };

    const handleSaveType = async () => {
        if (!editingType) return;
        if (!editingType.name.trim() || editingType.rewardValue <= 0) {
            alert('Please enter a name and a reward value greater than zero.');
            return;
        }
        try {
            setSaving(true);
            if (isCreatingType) {
                await referralCodeService.createType({
                    name: editingType.name.trim(),
                    rewardKind: editingType.rewardKind,
                    rewardValue: editingType.rewardValue,
                });
            } else {
                await referralCodeService.updateType(editingType.referralCodeTypeId, {
                    name: editingType.name.trim(),
                    rewardKind: editingType.rewardKind,
                    rewardValue: editingType.rewardValue,
                    isActive: editingType.isActive,
                });
            }
            closeTypeDrawer();
            await loadAll();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error saving referral code type.');
        } finally {
            setSaving(false);
        }
    };

    const openCreateCode = () => {
        setNewCodeTypeId(types.find(t => t.isActive)?.referralCodeTypeId ?? types[0]?.referralCodeTypeId ?? '');
        setNewCodeManual('');
        setCreatingCode(true);
    };

    const closeCreateCode = () => {
        if (saving) return;
        setCreatingCode(false);
    };

    const submitCreateCode = async (useManualCode: boolean) => {
        if (!newCodeTypeId) {
            alert('Please choose a referral code type.');
            return;
        }
        if (useManualCode && !newCodeManual.trim()) {
            alert('Enter a code, or use Generate instead.');
            return;
        }
        try {
            setSaving(true);
            await referralCodeService.createCode({
                referralCodeTypeId: newCodeTypeId,
                code: useManualCode ? newCodeManual.trim() : undefined,
            });
            setCreatingCode(false);
            await loadAll();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error creating referral code.');
        } finally {
            setSaving(false);
        }
    };

    const toggleCodeActive = async (code: ReferralCode) => {
        try {
            if (code.isActive) {
                await referralCodeService.deactivateCode(code.referralCodeId);
            } else {
                await referralCodeService.activateCode(code.referralCodeId);
            }
            await loadAll();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error updating referral code.');
        }
    };

    const codeStatus = (code: ReferralCode): { label: string; className: string } => {
        if (code.redeemedByHospitalId) return { label: 'Redeemed', className: 'status-approved' };
        if (!code.isActive) return { label: 'Inactive', className: 'status-rejected' };
        return { label: 'Active', className: 'status-active' };
    };

    return (
        <div>
            <div className="manage-plans-header">
                <div>
                    <p>Define reward types and mint referral codes — hospitals enter a code at registration on EasyHMS, and the reward lands the first time they take a Yearly plan.</p>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Referral Code Types</h3>
                {canManage && (
                    <button
                        className="add-plan-btn"
                        onClick={() => { setIsCreatingType(true); setEditingType({ ...EMPTY_TYPE }); }}
                    >
                        <Plus size={16} /> New Type
                    </button>
                )}
            </div>

            <div className="plans-grid">
                {loading ? <p>Loading...</p> : types.length === 0 ? (
                    <div className="plans-empty-state">
                        <p>No referral code types yet.</p>
                    </div>
                ) : types.map(type => (
                    <div key={type.referralCodeTypeId} className={`plan-card ${!type.isActive ? 'inactive' : ''}`}>
                        <div className="plan-card-header">
                            <h3>{type.name}</h3>
                            {canManage && (
                                <button className="icon-btn" onClick={() => { setEditingType(type); setIsCreatingType(false); }}>
                                    <Edit2 size={16} />
                                </button>
                            )}
                        </div>
                        <div className="plan-card-body">
                            <div className="price-row">
                                <span className="label">Reward:</span>
                                <span className="value highlight">
                                    {type.rewardKind === 'PercentageOff' ? <Percent size={14} /> : <CalendarPlus size={14} />} {formatReward(type.rewardKind, type.rewardValue)}
                                </span>
                            </div>
                            <div className="price-row">
                                <span className="label">Status:</span>
                                <span className="value">{type.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Referral Codes</h3>
                {canManage && (
                    <button className="add-plan-btn" onClick={openCreateCode} disabled={types.length === 0}>
                        <Plus size={16} /> New Code
                    </button>
                )}
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper subscriptions-desktop-table">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 16 }}>Code</th>
                                <th>Type</th>
                                <th>Reward</th>
                                <th>Status</th>
                                <th>Redeemed By</th>
                                <th>Created</th>
                                {canManage && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</td></tr>
                            ) : codes.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No referral codes yet.</td></tr>
                            ) : codes.map(code => {
                                const status = codeStatus(code);
                                return (
                                    <tr key={code.referralCodeId} className="premium-row">
                                        <td style={{ paddingLeft: 16, fontFamily: 'monospace', fontWeight: 700 }}>{code.code}</td>
                                        <td>{code.referralCodeTypeName}</td>
                                        <td>{formatReward(code.rewardKind, code.rewardValue)}</td>
                                        <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                                        <td>
                                            {code.redeemedByHospitalId ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 12 }}>
                                                    <Building2 size={14} /> {code.redeemedByHospitalId.split('-')[0]}...
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(code.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                        {canManage && (
                                            <td>
                                                {!code.redeemedByHospitalId && (
                                                    <button className="icon-btn" title={code.isActive ? 'Deactivate' : 'Activate'} onClick={() => toggleCodeActive(code)}>
                                                        {code.isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingType && (
                <div className="plan-drawer-overlay" onClick={closeTypeDrawer}>
                    <div className="plan-drawer" onClick={e => e.stopPropagation()}>
                        <div className="plan-drawer-header">
                            <div className="plan-drawer-header-icon">
                                {isCreatingType ? <Plus size={20} /> : <Edit2 size={20} />}
                            </div>
                            <div className="plan-drawer-header-text">
                                <h3>{isCreatingType ? 'Create Referral Code Type' : 'Edit Referral Code Type'}</h3>
                                <p>Controls the reward every code minted under this type grants.</p>
                            </div>
                            <button className="plan-drawer-close" onClick={closeTypeDrawer} disabled={saving}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="plan-drawer-body">
                            <div className="plan-drawer-section">
                                <div className="plan-drawer-section-title">Details</div>
                                <div className="form-grid">
                                    <div>
                                        <label>Name</label>
                                        <input
                                            type="text"
                                            value={editingType.name}
                                            onChange={e => setEditingType({ ...editingType, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label>Reward Type</label>
                                        <select
                                            value={editingType.rewardKind}
                                            onChange={e => setEditingType({ ...editingType, rewardKind: e.target.value as RewardKind })}
                                        >
                                            <option value="PercentageOff">Percentage Off (Yearly plans)</option>
                                            <option value="ExtraMonths">Extra Free Months (Yearly plans)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-grid">
                                    <div>
                                        <label>{editingType.rewardKind === 'PercentageOff' ? 'Discount (%)' : 'Extra Months'}</label>
                                        <input
                                            type="number" min={0}
                                            value={editingType.rewardValue}
                                            onChange={e => setEditingType({ ...editingType, rewardValue: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {!isCreatingType && (
                                <label className="plan-drawer-toggle-row">
                                    <input
                                        type="checkbox"
                                        checked={editingType.isActive}
                                        onChange={e => setEditingType({ ...editingType, isActive: e.target.checked })}
                                    />
                                    <div>
                                        <div className="plan-drawer-toggle-title">Active</div>
                                        <div className="plan-drawer-toggle-subtitle">Inactive types can't be used to mint new codes</div>
                                    </div>
                                </label>
                            )}
                        </div>

                        <div className="plan-drawer-footer">
                            <button className="cancel-btn" onClick={closeTypeDrawer} disabled={saving}><X size={16} /> Cancel</button>
                            <button className="save-btn" onClick={handleSaveType} disabled={saving}>
                                <Save size={16} /> {saving ? 'Saving…' : 'Save Type'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {creatingCode && (
                <div className="reject-modal-overlay" onClick={closeCreateCode}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header">
                            <h3>New Referral Code</h3>
                            <button className="icon-btn" onClick={closeCreateCode} disabled={saving}><X size={18} /></button>
                        </div>

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Type</label>
                        <select
                            value={newCodeTypeId}
                            onChange={e => setNewCodeTypeId(e.target.value)}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 16 }}
                        >
                            {types.map(t => (
                                <option key={t.referralCodeTypeId} value={t.referralCodeTypeId} disabled={!t.isActive}>
                                    {t.name} ({formatReward(t.rewardKind, t.rewardValue)}){!t.isActive ? ' — inactive' : ''}
                                </option>
                            ))}
                        </select>

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                            Code (optional — leave blank to auto-generate)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. WELCOME5"
                            value={newCodeManual}
                            onChange={e => setNewCodeManual(e.target.value.toUpperCase())}
                            style={{ width: '100%', fontFamily: 'monospace', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                        />

                        <div className="form-actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                            <button className="cancel-btn" onClick={closeCreateCode} disabled={saving}>Cancel</button>
                            <button className="save-btn" onClick={() => submitCreateCode(false)} disabled={saving}>
                                <Wand2 size={16} /> Generate
                            </button>
                            <button className="save-btn" onClick={() => submitCreateCode(true)} disabled={saving || !newCodeManual.trim()}>
                                <Save size={16} /> Use This Code
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferralCodesTab;
