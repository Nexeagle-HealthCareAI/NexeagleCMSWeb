import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, Download } from 'lucide-react';
import { getDemoLoginLeads, type DemoLoginLeadItem } from '../services/marketingService';
import '../../settings/pages/Settings.css';
import '../../dashboard/pages/PremiumHospitals.css';
import '../../insights/components/Insights.css';
import './Marketing.css';

const DEMO_LOGIN_URL = 'https://1hms-dev.nexeagle.com/login?demo=true';
const DEMO_LOGIN_EMAIL = 'info@nexeagle.com';

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatLocation = (item: DemoLoginLeadItem): string => {
    const parts = [item.city, item.region, item.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
};

const MarketingPage: React.FC = () => {
    const [items, setItems] = useState<DemoLoginLeadItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getDemoLoginLeads(currentPage, itemsPerPage);
            setItems(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = '/demo-login-qr.png';
        link.download = 'nexeagle-1hms-demo-qr.png';
        link.click();
    };

    return (
        <div className="settings-container">
            <header className="settings-header">
                <h1 className="settings-title">Marketing</h1>
                <p className="settings-subtitle">Give doctors a live look at 1HMS — scan, log in instantly, no signup.</p>
            </header>

            <section className="settings-section">
                <h2 className="section-title">
                    <QrCode size={20} />
                    Demo Login QR
                </h2>
                <div className="qr-card-body">
                    <img src="/demo-login-qr.png" alt="1HMS Demo Login QR Code" className="qr-card-image" />
                    <div className="qr-card-details">
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                            Scanning this on a phone opens the 1HMS dev portal and logs the visitor straight
                            into the demo admin dashboard — no typing, no signup.
                        </p>
                        <span className="qr-card-url">{DEMO_LOGIN_URL}</span>
                        <p className="qr-card-credentials">
                            Demo account: <strong>{DEMO_LOGIN_EMAIL}</strong> on <strong>NexEagle General Clinic</strong>
                        </p>
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '8px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', cursor: 'pointer' }}
                            onClick={handleDownload}
                        >
                            <Download size={16} />
                            Download QR
                        </button>
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <h2 className="section-title">Demo Logins</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -8, marginBottom: 16 }}>
                    Everyone who has scanned the QR and landed in the demo — {totalItems} so far. Name and mobile
                    only appear when a visitor filled in the optional callback form after logging in.
                </p>

                <div className="premium-table-card">
                    <div className="premium-responsive-wrapper">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Name</th>
                                    <th>Mobile</th>
                                    <th>Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No demo logins recorded yet.</td></tr>
                                ) : items.map((item) => (
                                    <tr key={item.leadId} className="premium-row">
                                        <td>{formatDateTime(item.occurredAt)}</td>
                                        <td>{item.patientName || '—'}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{item.mobile || '—'}</td>
                                        <td>{formatLocation(item)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="premium-pagination">
                        <div className="premium-page-info">
                            Showing <span style={{ fontWeight: 600 }}>{totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span style={{ fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span style={{ fontWeight: 600 }}>{totalItems}</span>
                        </div>
                        <div className="premium-page-controls">
                            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="premium-page-btn">Previous</button>
                            <span style={{ margin: '0 12px', fontSize: 14, color: '#64748b' }}>Page {currentPage} of {totalPages || 1}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="premium-page-btn">Next</button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default MarketingPage;
