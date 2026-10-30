import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, XCircle, Building2, X } from 'lucide-react';
import { api } from '../../services/api';
import { API_ENDPOINTS } from '../../services/endpoints';
import './SubscriptionsPage.css';

// 1Rad keeps its own database, so its manual-payment requests are reviewed here, through
// CMS API's /rad-subscriptions proxy to 1RadAPI (service key). Before Oct 2026 there was no
// screen anywhere to approve a 1Rad payment.
interface RadPaymentRequest {
    requestId: string;
    hospitalId: string;
    hospitalName: string;
    planId: string | null;
    planName: string;
    billingCycle: string;
    status: string; // Pending | Approved | Rejected
    reviewNote: string | null;
    createdAt: string;
    paymentMode: string;
    amount: number;
    modules: string | null;
    storageOverageGb: number;
    storageOverageAmount: number;
    transactionReference: string;
    payerName: string;
    payerContact: string;
    paidAt: string;
    reviewedAt: string | null;
}

const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const fmtINR = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const editionLabel = (modules: string | null) => {
    const m = (modules || '').toUpperCase();
    if (m.includes('RIS') && m.includes('PACS')) return 'RIS + PACS';
    if (m.includes('PACS')) return 'PACS';
    if (m.includes('RIS')) return 'RIS';
    return null;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = status.toLowerCase();
    const icon = s === 'approved' ? <CheckCircle size={16} className="mr-2" />
        : s === 'rejected' ? <XCircle size={16} className="mr-2" />
        : <Clock size={16} className="mr-2" />;
    return (
        <div className={`status-badge status-${s}`} style={{ display: 'flex', alignItems: 'center' }}>
            {icon}{status}
        </div>
    );
};

export const RadApprovalsTab: React.FC = () => {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    const [all, setAll] = useState<RadPaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<RadPaymentRequest | null>(null);
    const [reason, setReason] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const res = await api.get(API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS);
            setAll(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch 1Rad payment requests:', error);
            setLoadError(errMsg(error, 'Could not load 1Rad payment requests.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const pending = useMemo(() => all.filter(r => r.status === 'Pending'), [all]);
    const history = useMemo(() => all.filter(r => r.status !== 'Pending'), [all]);
    const rows = viewMode === 'pending' ? pending : history;

    const approve = async (req: RadPaymentRequest) => {
        if (!window.confirm(`Approve ${fmtINR(req.amount)} from ${req.hospitalName} (ref ${req.transactionReference}) and activate the plan?`)) return;
        try {
            setBusyId(req.requestId);
            const res = await api.post(`${API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS}/${req.requestId}/approve`, {});
            alert(res.data?.message || '1Rad subscription activated.');
            await load();
        } catch (error) {
            alert(errMsg(error, 'Approval failed.'));
        } finally {
            setBusyId(null);
        }
    };

    const confirmReject = async () => {
        if (!rejecting) return;
        if (!reason.trim()) { alert('Please enter a reason for rejecting this payment.'); return; }
        try {
            setBusyId(rejecting.requestId);
            const res = await api.post(`${API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS}/${rejecting.requestId}/reject`, { reason: reason.trim() });
            alert(res.data?.message || 'Payment rejected.');
            setRejecting(null);
            setReason('');
            await load();
        } catch (error) {
            alert(errMsg(error, 'Rejection failed.'));
        } finally {
            setBusyId(null);
        }
    };

    const planCell = (r: RadPaymentRequest) => (
        <>
            <div style={{ fontWeight: 600, color: '#0f52ba' }}>
                {editionLabel(r.modules) ? `${editionLabel(r.modules)} · ` : ''}{r.planName || r.billingCycle}
            </div>
            {r.storageOverageGb > 0 && (
                <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginTop: 4 }}>
                    Includes {r.storageOverageGb} GB storage overage ({fmtINR(r.storageOverageAmount)})
                </div>
            )}
        </>
    );

    const paymentCell = (r: RadPaymentRequest) => (
        <>
            <div style={{ fontWeight: 700 }}>
                {fmtINR(r.amount)}
                {r.paymentMode && <span style={{ fontWeight: 500, color: '#64748b' }}> &middot; {r.paymentMode}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{r.transactionReference}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Paid {fmtDate(r.paidAt)} · {r.payerName}{r.payerContact ? ` (${r.payerContact})` : ''}</div>
        </>
    );

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <p style={{ color: '#64748b', margin: 0 }}>Manual payments submitted by 1Rad diagnostic centres. Check the reference against the bank statement before approving.</p>
                <div className="application-tabs" style={{ margin: 0 }}>
                    <button className={`tab-btn ${viewMode === 'pending' ? 'active' : ''}`} onClick={() => setViewMode('pending')}>
                        Pending {pending.length > 0 && `(${pending.length})`}
                    </button>
                    <button className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>
                        History
                    </button>
                </div>
            </div>

            <div className="premium-table-card">
                <div className="premium-responsive-wrapper subscriptions-desktop-table">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 16 }}>Centre</th>
                                <th>Plan</th>
                                <th>Payment</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                <th>{viewMode === 'pending' ? 'Actions' : 'Reviewed'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</td></tr>
                            ) : loadError ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>{loadError}</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                                    {viewMode === 'pending' ? 'No pending 1Rad payments.' : 'No reviewed 1Rad payments yet.'}
                                </td></tr>
                            ) : rows.map(r => (
                                <tr key={r.requestId} className="premium-row">
                                    <td style={{ paddingLeft: 16 }}>
                                        <div className="premium-hospital-cell">
                                            <div className="premium-avatar gradient-3"><Building2 size={18} color="var(--primary)" /></div>
                                            <div>
                                                <div className="premium-hospital-name">{r.hospitalName}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{r.hospitalId.split('-')[0]}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{planCell(r)}</td>
                                    <td>{paymentCell(r)}</td>
                                    <td style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(r.createdAt)}</td>
                                    <td>
                                        <StatusBadge status={r.status} />
                                        {r.reviewNote && r.status !== 'Pending' && (
                                            <div style={{ fontSize: 11, color: r.status === 'Rejected' ? '#dc2626' : '#64748b', marginTop: 4, maxWidth: 220 }}>{r.reviewNote}</div>
                                        )}
                                    </td>
                                    <td>
                                        {viewMode === 'pending' ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="approve-btn" onClick={() => approve(r)} disabled={busyId === r.requestId}>
                                                    {busyId === r.requestId ? 'Working...' : 'Approve & Activate'}
                                                </button>
                                                <button className="reject-btn" onClick={() => { setRejecting(r); setReason(''); }} disabled={busyId === r.requestId}>
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(r.reviewedAt)}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="premium-mobile-cards">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
                    ) : loadError ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>{loadError}</div>
                    ) : rows.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                            {viewMode === 'pending' ? 'No pending 1Rad payments.' : 'No reviewed 1Rad payments yet.'}
                        </div>
                    ) : rows.map(r => (
                        <div key={r.requestId} className="premium-mobile-card">
                            <div className="premium-mobile-header">
                                <div className="premium-avatar gradient-3"><Building2 size={18} color="var(--primary)" /></div>
                                <div style={{ flex: 1 }}>
                                    <h3 className="premium-hospital-name">{r.hospitalName}</h3>
                                    <p className="premium-hospital-id">Submitted {fmtDate(r.createdAt)}</p>
                                </div>
                                <span className={`status-badge status-${r.status.toLowerCase()}`}>{r.status}</span>
                            </div>
                            <div className="premium-mobile-details">
                                <div className="premium-mobile-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                    <span className="premium-mobile-detail-label">Plan</span>
                                    {planCell(r)}
                                </div>
                                <div className="premium-mobile-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, borderTop: '1px dashed rgba(226, 232, 240, 0.8)', paddingTop: 12, marginTop: 8 }}>
                                    <span className="premium-mobile-detail-label">Payment</span>
                                    {paymentCell(r)}
                                </div>
                                {r.reviewNote && r.status !== 'Pending' && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: r.status === 'Rejected' ? '#dc2626' : '#64748b' }}>{r.reviewNote}</div>
                                )}
                            </div>
                            {viewMode === 'pending' && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                    <button className="approve-btn" onClick={() => approve(r)} disabled={busyId === r.requestId} style={{ flex: 1, justifyContent: 'center' }}>
                                        {busyId === r.requestId ? 'Working...' : 'Approve & Activate'}
                                    </button>
                                    <button className="reject-btn" onClick={() => { setRejecting(r); setReason(''); }} disabled={busyId === r.requestId}
                                        style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {rejecting && (
                <div className="reject-modal-overlay" onClick={() => !busyId && setRejecting(null)}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header">
                            <h3>Reject 1Rad payment</h3>
                            <button className="icon-btn" onClick={() => setRejecting(null)} disabled={!!busyId}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px 0' }}>
                            Rejecting {fmtINR(rejecting.amount)} from <strong>{rejecting.hospitalName}</strong> (ref {rejecting.transactionReference}).
                            The centre sees this reason on its 1Rad Subscription page and can submit again.
                        </p>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Reason for rejection</label>
                        <textarea
                            rows={4}
                            autoFocus
                            maxLength={500}
                            placeholder="e.g. Reference not found in the bank statement, amount mismatch"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{ width: '100%', fontFamily: 'inherit', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', resize: 'vertical' }}
                        />
                        <div className="form-actions" style={{ marginTop: 16 }}>
                            <button className="cancel-btn" onClick={() => setRejecting(null)} disabled={!!busyId}>Cancel</button>
                            <button className="reject-btn" onClick={confirmReject} disabled={!!busyId}>
                                {busyId ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadApprovalsTab;
