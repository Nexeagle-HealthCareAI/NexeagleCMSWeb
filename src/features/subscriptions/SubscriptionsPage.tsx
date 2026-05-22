import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, CreditCard, Building2 } from 'lucide-react';
import { api } from '../../services/api';
import { API_ENDPOINTS } from '../../services/endpoints';
import './SubscriptionsPage.css';

interface PaymentRequest {
    requestId: string;
    hospitalId: string;
    hospitalName: string;
    planName: string;
    billingCycle: string;
    status: string;
    reviewNote: string | null;
    createdAt: string;
    paymentMode: string;
    amount: number;
}

const SubscriptionsPage: React.FC = () => {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await api.get(API_ENDPOINTS.SUBSCRIPTIONS.GET_ALL_REQUESTS);
            if (response.data.success) {
                setRequests(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch payment requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (requestId: string) => {
        if (!window.confirm("Are you sure you want to approve this payment and activate the subscription?")) return;
        
        try {
            setApprovingId(requestId);
            const response = await api.post(`${API_ENDPOINTS.SUBSCRIPTIONS.APPROVE}/${requestId}`, {
                reviewNote: "Payment verified by Nexeagle Admin"
            });
            
            if (response.data.success) {
                alert("Subscription activated successfully!");
                await fetchRequests(); // Refresh the list
            } else {
                alert(response.data.error || "Failed to approve payment");
            }
        } catch (error) {
            console.error('Approval failed:', error);
            alert("An error occurred while approving the payment.");
        } finally {
            setApprovingId(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved': return <CheckCircle size={16} className="mr-2" />;
            case 'rejected': return <XCircle size={16} className="mr-2" />;
            default: return <Clock size={16} className="mr-2" />;
        }
    };

    return (
        <div className="subscriptions-page">
            <div className="subscriptions-header">
                <div>
                    <h1>Subscription Approvals</h1>
                    <p>Review and verify manual payments for 1Rad Premium subscriptions</p>
                </div>
            </div>

            <div className="subscriptions-card">
                <div className="subscriptions-table-container">
                    <table className="subscriptions-table">
                        <thead>
                            <tr>
                                <th>Hospital</th>
                                <th>Plan Details</th>
                                <th>Payment Info</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{textAlign: 'center', padding: '40px'}}>Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={6} style={{textAlign: 'center', padding: '40px'}}>No payment requests found.</td></tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.requestId}>
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
                                            <div style={{fontWeight: 600, color: '#0f52ba'}}>{req.planName || 'Premium'}</div>
                                            <div style={{fontSize: '12px', color: '#64748b'}}>{req.billingCycle}</div>
                                        </td>
                                        <td>
                                            <div style={{fontWeight: 700}}>₹{req.amount}</div>
                                            <div style={{fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                                <CreditCard size={12}/> {req.paymentMode}
                                            </div>
                                        </td>
                                        <td>
                                            {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                        </td>
                                        <td>
                                            <div className={`status-badge status-${req.status.toLowerCase()}`} style={{display: 'flex', alignItems: 'center'}}>
                                                {getStatusIcon(req.status)}
                                                {req.status}
                                            </div>
                                        </td>
                                        <td>
                                            {req.status === 'Pending' && (
                                                <button 
                                                    className="approve-btn"
                                                    onClick={() => handleApprove(req.requestId)}
                                                    disabled={approvingId === req.requestId}
                                                >
                                                    {approvingId === req.requestId ? 'Approving...' : 'Approve & Activate'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionsPage;
