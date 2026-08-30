import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, Download, Users, Eye, MapPin, Target, Sparkles, Share2 } from 'lucide-react';
import { getDemoLoginLeads, getDemoLoginStats, type DemoLoginLeadItem, type DemoLoginStats, type DemoLocationCount } from '../services/marketingService';
import { LeadsPipeline } from '../components/LeadsPipeline';
import { CrmKanbanPage } from '../components/CrmKanbanPage';
import { SocialCampaignsPage } from '../components/SocialCampaignsPage';
import '../../settings/pages/Settings.css';
import '../../dashboard/pages/PremiumHospitals.css';
import '../../insights/components/Insights.css';
import './Marketing.css';

const DEMO_LOGIN_URL = 'https://1hms-dev.nexeagle.com/login?demo=true';
const DEMO_LOGIN_EMAIL = 'info@nexeagle.com';

const formatDateTimeIST = (iso: string): string => {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    return `${datePart}, ${timePart}`;
};

const formatLocation = (item: { city: string | null; region: string | null; country: string | null }): string => {
    const parts = [item.city, item.region, item.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Unknown';
};

const MarketingPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pipeline' | 'demoLogins' | 'aiCrm' | 'social'>('aiCrm');

    const [items, setItems] = useState<DemoLoginLeadItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [stats, setStats] = useState<DemoLoginStats | null>(null);
    const itemsPerPage = 10;

    const fetchLeads = useCallback(async () => {
        if (activeTab !== 'demoLogins') return;
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
    }, [currentPage, activeTab]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        if (activeTab === 'demoLogins') {
            getDemoLoginStats().then(setStats).catch(() => setStats(null));
        }
    }, [totalItems, activeTab]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = '/demo-login-qr.png';
        link.download = 'nexeagle-1hms-demo-qr.png';
        link.click();
    };

    return (
        <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header className="settings-header" style={{ paddingBottom: 0, marginBottom: 20 }}>
                <h1 className="settings-title">Marketing</h1>
                <p className="settings-subtitle">Manage B2B sales pipeline and track live demo logins.</p>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 32, marginTop: 24, borderBottom: '1px solid #e2e8f0' }}>
                    <button
                        onClick={() => setActiveTab('pipeline')}
                        style={{
                            padding: '0 0 12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: 14, fontWeight: activeTab === 'pipeline' ? 700 : 500,
                            color: activeTab === 'pipeline' ? '#6366f1' : '#64748b',
                            borderBottom: activeTab === 'pipeline' ? '2px solid #6366f1' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                        }}
                    >
                        <Target size={16} /> Leads Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab('demoLogins')}
                        style={{
                            padding: '0 0 12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: 14, fontWeight: activeTab === 'demoLogins' ? 700 : 500,
                            color: activeTab === 'demoLogins' ? '#6366f1' : '#64748b',
                            borderBottom: activeTab === 'demoLogins' ? '2px solid #6366f1' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                        }}
                    >
                        <QrCode size={16} /> Demo Logins
                    </button>
                    <button
                        onClick={() => setActiveTab('aiCrm')}
                        style={{
                            padding: '0 0 12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: 14, fontWeight: activeTab === 'aiCrm' ? 700 : 500,
                            color: activeTab === 'aiCrm' ? '#6366f1' : '#64748b',
                            borderBottom: activeTab === 'aiCrm' ? '2px solid #6366f1' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                        }}
                    >
                        <Sparkles size={16} /> AI Growth CRM
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        style={{
                            padding: '0 0 12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: 14, fontWeight: activeTab === 'social' ? 700 : 500,
                            color: activeTab === 'social' ? '#6366f1' : '#64748b',
                            borderBottom: activeTab === 'social' ? '2px solid #6366f1' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                        }}
                    >
                        <Share2 size={16} /> Social Autopilot
                    </button>
                </div>
            </header>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'pipeline' && (
                    <LeadsPipeline />
                )}

                {activeTab === 'demoLogins' && (
                    <div style={{ height: '100%', overflowY: 'auto', paddingRight: 8 }}>
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
                            <h2 className="section-title">Demo Logins Log</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -8, marginBottom: 16 }}>
                                Everyone who has scanned the QR and landed in the demo.
                            </p>

                            {stats && (
                                <>
                                    <div className="insights-stat-grid" style={{ marginBottom: 16 }}>
                                        <div className="insights-stat-card">
                                            <div className="insights-stat-value">{stats.totalLogins.toLocaleString()}</div>
                                            <div className="insights-stat-label"><Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Total Demo Logins</div>
                                        </div>
                                        <div className="insights-stat-card">
                                            <div className="insights-stat-value">{stats.uniqueVisitors.toLocaleString()}</div>
                                            <div className="insights-stat-label"><Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Unique Visitors</div>
                                        </div>
                                    </div>

                                    {stats.topLocations.length > 0 && (
                                        <div className="insights-mini-table-card" style={{ marginBottom: 16 }}>
                                            <h3 className="insights-mini-table-title"><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Top Locations</h3>
                                            {stats.topLocations.map((loc: DemoLocationCount, i: number) => (
                                                <div key={i} className="insights-mini-row">
                                                    <span className="insights-mini-row-label">{formatLocation(loc)}</span>
                                                    <span className="insights-mini-row-value">{loc.count.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="premium-table-card">
                                <div className="premium-responsive-wrapper">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>When (IST)</th>
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
                                                    <td>{formatDateTimeIST(item.occurredAt)}</td>
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
                )}

                {activeTab === 'aiCrm' && (
                    <CrmKanbanPage />
                )}

                {activeTab === 'social' && (
                    <SocialCampaignsPage />
                )}
            </div>
        </div>
    );
};

export default MarketingPage;
