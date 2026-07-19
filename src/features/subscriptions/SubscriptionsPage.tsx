import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, Building2 } from 'lucide-react';
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
}

const SubscriptionsPage: React.FC = () => {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'1Rad' | 'EasyHMS'>('1Rad');

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
        <div className="subscriptions-page">
            <div className="subscriptions-header">
                <div>
                    <h1>Subscription Approvals</h1>
                    <p>Review and verify manual payments for Premium subscriptions</p>
                </div>
            </div>

            <div className="application-tabs" style={{marginBottom: '20px'}}>
                <button 
                    className={`tab-btn ${activeTab === '1Rad' ? 'active' : ''}`}
                    onClick={() => setActiveTab('1Rad')}
                >
                    1Rad Approvals
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'EasyHMS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('EasyHMS')}
                >
                    EasyHMS Approvals
                </button>
            </div>

            {loading ? (
                <div className="subscriptions-card" style={{padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 600}}>
                    Loading pending approvals...
                </div>
            ) : requests.filter(r => (r.applicationName || 'EasyHMS') === activeTab).length === 0 ? (
                <div className="empty-state-container">
                    <div className="empty-state-icon-wrapper">
                        <CheckCircle size={40} />
                    </div>
                    <div className="empty-state-title">All Caught Up!</div>
                    <div className="empty-state-description">
                        There are currently no pending subscription approvals for {activeTab} manual payments.
                    </div>
                </div>
            ) : (
                <div className="subscriptions-card">
                    {/* Desktop View: Table */}
                    <div className="subscriptions-table-container subscriptions-desktop-table">
                        <table className="subscriptions-table">
                            <thead>
                                <tr>
                                    <th>Hospital</th>
                                    <th>Plan Details</th>
                                    <th>Status</th>
                                    <th>Trial End Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.filter(r => (r.applicationName || 'EasyHMS') === activeTab).map((req) => (
                                    <tr key={req.hospitalSubscriptionId}>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                <div style={{background: '#f1f5f9', padding: '8px', borderRadius: '8px', color: '#4F46E5'}}>
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <div style={{fontWeight: 700}}>{req.hospitalName}</div>
                                                    <div style={{fontSize: '12px', color: '#64748b', fontFamily: 'monospace'}}>{req.hospitalId.split('-')[0]}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{fontWeight: 600, color: '#4F46E5'}}>{req.planName || 'Unknown Plan'}</div>
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
                                                <button 
                                                    className="approve-btn"
                                                    onClick={() => handleApprove(req.hospitalId)}
                                                    disabled={approvingId === req.hospitalId}
                                                >
                                                    {approvingId === req.hospitalId ? 'Approving...' : 'Approve & Activate'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Cards (Android Compatible) */}
                    <div className="subscriptions-mobile-cards">
                        {requests.filter(r => (r.applicationName || 'EasyHMS') === activeTab).map((req) => (
                            <div key={req.hospitalSubscriptionId} className="subscription-mobile-card">
                                <div className="subscription-card-header">
                                    <div className="hospital-avatar-wrapper">
                                        <Building2 size={18} color="#4F46E5" />
                                    </div>
                                    <div className="hospital-meta">
                                        <h4 className="hospital-name">{req.hospitalName}</h4>
                                        <p className="hospital-id">ID: {req.hospitalId.split('-')[0]}...</p>
                                    </div>
                                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                                        {req.status}
                                    </span>
                                </div>
                                
                                <div className="subscription-card-details">
                                    <div className="detail-row">
                                        <span className="label">Plan Name</span>
                                        <span className="value plan-name-val">{req.planName || 'Unknown Plan'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Trial End Date</span>
                                        <span className="value">
                                            {req.trialEndDate ? new Date(req.trialEndDate).toLocaleDateString('en-IN', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            }) : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                
                                {req.status !== 'Active' && (
                                    <div className="subscription-card-actions">
                                        <button 
                                            className="mobile-approve-btn"
                                            onClick={() => handleApprove(req.hospitalId)}
                                            disabled={approvingId === req.hospitalId}
                                        >
                                            {approvingId === req.hospitalId ? 'Approving...' : 'Approve & Activate'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionsPage;
