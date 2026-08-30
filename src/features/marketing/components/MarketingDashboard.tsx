import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Users, Target } from 'lucide-react';
import { api } from '../../../services/api';

interface FinancialAttributionDto {
    totalSpend: number;
    totalRevenue: number;
    totalLeads: number;
    totalQualifiedLeads: number;
    totalCustomers: number;
    cac: number;
    cpl: number;
    cpql: number;
    roas: number;
}

export const MarketingDashboard: React.FC = () => {
    const [data, setData] = useState<FinancialAttributionDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await api.get('/api/v1/crm/analytics/financial');
                setData(res.data);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}>Loading Financial Data...</div>;
    }

    if (!data) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>Failed to load financial data.</div>;
    }

    return (
        <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 20, color: '#1e293b' }}>Financial ROI & Attribution</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
                {/* Spend */}
                <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        <DollarSign size={16} /> Total Ad Spend
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
                        ₹{data.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Revenue */}
                <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        <TrendingUp size={16} /> Total Revenue
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>
                        ₹{data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* ROAS */}
                <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        <Target size={16} /> ROAS (Return on Ad Spend)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>
                        {data.roas.toFixed(2)}x
                    </div>
                </div>

                {/* CAC */}
                <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        <Users size={16} /> CAC (Customer Acq. Cost)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
                        ₹{data.cac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <h3 style={{ marginBottom: 15, color: '#334155' }}>Pipeline Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                 <div style={{ background: '#f8fafc', padding: 15, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Total Leads</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{data.totalLeads}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>CPL: ₹{data.cpl.toFixed(2)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 15, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Qualified Leads (AI &gt; 50)</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{data.totalQualifiedLeads}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>CPQL: ₹{data.cpql.toFixed(2)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 15, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Closed-Won Customers</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{data.totalCustomers}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Conversion Rate: {data.totalLeads > 0 ? ((data.totalCustomers / data.totalLeads) * 100).toFixed(1) : 0}%</div>
                </div>
            </div>
        </div>
    );
};
