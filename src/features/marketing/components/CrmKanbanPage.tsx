import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, MoreVertical, Loader2 } from 'lucide-react';
import { type CrmLead } from '../types/crm';
import { crmService } from '../services/crmService';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { adminService, type UserSummary } from '../../admin/services/adminService';
import '../pages/Marketing.css';
import '../../settings/pages/Settings.css';

const STAGES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'NEGOTIATION', 'WON', 'LOST'] as const;

export const CrmKanbanPage: React.FC = () => {
    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [loading, setLoading] = useState(true);

    const [users, setUsers] = useState<UserSummary[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

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
        adminService.getUsers().then(res => setUsers(res)).catch(console.error);

        const handleNewHotLead = () => {
            loadLeads();
        };
        window.addEventListener('crm-hot-lead-received', handleNewHotLead);
        return () => window.removeEventListener('crm-hot-lead-received', handleNewHotLead);
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
        <div className="crm-kanban-container">
            <div className="crm-kanban-header">
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>AI CRM Pipeline</h2>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Drag and drop leads to update stages. Powered by Groq 70B AI.</p>
                </div>
                <button className="marketing-btn-primary">
                    <Sparkles size={16} /> Auto-Pilot Outreach
                </button>
            </div>

            <div className="crm-kanban-board">
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
                                className="crm-kanban-column"
                            >
                                <div className="crm-kanban-column-header">
                                    <span className="crm-kanban-column-title">{stage.replace('_', ' ')}</span>
                                    <span className="crm-kanban-column-count">{stageLeads.length}</span>
                                </div>
                                <div className="crm-kanban-column-body">
                                    {stageLeads.map(lead => (
                                        <div 
                                            key={lead.id} 
                                            draggable
                                            onClick={() => setSelectedLeadId(lead.id)}
                                            onDragStart={(e) => handleDragStart(e, lead.id)}
                                            className="crm-kanban-card"
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

            <LeadDetailDrawer
                leadId={selectedLeadId}
                isOpen={selectedLeadId !== null}
                onClose={() => setSelectedLeadId(null)}
                users={users}
                onUpdated={() => loadLeads()}
            />
        </div>
    );
};
