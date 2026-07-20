import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, CheckCircle, Ban, CalendarClock, CalendarCheck, Layers } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import {
    subscriptionsService as svc,
    type HospitalSubscription,
    type SubscriptionSummary,
    type Plan,
} from './services/subscriptionsService';
import '../../dashboard/pages/PremiumHospitals.css';
import './HospitalSubscriptionsPage.css';

type ModalKind = 'plan' | 'trial' | 'validity' | null;

const STATUS_FILTERS = ['All', 'Active', 'Trial', 'Pending', 'Expired', 'Blocked'];
const PLATFORM_FILTERS = ['All', 'EasyHMS', '1Rad'];

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const HospitalSubscriptionsPage: React.FC = () => {
    const permissions = useAuthStore((s) => s.permissions);
    const canManage = permissions.includes('subscriptions.manage');

    const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
    const [rows, setRows] = useState<HospitalSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState('All');
    const [status, setStatus] = useState('All');
    const [busyId, setBusyId] = useState<string | null>(null);

    // action modal
    const [modal, setModal] = useState<ModalKind>(null);
    const [target, setTarget] = useState<HospitalSubscription | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [form, setForm] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, list] = await Promise.all([
                svc.getSummary(),
                svc.list(platform, status === 'All' ? '' : status),
            ]);
            setSummary(s);
            setRows(list);
        } catch (e) {
            console.error('Failed to load subscriptions', e);
        } finally {
            setLoading(false);
        }
    }, [platform, status]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        window.addEventListener('sync-completed', load);
        return () => window.removeEventListener('sync-completed', load);
    }, [load]);

    const openModal = async (kind: ModalKind, row: HospitalSubscription) => {
        setTarget(row);
        setModal(kind);
        setForm({});
        if (kind === 'plan') {
            try { setPlans(await svc.getPlans(row.platform)); } catch { setPlans([]); }
        }
    };

    const closeModal = () => { setModal(null); setTarget(null); setForm({}); };

    const toggleActive = async (row: HospitalSubscription) => {
        const activate = !(row.status === 'Active');
        const verb = activate ? 'activate' : 'deactivate';
        if (!window.confirm(`Are you sure you want to ${verb} ${row.hospitalName}'s subscription?`)) return;
        setBusyId(row.hospitalSubscriptionId);
        try {
            await svc.setStatus(row.platform, row.hospitalId, activate);
            await load();
        } catch (e: any) {
            alert(e.response?.data?.message || e.response?.data || `Could not ${verb} the subscription.`);
        } finally {
            setBusyId(null);
        }
    };

    const submitModal = async () => {
        if (!target) return;
        setBusyId(target.hospitalSubscriptionId);
        try {
            if (modal === 'plan') {
                if (!form.planId) { alert('Select a plan.'); setBusyId(null); return; }
                await svc.assignPlan(target.platform, target.hospitalId, form.planId);
            } else if (modal === 'trial') {
                await svc.setTrial(target.platform, target.hospitalId, {
                    trialStartDate: form.trialStartDate || undefined,
                    trialEndDate: form.trialEndDate || undefined,
                });
            } else if (modal === 'validity') {
                await svc.setValidity(target.platform, target.hospitalId, {
                    subscriptionStartDate: form.subscriptionStartDate || undefined,
                    subscriptionEndDate: form.subscriptionEndDate || undefined,
                    nextBillingDate: form.nextBillingDate || undefined,
                });
            }
            closeModal();
            await load();
        } catch (e: any) {
            alert(e.response?.data?.message || e.response?.data || 'Update failed.');
        } finally {
            setBusyId(null);
        }
    };

    const cards = useMemo(() => {
        const o = summary?.overall;
        return [
            { key: 'active', label: 'Active', value: o?.active ?? 0, cls: 'active' },
            { key: 'trial', label: 'On Trial', value: o?.trial ?? 0, cls: 'trial' },
            { key: 'pending', label: 'Pending', value: o?.pending ?? 0, cls: 'pending' },
            { key: 'inactive', label: 'Inactive', value: (o?.expired ?? 0) + (o?.blocked ?? 0), cls: 'expired' },
            { key: 'total', label: 'Total', value: o?.total ?? 0, cls: 'total' },
        ];
    }, [summary]);

    const unavailable = summary?.platforms.filter((p) => !p.available).map((p) => p.platform) ?? [];

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Hospital Subscriptions</h1>
                    <p className="premium-subtitle">Manage subscriptions across EasyHMS and 1Rad — status, trial, validity, and plan.</p>
                </div>
                <button className="hsub-refresh" style={{background: 'white', border: '1px solid #cbd5e1', color: '#1e3a8a', padding: '8px 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}} onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </header>

            {unavailable.length > 0 && (
                <div className="hsub-banner">
                    {unavailable.join(' and ')} database{unavailable.length > 1 ? 's are' : ' is'} currently unavailable —
                    those hospitals are not shown.
                </div>
            )}

            <div className="hsub-cards">
                {cards.map((c) => (
                    <div key={c.key} className={`hsub-card ${c.cls}`}>
                        <div className="hsub-card-value">{c.value}</div>
                        <div className="hsub-card-label">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="hsub-filters">
                <label>
                    Platform
                    <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                        {PLATFORM_FILTERS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </label>
                <label>
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
            </div>

            {/* Desktop View: Table */}
            <div className="premium-table-card" style={{marginTop: '24px'}}>
                <div className="premium-responsive-wrapper hsub-desktop-table">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 16 }}>Hospital</th>
                                <th>Platform</th>
                                <th>Plan</th>
                                <th>Status</th>
                                <th>Trial Ends</th>
                                <th>Valid Until</th>
                                {canManage && <th>Actions</th>}
                            </tr>
                        </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={canManage ? 7 : 6} className="hsub-empty">Loading…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={canManage ? 7 : 6} className="hsub-empty" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>No subscriptions match these filters.</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.hospitalSubscriptionId} className="premium-row">
                                <td style={{ paddingLeft: 16 }}>
                                    <div className="premium-hospital-cell">
                                        <div className="premium-avatar gradient-1">
                                            <Building2 size={18} color="var(--primary)" />
                                        </div>
                                        <div>
                                            <div className="premium-hospital-name">{r.hospitalName || 'Unnamed hospital'}</div>
                                            <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{r.hospitalId.split('-')[0]}…</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span style={{fontWeight: 600, color: '#0f52ba', fontSize: '13px'}}>{r.platform}</span></td>
                                <td><span style={{fontWeight: 600, color: '#334155', fontSize: '13px'}}>{r.planName || <span className="hsub-muted">No plan</span>}</span></td>
                                <td><span className={`status-badge status-${r.status.toLowerCase()}`}>{r.status}</span></td>
                                <td style={{fontSize: '13px', color: '#475569'}}>{fmtDate(r.trialEndDate)}</td>
                                <td style={{fontSize: '13px', color: '#475569'}}>{fmtDate(r.subscriptionEndDate)}</td>
                                {canManage && (
                                    <td>
                                        <div className="hsub-actions">
                                            <button
                                                className={`hsub-btn ${r.status === 'Active' ? 'danger' : 'primary'}`}
                                                disabled={busyId === r.hospitalSubscriptionId}
                                                onClick={() => toggleActive(r)}
                                            >
                                                {r.status === 'Active' ? <><Ban size={14} /> Deactivate</> : <><CheckCircle size={14} /> Activate</>}
                                            </button>
                                            <button className="hsub-btn ghost" onClick={() => openModal('plan', r)}><Layers size={14} /> Plan</button>
                                            <button className="hsub-btn ghost" onClick={() => openModal('trial', r)}><CalendarClock size={14} /> Trial</button>
                                            <button className="hsub-btn ghost" onClick={() => openModal('validity', r)}><CalendarCheck size={14} /> Validity</button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile View: Cards */}
            <div className="premium-mobile-cards" style={{marginTop: '24px'}}>
                {loading ? (
                    <div className="hsub-empty" style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>Loading…</div>
                ) : rows.length === 0 ? (
                    <div className="hsub-empty" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>No subscriptions match these filters.</div>
                ) : rows.map((r) => (
                    <div key={r.hospitalSubscriptionId} className="premium-mobile-card">
                        <div className="premium-mobile-header">
                            <div className="premium-avatar gradient-1">
                                <Building2 size={18} color="var(--primary)" />
                            </div>
                            <div style={{flex: 1}}>
                                <h4 className="premium-hospital-name">{r.hospitalName || 'Unnamed hospital'}</h4>
                                <p className="premium-hospital-id">ID: {r.hospitalId.split('-')[0]}… · <span style={{fontWeight: 600, color: 'var(--primary)'}}>{r.platform}</span></p>
                            </div>
                            <span className={`status-badge status-${r.status.toLowerCase()}`}>
                                {r.status}
                            </span>
                        </div>
                        
                        <div className="premium-mobile-details">
                            <div className="premium-mobile-detail-item">
                                <span className="premium-mobile-detail-label">Plan</span>
                                <span className="premium-mobile-detail-value" style={{fontWeight: 600, color: 'var(--primary)'}}>{r.planName || 'No plan'}</span>
                            </div>
                            <div className="premium-mobile-detail-item">
                                <span className="premium-mobile-detail-label">Trial Ends</span>
                                <span className="premium-mobile-detail-value">{fmtDate(r.trialEndDate)}</span>
                            </div>
                            <div className="premium-mobile-detail-item">
                                <span className="premium-mobile-detail-label">Valid Until</span>
                                <span className="premium-mobile-detail-value">{fmtDate(r.subscriptionEndDate)}</span>
                            </div>
                        </div>
                        
                        {canManage && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                <button
                                    className={`hsub-mobile-action-btn ${r.status === 'Active' ? 'danger' : 'primary'}`}
                                    disabled={busyId === r.hospitalSubscriptionId}
                                    onClick={() => toggleActive(r)}
                                    style={{ flex: '1 1 100%' }}
                                >
                                    {r.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="hsub-mobile-action-btn secondary" style={{flex: 1}} onClick={() => openModal('plan', r)}>Plan</button>
                                <button className="hsub-mobile-action-btn secondary" style={{flex: 1}} onClick={() => openModal('trial', r)}>Trial</button>
                                <button className="hsub-mobile-action-btn secondary" style={{flex: 1}} onClick={() => openModal('validity', r)}>Validity</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {modal && target && (
                <div className="hsub-modal-overlay" onClick={closeModal}>
                    <div className="hsub-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>
                            {modal === 'plan' && 'Change Plan'}
                            {modal === 'trial' && 'Set Trial Period'}
                            {modal === 'validity' && 'Set Subscription Validity'}
                        </h3>
                        <p className="hsub-modal-sub">{target.hospitalName} · {target.platform}</p>

                        {modal === 'plan' && (
                            <label className="hsub-field">
                                Plan ({target.platform})
                                <select value={form.planId || ''} onChange={(e) => setForm({ planId: e.target.value })}>
                                    <option value="">Select a plan…</option>
                                    {plans.filter((p) => p.isActive).map((p) => (
                                        <option key={p.planId} value={p.planId}>{p.name} ({p.billingCycle})</option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {modal === 'trial' && (
                            <>
                                <label className="hsub-field">Trial start
                                    <input type="date" value={form.trialStartDate || ''} onChange={(e) => setForm({ ...form, trialStartDate: e.target.value })} />
                                </label>
                                <label className="hsub-field">Trial end
                                    <input type="date" value={form.trialEndDate || ''} onChange={(e) => setForm({ ...form, trialEndDate: e.target.value })} />
                                </label>
                            </>
                        )}

                        {modal === 'validity' && (
                            <>
                                <label className="hsub-field">Subscription start
                                    <input type="date" value={form.subscriptionStartDate || ''} onChange={(e) => setForm({ ...form, subscriptionStartDate: e.target.value })} />
                                </label>
                                <label className="hsub-field">Subscription end
                                    <input type="date" value={form.subscriptionEndDate || ''} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} />
                                </label>
                                <label className="hsub-field">Next billing (optional)
                                    <input type="date" value={form.nextBillingDate || ''} onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })} />
                                </label>
                            </>
                        )}

                        <div className="hsub-modal-actions">
                            <button className="hsub-btn ghost" onClick={closeModal}>Cancel</button>
                            <button className="hsub-btn primary" onClick={submitModal} disabled={busyId === target.hospitalSubscriptionId}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalSubscriptionsPage;
