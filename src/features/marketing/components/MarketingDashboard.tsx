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
            <h2 className="marketing-section-title">Financial ROI & Attribution</h2>
            
            <div className="marketing-grid-4">
                {/* Spend */}
                <div className="marketing-stat-card">
                    <div className="marketing-stat-header">
                        <DollarSign size={16} /> Total Ad Spend
                    </div>
                    <div className="marketing-stat-value text-dark">
                        ₹{data.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Revenue */}
                <div className="marketing-stat-card">
                    <div className="marketing-stat-header">
                        <TrendingUp size={16} /> Total Revenue
                    </div>
                    <div className="marketing-stat-value text-green">
                        ₹{data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* ROAS */}
                <div className="marketing-stat-card">
                    <div className="marketing-stat-header">
                        <Target size={16} /> ROAS (Return on Ad Spend)
                    </div>
                    <div className="marketing-stat-value text-indigo">
                        {data.roas.toFixed(2)}x
                    </div>
                </div>

                {/* CAC */}
                <div className="marketing-stat-card">
                    <div className="marketing-stat-header">
                        <Users size={16} /> CAC (Customer Acq. Cost)
                    </div>
                    <div className="marketing-stat-value text-dark">
                        ₹{data.cac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <h3 className="marketing-section-title">Pipeline Metrics</h3>
            <div className="marketing-grid-3">
                 <div className="marketing-pipeline-card">
                    <div className="marketing-pipeline-label">Total Leads</div>
                    <div className="marketing-pipeline-value">{data.totalLeads}</div>
                    <div className="marketing-pipeline-subtext">CPL: ₹{data.cpl.toFixed(2)}</div>
                </div>
                <div className="marketing-pipeline-card">
                    <div className="marketing-pipeline-label">Qualified Leads (AI &gt; 50)</div>
                    <div className="marketing-pipeline-value">{data.totalQualifiedLeads}</div>
                    <div className="marketing-pipeline-subtext">CPQL: ₹{data.cpql.toFixed(2)}</div>
                </div>
                <div className="marketing-pipeline-card">
                    <div className="marketing-pipeline-label">Closed-Won Customers</div>
                    <div className="marketing-pipeline-value">{data.totalCustomers}</div>
                    <div className="marketing-pipeline-subtext">Conversion Rate: {data.totalLeads > 0 ? ((data.totalCustomers / data.totalLeads) * 100).toFixed(1) : 0}%</div>
                </div>
            </div>
        </div>
    );
};
