import React from 'react';
import { TrendingUp, DollarSign, Activity, Target } from 'lucide-react';
import './Insights.css';

export const PredictiveRoiPanel: React.FC = () => {
    return (
        <div className="insights-panel-container">
            <div className="insights-panel-header">
                <div>
                    <h2 className="insights-panel-title">AI Predictive Financial ROI</h2>
                    <p className="insights-panel-subtitle">Groq 70B AI forecasted revenue impact based on current pipeline momentum.</p>
                </div>
            </div>

            <div className="insights-stat-grid" style={{ marginBottom: 20 }}>
                <div className="insights-stat-card">
                    <div className="insights-stat-value">₹24.5L</div>
                    <div className="insights-stat-label"><TrendingUp size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Forecasted Q3 Pipeline</div>
                </div>
                <div className="insights-stat-card">
                    <div className="insights-stat-value">18.2%</div>
                    <div className="insights-stat-label"><Activity size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Projected Conversion Rate</div>
                </div>
                <div className="insights-stat-card">
                    <div className="insights-stat-value">₹4.2L</div>
                    <div className="insights-stat-label"><DollarSign size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Est. Marketing ROI</div>
                </div>
                <div className="insights-stat-card">
                    <div className="insights-stat-value">14 Days</div>
                    <div className="insights-stat-label"><Target size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Avg. Sales Cycle</div>
                </div>
            </div>

            <div className="premium-table-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>AI Recommendations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                        <strong style={{ color: '#166534', display: 'block', marginBottom: 4 }}>Action: Double-down on WhatsApp Outreach</strong>
                        <p style={{ color: '#15803d', margin: 0, fontSize: 13 }}>Leads touched by WhatsApp have a 3x higher conversion rate. Automatically triggering the 14-day Drip for all 'New' leads is projected to yield ₹2.1L in additional ARR.</p>
                    </div>
                    <div style={{ padding: 16, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 8 }}>
                        <strong style={{ color: '#854d0e', display: 'block', marginBottom: 4 }}>Risk: Stalled 'Negotiation' Pipeline</strong>
                        <p style={{ color: '#713f12', margin: 0, fontSize: 13 }}>3 high-value deals are stuck in negotiation for &gt;7 days. AI recommends sending the "ROI Case Study" social campaign to these decision-makers.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
