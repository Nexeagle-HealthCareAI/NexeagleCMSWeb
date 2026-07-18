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
    paymentDate: string | null;
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

export const ApprovalsTab: React.FC = () => {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [rejectingRequest, setRejectingRequest] = useState<PaymentRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingReject, setSubmittingReject] = useState(false);

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

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (hospitalId: string) => {
        if (!window.confirm("Are you sure you want to approve this payment and activate the subscription?")) return;

        try {
            setApprovingId(hospitalId);
            const response = await api.post(`/SubscriptionApproval/${hospitalId}/approve`, {});

            alert(response.data.message || "Subscription activated successfully!");
            await fetchRequests(); // Refresh the list
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
            await fetchRequests();
        } catch (error: any) {
            console.error('Rejection failed:', error);
            alert(error.response?.data?.message || error.response?.data || 'An error occurred while rejecting the payment.');
        } finally {
            setSubmittingReject(false);
        }
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

    return (
        <div>
            <p style={{ color: '#64748b', margin: '0 0 20px 0' }}>Review and verify manual payments before approving — 1Rad and EasyHMS requests both appear here, tagged by product.</p>

            <div className="subscriptions-card">
                <div className="subscriptions-table-container">
                    <table className="subscriptions-table">
                        <thead>
                            <tr>
                                <th>Hospital</th>
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
                                <tr><td colSpan={7} style={{textAlign: 'center', padding: '40px'}}>Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={7} style={{textAlign: 'center', padding: '40px'}}>No pending payment approvals.</td></tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.hospitalSubscriptionId}>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                <div style={{background: '#f1f5f9', padding: '8px', borderRadius: '8px', color: '#0f52ba'}}>
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div style={{fontWeight: 700}}>{req.hospitalName}</div>
                                                    <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{req.hospitalId.split('-')[0]}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <ProductBadge product={req.applicationName || 'EasyHMS'} />
                                        </td>
                                        <td>
                                            <div style={{fontWeight: 600, color: '#0f52ba'}}>{req.planName || 'Unknown Plan'}</div>
                                        </td>
                                        <td>
                                            {req.paymentAmount != null ? (
                                                <>
                                                    <div style={{fontWeight: 700}}>₹{req.paymentAmount}</div>
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
            </div>

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
