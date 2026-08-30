import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, MoreVertical, Loader2 } from 'lucide-react';
import { type CrmLead } from '../types/crm';
import { crmService } from '../services/crmService';
import '../pages/Marketing.css';
import '../../settings/pages/Settings.css';

const STAGES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'NEGOTIATION', 'WON', 'LOST'] as const;

export const CrmKanbanPage: React.FC = () => {
    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLeads = async () => {
        try {
            setLoading(true);
            const data = await crmService.getLeads();
            setLeads(data);
        } catch (error) {
            console.error("Failed to load CRM leads", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
    }, []);

    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        e.dataTransfer.setData('leadId', leadId);
    };

    const handleDrop = async (e: React.DragEvent, targetStage: string) => {
        const leadId = e.dataTransfer.getData('leadId');
        if (!leadId) return;

        // Optimistic UI update
        const originalLeads = [...leads];
        setLeads(leads.map(l => l.id === leadId ? { ...l, status: targetStage as any } : l));

        try {
            await crmService.updateLeadStage(leadId, targetStage);
        } catch (error) {
            console.error("Failed to update lead stage", error);
            setLeads(originalLeads); // Revert on failure
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', background: '#f8fafc', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>AI CRM Pipeline</h2>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Drag and drop leads to update stages. Powered by Groq 70B AI.</p>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <Sparkles size={16} /> Auto-Pilot Outreach
                </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', flex: 1, paddingBottom: '16px' }}>
                {loading && leads.length === 0 ? (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '8px' }}>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading Pipeline...
                    </div>
                ) : (
                    STAGES.map(stage => {
                        const stageLeads = leads.filter(l => l.status === stage);
                        return (
                            <div 
                                key={stage} 
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage)}
                                style={{ minWidth: '300px', maxWidth: '300px', background: '#e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}
                            >
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#475569' }}>{stage.replace('_', ' ')}</span>
                                    <span style={{ background: '#cbd5e1', color: '#334155', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{stageLeads.length}</span>
                                </div>
                                <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {stageLeads.map(lead => (
                                        <div 
                                            key={lead.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', cursor: 'grab' }}
                                        >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{lead.facilityName}</span>
                                            <MoreVertical size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>{lead.contactName} • {lead.city}</div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#d97706', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
                                            <Sparkles size={14} /> Score: {lead.aiIntentScore}/100
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>₹{(lead.dealValue/1000).toFixed(0)}k</span>
                                            <button style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                <MessageCircle size={12} /> WhatsApp
                                            </button>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};
