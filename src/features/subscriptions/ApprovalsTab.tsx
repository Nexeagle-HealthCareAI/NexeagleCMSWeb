import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, Building2, X } from 'lucide-react';
import { api } from '../../services/api';
import './SubscriptionsPage.css';

interface PaymentRequest {
    hospitalSubscriptionId: string;
    hospitalId: string;
    hospitalName: string;
    planId: string;
    planName: string;
    applicationName: string;
    status: string;
    trialStartDate: string | null;
    trialEndDate: string | null;
    subscriptionEndDate: string | null;
    paymentAmount: number | null;
    paymentReference: string | null;
    paymentMode: string | null;
    paymentDate: string | null;
    isProratedSwitch: boolean;
    previousPlanName: string | null;
    proratedCreditAmount: number | null;
}

interface ApprovalHistoryEntry {
    paymentId: string;
    hospitalId: string;
    hospitalName: string;
    planId: string | null;
    planName: string;
    applicationName: string;
    amount: number;
    reference: string;
    paymentMode: string | null;
    status: string; // PendingApproval, Approved, Rejected, Superseded
    submittedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
    isProratedSwitch: boolean;
    previousPlanName: string | null;
    proratedCreditAmount: number | null;
}

// Both products' approval requests are shown together — this badge is the only thing that tells
// them apart, so it needs to read at a glance rather than requiring a tab switch to know which is which.
const ProductBadge: React.FC<{ product: string }> = ({ product }) => {
    const isEasyHms = product === 'EasyHMS';
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                background: isEasyHms ? '#e0e7ff' : '#f3e8ff',
                color: isEasyHms ? '#4338ca' : '#7e22ce',
            }}
        >
            {product}
        </span>
    );
};

const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
        case 'approved':
        case 'active': return <CheckCircle size={16} className="mr-2" />;
        case 'expired':
        case 'rejected': return <XCircle size={16} className="mr-2" />;
        default: return <Clock size={16} className="mr-2" />;
    }
};

export const ApprovalsTab: React.FC = () => {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [rejectingRequest, setRejectingRequest] = useState<PaymentRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingReject, setSubmittingReject] = useState(false);

    const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await api.get('/SubscriptionApproval/pending');
            // Assuming response.data is the array directly based on typical .NET Core responses
            setRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch payment requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await api.get('/SubscriptionApproval/history');
            setHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch approval history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchHistory();
    }, []);

    const handleApprove = async (hospitalId: string) => {
        if (!window.confirm("Are you sure you want to approve this payment and activate the subscription?")) return;

        try {
            setApprovingId(hospitalId);
            const response = await api.post(`/SubscriptionApproval/${hospitalId}/approve`, {});

            alert(response.data.message || "Subscription activated successfully!");
            await Promise.all([fetchRequests(), fetchHistory()]);
        } catch (error: any) {
            console.error('Approval failed:', error);
            alert(error.response?.data?.message || error.response?.data || "An error occurred while approving the payment.");
        } finally {
            setApprovingId(null);
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectingRequest) return;
        if (!rejectionReason.trim()) {
            alert('Please enter a reason for rejecting this payment.');
            return;
        }

        try {
            setSubmittingReject(true);
            const response = await api.post(`/SubscriptionApproval/${rejectingRequest.hospitalId}/reject`, { reason: rejectionReason.trim() });
            alert(response.data.message || 'Payment rejected.');
            setRejectingRequest(null);
            setRejectionReason('');
            await Promise.all([fetchRequests(), fetchHistory()]);
        } catch (error: any) {
            console.error('Rejection failed:', error);
            alert(error.response?.data?.message || error.response?.data || 'An error occurred while rejecting the payment.');
        } finally {
            setSubmittingReject(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <p style={{ color: '#64748b', margin: 0 }}>Review and verify manual payments — 1Rad and EasyHMS requests both appear here, tagged by product.</p>
                <div className="application-tabs" style={{ margin: 0 }}>
                    <button
                        className={`tab-btn ${viewMode === 'pending' ? 'active' : ''}`}
                        onClick={() => setViewMode('pending')}
                    >
                        Pending {requests.length > 0 && `(${requests.length})`}
                    </button>
                    <button
                        className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
                        onClick={() => setViewMode('history')}
                    >
                        History
                    </button>
                </div>
            </div>

            {viewMode === 'pending' ? (
                <div className="premium-table-card">
                    {/* Desktop View: Table */}
                    <div className="premium-responsive-wrapper subscriptions-desktop-table">
                        <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th style={{ paddingLeft: 16 }}>Hospital</th>
                                        <th>Product</th>
                                        <th>Plan Details</th>
                                        <th>Payment Submitted</th>
                                        <th>Status</th>
                                        <th>Trial End Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={7} style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>Loading...</td></tr>
                                    ) : requests.length === 0 ? (
                                        <tr><td colSpan={7} style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>No pending payment approvals.</td></tr>
                                    ) : (
                                        requests.map((req) => (
                                            <tr key={req.hospitalSubscriptionId} className="premium-row">
                                                <td style={{ paddingLeft: 16 }}>
                                                    <div className="premium-hospital-cell">
                                                        <div className="premium-avatar gradient-3">
                                                            <Building2 size={18} color="var(--primary)" />
                                                        </div>
                                                        <div>
                                                            <div className="premium-hospital-name">{req.hospitalName}</div>
                                                            <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{req.hospitalId.split('-')[0]}...</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <ProductBadge product={req.applicationName || 'EasyHMS'} />
                                                </td>
                                            <td>
                                                <div style={{fontWeight: 600, color: '#0f52ba'}}>{req.planName || 'Unknown Plan'}</div>
                                                {req.isProratedSwitch && (
                                                    <div style={{fontSize: 11, color: '#7c3aed', fontWeight: 700, marginTop: 4}}>
                                                        Switch from {req.previousPlanName} &middot; credit ₹{req.proratedCreditAmount?.toLocaleString('en-IN')}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {req.paymentAmount != null ? (
                                                    <>
                                                        <div style={{fontWeight: 700}}>
                                                            ₹{req.paymentAmount}
                                                            {req.paymentMode && <span style={{fontWeight: 500, color: '#64748b'}}> &middot; {req.paymentMode}</span>}
                                                        </div>
                                                        <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{req.paymentReference}</div>
                                                        {req.paymentDate && (
                                                            <div style={{fontSize: '11px', color: '#94a3b8'}}>
                                                                {new Date(req.paymentDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span style={{ color: '#94a3b8' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className={`status-badge status-${req.status.toLowerCase()}`} style={{display: 'flex', alignItems: 'center'}}>
                                                    {getStatusIcon(req.status)}
                                                    {req.status}
                                                </div>
                                            </td>
                                            <td>
                                                {req.trialEndDate ? new Date(req.trialEndDate).toLocaleDateString('en-IN', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                }) : 'N/A'}
                                            </td>
                                            <td>
                                                {req.status !== 'Active' && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className="approve-btn"
                                                            onClick={() => handleApprove(req.hospitalId)}
                                                            disabled={approvingId === req.hospitalId}
                                                        >
                                                            {approvingId === req.hospitalId ? 'Approving...' : 'Approve & Activate'}
                                                        </button>
                                                        <button
                                                            className="reject-btn"
                                                            onClick={() => { setRejectingRequest(req); setRejectionReason(''); }}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="premium-mobile-cards">
                        {loading ? (
                            <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>Loading...</div>
                        ) : requests.length === 0 ? (
                            <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>No pending payment approvals.</div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.hospitalSubscriptionId} className="premium-mobile-card">
                                    <div className="premium-mobile-header">
                                        <div className="premium-avatar gradient-3">
                                            <Building2 size={18} color="var(--primary)" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 className="premium-hospital-name">{req.hospitalName}</h3>
                                            <p className="premium-hospital-id">ID: {req.hospitalId.split('-')[0]}... · <span style={{fontWeight: 600, color: 'var(--primary)'}}>{req.applicationName || 'EasyHMS'}</span></p>
                                        </div>
                                        <span className={`status-badge status-${req.status.toLowerCase()}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    
                                    <div className="premium-mobile-details">
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Plan Details</span>
                                            <span className="premium-mobile-detail-value" style={{fontWeight: 600, color: 'var(--primary)'}}>{req.planName || 'Unknown Plan'}</span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Trial End Date</span>
                                            <span className="premium-mobile-detail-value">
                                                {req.trialEndDate ? new Date(req.trialEndDate).toLocaleDateString('en-IN', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                }) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', borderTop: '1px dashed rgba(226, 232, 240, 0.8)', paddingTop: '12px', marginTop: '8px' }}>
                                            <span className="premium-mobile-detail-label">Payment Submitted:</span>
                                            <span className="premium-mobile-detail-value" style={{ width: '100%', textAlign: 'left', marginTop: '2px' }}>
                                                {req.paymentAmount != null ? (
                                                    <>
                                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>₹{req.paymentAmount}</strong>
                                                        {req.paymentMode && <span style={{ color: '#64748b' }}> ({req.paymentMode})</span>}
                                                        <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px'}}>{req.paymentReference}</div>
                                                    </>
                                                ) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {req.status !== 'Active' && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                            <button 
                                                className="approve-btn"
                                                onClick={() => handleApprove(req.hospitalId)}
                                                disabled={approvingId === req.hospitalId}
                                                style={{ flex: 1, justifyContent: 'center' }}
                                            >
                                                {approvingId === req.hospitalId ? 'Approving...' : 'Approve & Activate'}
                                            </button>
                                            <button 
                                                className="reject-btn"
                                                onClick={() => { setRejectingRequest(req); setRejectionReason(''); }}
                                                style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="premium-table-card">
                    {/* Desktop View: Table */}
                    <div className="premium-responsive-wrapper subscriptions-desktop-table">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: 16 }}>Hospital</th>
                                    <th>Product</th>
                                    <th>Plan Details</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                    <th>Reviewed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingHistory ? (
                                    <tr><td colSpan={6} style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>Loading...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={6} style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>No approval history yet.</td></tr>
                                ) : (
                                    history.map((entry) => (
                                        <tr key={entry.paymentId} className="premium-row">
                                            <td style={{ paddingLeft: 16 }}>
                                                <div className="premium-hospital-cell">
                                                    <div className="premium-avatar gradient-3">
                                                        <Building2 size={18} color="var(--primary)" />
                                                    </div>
                                                    <div className="premium-hospital-name">{entry.hospitalName}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <ProductBadge product={entry.applicationName || 'EasyHMS'} />
                                            </td>
                                            <td>
                                                <div style={{fontWeight: 600, color: '#0f52ba'}}>{entry.planName}</div>
                                                {entry.isProratedSwitch && (
                                                    <div style={{fontSize: 11, color: '#7c3aed', fontWeight: 700, marginTop: 4}}>
                                                        Switch from {entry.previousPlanName} &middot; credit ₹{entry.proratedCreditAmount?.toLocaleString('en-IN')}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{fontWeight: 700}}>
                                                    ₹{entry.amount}
                                                    {entry.paymentMode && <span style={{fontWeight: 500, color: '#64748b'}}> &middot; {entry.paymentMode}</span>}
                                                </div>
                                                <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{entry.reference}</div>
                                                <div style={{fontSize: '11px', color: '#94a3b8'}}>
                                                    Submitted {new Date(entry.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={`status-badge status-${entry.status.toLowerCase()}`} style={{display: 'flex', alignItems: 'center'}}>
                                                    {getStatusIcon(entry.status)}
                                                    {entry.status}
                                                </div>
                                                {entry.status === 'Rejected' && entry.rejectionReason && (
                                                    <div style={{fontSize: '11px', color: '#dc2626', marginTop: 4, maxWidth: 220}}>{entry.rejectionReason}</div>
                                                )}
                                            </td>
                                            <td style={{fontSize: '12px', color: '#64748b'}}>
                                                {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="premium-mobile-cards">
                        {loadingHistory ? (
                            <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>Loading...</div>
                        ) : history.length === 0 ? (
                            <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>No approval history yet.</div>
                        ) : (
                            history.map((entry) => (
                                <div key={entry.paymentId} className="premium-mobile-card">
                                    <div className="premium-mobile-header">
                                        <div className="premium-avatar gradient-3">
                                            <Building2 size={18} color="var(--primary)" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 className="premium-hospital-name">{entry.hospitalName}</h3>
                                            <p className="premium-hospital-id">Product: <span style={{fontWeight: 600, color: 'var(--primary)'}}>{entry.applicationName || 'EasyHMS'}</span></p>
                                        </div>
                                        <span className={`status-badge status-${entry.status.toLowerCase()}`}>
                                            {entry.status}
                                        </span>
                                    </div>
                                    
                                    <div className="premium-mobile-details">
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Plan Name</span>
                                            <span className="premium-mobile-detail-value" style={{fontWeight: 600, color: 'var(--primary)'}}>{entry.planName}</span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Amount Paid</span>
                                            <span className="premium-mobile-detail-value">
                                                <strong>₹{entry.amount}</strong>
                                                {entry.paymentMode && <span style={{color: '#64748b'}}> &middot; {entry.paymentMode}</span>}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Reference ID</span>
                                            <span className="premium-mobile-detail-value" style={{fontFamily: 'monospace', fontSize: '12px'}}>{entry.reference}</span>
                                        </div>
                                        {entry.status === 'Rejected' && entry.rejectionReason && (
                                            <div style={{marginTop: '8px', padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', borderLeft: '3px solid #dc2626', fontSize: '12px', color: '#dc2626', width: '100%'}}>
                                                <strong>Rejection Reason:</strong> {entry.rejectionReason}
                                            </div>
                                        )}
                                        <div className="premium-mobile-detail-item" style={{marginTop: '8px', borderTop: '1px dashed rgba(226, 232, 240, 0.8)', paddingTop: '12px'}}>
                                            <span className="premium-mobile-detail-label">Reviewed:</span>
                                            <span className="premium-mobile-detail-value" style={{color: '#64748b'}}>{entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {rejectingRequest && (
                <div className="reject-modal-overlay" onClick={() => !submittingReject && setRejectingRequest(null)}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header">
                            <h3>Reject Payment</h3>
                            <button className="icon-btn" onClick={() => setRejectingRequest(null)} disabled={submittingReject}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px 0' }}>
                            Rejecting the payment submitted by <strong>{rejectingRequest.hospitalName}</strong> for the{' '}
                            <strong>{rejectingRequest.planName}</strong> plan. This reason will be shown to the hospital admin
                            on their EasyHMS subscription page.
                        </p>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                            Reason for rejection
                        </label>
                        <textarea
                            rows={4}
                            autoFocus
                            placeholder="e.g. Payment reference doesn't match any transaction received, amount mismatch, etc."
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            style={{ width: '100%', fontFamily: 'inherit', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                        />
                        <div className="form-actions" style={{ marginTop: 16 }}>
                            <button className="cancel-btn" onClick={() => setRejectingRequest(null)} disabled={submittingReject}>Cancel</button>
                            <button className="reject-btn" onClick={handleConfirmReject} disabled={submittingReject}>
                                {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalsTab;
