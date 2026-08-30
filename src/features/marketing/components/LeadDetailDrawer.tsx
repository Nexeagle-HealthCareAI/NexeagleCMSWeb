import React, { useEffect, useState } from 'react';
import {
    X, Phone, Mail, MapPin, User, Loader2, Plus, Edit2,
    PhoneCall, MessageCircle, AtSign, Users, FileText, Clock, Sparkles, Wand2, Copy
} from 'lucide-react';
import { salesLeadService, type SalesLeadDetail, type LeadStage, type LeadPriority, type ActivityType, type UpdateSalesLeadRequest } from '../services/salesLeadService';
import { crmService } from '../services/crmService';
import type { UserSummary } from '../../admin/services/adminService';
import { formatDateTimeIST } from '../utils/formatters';
import { toast } from 'sonner';

interface LeadDetailDrawerProps {
    leadId: string | null;
    isOpen: boolean;
    onClose: () => void;
    users: UserSummary[];
    onUpdated: () => void;
}

const STAGES: LeadStage[] = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won', 'Closed Lost'];
const PRIORITIES: LeadPriority[] = ['High', 'Medium', 'Low'];
const ACTIVITY_TYPES: ActivityType[] = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Note'];

const STAGE_COLORS: Record<LeadStage, { bg: string; text: string }> = {
    'New':            { bg: '#e0f2fe', text: '#0369a1' },
    'Contacted':      { bg: '#fef9c3', text: '#92400e' },
    'Demo Scheduled': { bg: '#ddd6fe', text: '#5b21b6' },
    'Demo Done':      { bg: '#cffafe', text: '#0e7490' },
    'Negotiation':    { bg: '#fde68a', text: '#78350f' },
    'Closed Won':     { bg: '#d1fae5', text: '#065f46' },
    'Closed Lost':    { bg: '#fee2e2', text: '#991b1b' },
};

const PRIORITY_COLORS: Record<LeadPriority, { bg: string; text: string }> = {
    High:   { bg: '#fee2e2', text: '#b91c1c' },
    Medium: { bg: '#fef9c3', text: '#92400e' },
    Low:    { bg: '#dcfce7', text: '#166534' },
};

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
    Call:      <PhoneCall size={14} />,
    WhatsApp:  <MessageCircle size={14} />,
    Email:     <AtSign size={14} />,
    Meeting:   <Users size={14} />,
    Note:      <FileText size={14} />,
};

const pill = (bg: string, text: string, label: string) => (
    <span style={{ background: bg, color: text, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
        {label}
    </span>
);

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #e2e8f0',
    fontSize: 13, background: 'white', boxSizing: 'border-box',
};

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ leadId, isOpen, onClose, users, onUpdated }) => {
    const [lead, setLead] = useState<SalesLeadDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Inline edit stage/priority
    const [editStage, setEditStage] = useState<LeadStage>('New');
    const [editPriority, setEditPriority] = useState<LeadPriority>('Medium');
    const [editAssignee, setEditAssignee] = useState('');

    // Inline edit details
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editDetails, setEditDetails] = useState({ hospitalName: '', contactName: '', mobile: '', email: '', city: '', state: '' });

    // Follow-up form
    const [fuType, setFuType] = useState<ActivityType>('Call');
    const [fuNotes, setFuNotes] = useState('');
    const [savingFu, setSavingFu] = useState(false);
    const [showFuForm, setShowFuForm] = useState(false);

    // AI Co-Pilot State
    const [aiPitch, setAiPitch] = useState('');
    const [generatingPitch, setGeneratingPitch] = useState(false);
    const [objection, setObjection] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [resolvingObjection, setResolvingObjection] = useState(false);

    // Meta Templates
    const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);

    useEffect(() => {
        if (!leadId || !isOpen) return;
        setLoading(true);
        setLead(null);
        salesLeadService.getLead(leadId)
            .then(d => {
                setLead(d);
                setEditStage(d.stage);
                setEditPriority(d.priority);
                setEditAssignee(d.assignedToUserId || '');
                setEditDetails({ 
                    hospitalName: d.hospitalName, 
                    contactName: d.contactName || '', 
                    mobile: d.mobile || '', 
                    email: d.email || '', 
                    city: d.city || '', 
                    state: d.state || '' 
                });
                setIsEditingDetails(false);
            })
            .catch(() => setLead(null))
            .finally(() => setLoading(false));
    }, [leadId, isOpen]);

    const handlePatch = async (patch: UpdateSalesLeadRequest) => {
        if (!lead) return;
        try {
            setUpdating(true);
            const updated = await salesLeadService.updateLead(lead.leadId, patch);
            setLead(updated);
            setEditStage(updated.stage);
            setEditPriority(updated.priority);
            setEditAssignee(updated.assignedToUserId || '');
            onUpdated();
        } finally {
            setUpdating(false);
        }
    };

    const handleAddFollowUp = async () => {
        if (!lead || !fuNotes.trim()) return;
        try {
            setSavingFu(true);
            const fu = await salesLeadService.addFollowUp(lead.leadId, { activityType: fuType, notes: fuNotes });
            setLead(prev => prev ? { ...prev, followUps: [fu, ...prev.followUps] } : prev);
            setFuNotes('');
            setShowFuForm(false);
            onUpdated();
        } finally {
            setSavingFu(false);
        }
    };

    const handleGeneratePitch = async () => {
        if (!lead) return;
        try {
            setGeneratingPitch(true);
            const generatedPitch = await crmService.generatePitch(lead.leadId);
            setAiPitch(generatedPitch);
        } catch (error) {
            console.error("Failed to generate pitch", error);
            setAiPitch("Failed to connect to Groq AI. Please try again.");
        } finally {
            setGeneratingPitch(false);
        }
    };

    const handleResolveObjection = async () => {
        if (!objection.trim() || !lead) return;
        try {
            setResolvingObjection(true);
            const response = await crmService.resolveObjection(lead.leadId, objection);
            setAiResponse(response);
        } catch (error) {
            console.error("Failed to resolve objection", error);
            setAiResponse("Failed to connect to Groq AI. Please try again.");
        } finally {
            setResolvingObjection(false);
        }
    };

    const handleSendTemplate = async (templateName: string) => {
        if (!lead) return;
        try {
            setSendingTemplate(templateName);
            await salesLeadService.sendWhatsAppTemplate(lead.leadId, templateName);
            toast.success(`WhatsApp template '${templateName}' sent successfully!`);
            
            // Add follow-up locally to refresh timeline immediately
            const activityType: ActivityType = 'WhatsApp';
            setLead(prev => prev ? {
                ...prev,
                followUps: [{
                    followUpId: Math.random().toString(),
                    activityType: activityType,
                    notes: `Sent Meta Template: ${templateName}`,
                    authorName: 'SYSTEM',
                    createdAt: new Date().toISOString()
                }, ...prev.followUps]
            } : prev);
        } catch (error) {
            console.error("Failed to send template", error);
            toast.error("Failed to send WhatsApp template. Please ensure the lead has a valid phone number and the API is configured.");
        } finally {
            setSendingTemplate(null);
        }
    };

    const formatLeadForShare = () => {
        if (!lead) return '';
        return `*Lead Profile: ${lead.hospitalName}*
Stage: ${lead.stage}
Priority: ${lead.priority}
Contact: ${lead.contactName || 'N/A'}
Mobile: ${lead.mobile || 'N/A'}
Email: ${lead.email || 'N/A'}
Location: ${[lead.city, lead.state].filter(Boolean).join(', ') || 'N/A'}`;
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(formatLeadForShare());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const handleShareEmail = () => {
        const subject = encodeURIComponent(`Lead Profile: ${lead?.hospitalName}`);
        const body = encodeURIComponent(formatLeadForShare());
        window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    };

    const handleCopyLead = () => {
        navigator.clipboard.writeText(formatLeadForShare());
        toast.success("Lead details copied to clipboard!");
    };

    if (!isOpen) return null;

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000 }} />
            <div style={{
                position: 'fixed', top: 0, right: 0, height: '100%', width: '100%',
                maxWidth: 500, zIndex: 1001, background: 'white',
                boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                animation: 'slideInRight 0.25s ease',
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '20px 20px 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                                Lead Profile
                            </div>
                            <h2 style={{ color: 'white', fontWeight: 700, fontSize: 17, margin: 0 }}>
                                {loading ? 'Loading…' : lead?.hospitalName ?? '—'}
                            </h2>
                            {lead && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {pill(STAGE_COLORS[lead.stage].bg, STAGE_COLORS[lead.stage].text, lead.stage)}
                                    {pill(PRIORITY_COLORS[lead.priority].bg, PRIORITY_COLORS[lead.priority].text, lead.priority)}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {lead && (
                                <>
                                    <button onClick={handleShareWhatsApp} title="Share via WhatsApp" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#22c55e', display: 'flex' }}>
                                        <MessageCircle size={16} />
                                    </button>
                                    <button onClick={handleShareEmail} title="Share via Email" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}>
                                        <Mail size={16} />
                                    </button>
                                    <button onClick={handleCopyLead} title="Copy Lead Details" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
                                        <Copy size={16} />
                                    </button>
                                </>
                            )}
                            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#94a3b8' }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                        </div>
                    ) : !lead ? (
                        <p style={{ color: '#ef4444', textAlign: 'center', padding: 40 }}>Failed to load lead.</p>
                    ) : (
                        <>
                            {/* Contact Info */}
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isEditingDetails ? 12 : 0 }}>
                                    {isEditingDetails ? (
                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <input style={inputStyle} placeholder="Hospital Name" value={editDetails.hospitalName} onChange={e => setEditDetails({...editDetails, hospitalName: e.target.value})} />
                                            <input style={inputStyle} placeholder="Contact Name" value={editDetails.contactName} onChange={e => setEditDetails({...editDetails, contactName: e.target.value})} />
                                            <input style={inputStyle} placeholder="Mobile" value={editDetails.mobile} onChange={e => setEditDetails({...editDetails, mobile: e.target.value})} />
                                            <input style={inputStyle} placeholder="Email" value={editDetails.email} onChange={e => setEditDetails({...editDetails, email: e.target.value})} />
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input style={inputStyle} placeholder="City" value={editDetails.city} onChange={e => setEditDetails({...editDetails, city: e.target.value})} />
                                                <input style={inputStyle} placeholder="State" value={editDetails.state} onChange={e => setEditDetails({...editDetails, state: e.target.value})} />
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                <button onClick={() => { setIsEditingDetails(false); setEditDetails({ hospitalName: lead.hospitalName, contactName: lead.contactName || '', mobile: lead.mobile || '', email: lead.email || '', city: lead.city || '', state: lead.state || '' }); }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                                                <button onClick={() => { handlePatch(editDetails); setIsEditingDetails(false); }} disabled={updating || !editDetails.hospitalName.trim()} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: '#6366f1', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1 }}>
                                            {lead.contactName && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                                                    <User size={13} color="#6366f1" /> <span style={{ fontWeight: 600 }}>{lead.contactName}</span>
                                                </div>
                                            )}
                                            {lead.mobile && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13, color: '#475569' }}>
                                                    <Phone size={13} color="#94a3b8" /> {lead.mobile}
                                                </div>
                                            )}
                                            {lead.email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13, color: '#475569' }}>
                                                    <Mail size={13} color="#94a3b8" /> {lead.email}
                                                </div>
                                            )}
                                            {(lead.city || lead.state) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                                                    <MapPin size={13} color="#94a3b8" /> {[lead.city, lead.state].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                            {!lead.contactName && !lead.mobile && !lead.email && !lead.city && !lead.state && (
                                                <span style={{ fontSize: 12, color: '#94a3b8' }}>No contact info provided.</span>
                                            )}
                                        </div>
                                    )}
                                    
                                    {!isEditingDetails && (
                                        <button onClick={() => setIsEditingDetails(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Quick Update: Stage / Priority / Assignee */}
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Update Pipeline</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Stage</label>
                                        <select style={inputStyle} value={editStage} onChange={e => setEditStage(e.target.value as LeadStage)}
                                            onBlur={() => editStage !== lead.stage && handlePatch({ stage: editStage })}
                                            disabled={updating}>
                                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Priority</label>
                                        <select style={inputStyle} value={editPriority} onChange={e => setEditPriority(e.target.value as LeadPriority)}
                                            onBlur={() => editPriority !== lead.priority && handlePatch({ priority: editPriority })}
                                            disabled={updating}>
                                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Assigned To</label>
                                    <select style={inputStyle} value={editAssignee}
                                        onChange={e => { setEditAssignee(e.target.value); handlePatch({ assignedToUserId: e.target.value || undefined }); }}
                                        disabled={updating}>
                                        <option value="">— Unassigned —</option>
                                        {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                                    </select>
                                </div>
                                {updating && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Saving…</p>}
                            </div>

                            {/* Notes */}
                            {lead.notes && (
                                <div style={{ marginBottom: 20, padding: 12, background: '#fefce8', borderRadius: 10, border: '1px solid #fde68a', fontSize: 13, color: '#78350f' }}>
                                    <strong style={{ display: 'block', marginBottom: 4 }}>Notes</strong>
                                    {lead.notes}
                                </div>
                            )}

                            {/* AI Co-Pilot Section */}
                            <div style={{ marginBottom: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
                                    <Sparkles size={16} /> Groq 70B AI Sales Co-Pilot
                                </div>
                                
                                <div style={{ marginBottom: 16 }}>
                                    <button
                                        onClick={handleGeneratePitch}
                                        disabled={generatingPitch}
                                        style={{ width: '100%', padding: '8px', background: 'white', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    >
                                        {generatingPitch ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageCircle size={14} />}
                                        Generate Hyper-Personalized WhatsApp Pitch
                                    </button>
                                    {aiPitch && (
                                        <div style={{ marginTop: 8, padding: 10, background: 'white', borderRadius: 8, fontSize: 12, color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                                            {aiPitch}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                                <button style={{ padding: '4px 10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Send via WhatsApp API</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input 
                                            value={objection}
                                            onChange={e => setObjection(e.target.value)}
                                            placeholder="e.g. It's too expensive..."
                                            style={{ flex: 1, padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: 12, outline: 'none' }}
                                        />
                                        <button
                                            onClick={handleResolveObjection}
                                            disabled={resolvingObjection || !objection.trim()}
                                            style={{ padding: '8px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            {resolvingObjection ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />}
                                            Handle Objection
                                        </button>
                                    </div>
                                    {aiResponse && (
                                        <div style={{ marginTop: 8, padding: 10, background: 'white', borderRadius: 8, fontSize: 12, color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                                            {aiResponse}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 1-Click Meta Templates */}
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>1-Click Meta Templates</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    <button 
                                        onClick={() => handleSendTemplate('day1_intro_pitch')}
                                        disabled={sendingTemplate !== null}
                                        style={{ padding: '8px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                                    >
                                        {sendingTemplate === 'day1_intro_pitch' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageCircle size={16} />}
                                        Day 1: Video Pitch
                                    </button>
                                    <button 
                                        onClick={() => handleSendTemplate('day3_roi_case_study')}
                                        disabled={sendingTemplate !== null}
                                        style={{ padding: '8px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                                    >
                                        {sendingTemplate === 'day3_roi_case_study' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
                                        Day 3: ROI PDF
                                    </button>
                                    <button 
                                        onClick={() => handleSendTemplate('day7_demo_invite')}
                                        disabled={sendingTemplate !== null}
                                        style={{ padding: '8px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                                    >
                                        {sendingTemplate === 'day7_demo_invite' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                                        Day 7: Demo Invite
                                    </button>
                                </div>
                            </div>

                            {/* Follow-up Timeline */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                        Follow-up Timeline ({lead.followUps.length})
                                    </p>
                                    <button
                                        onClick={() => setShowFuForm(v => !v)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: '#6366f1', border: 'none', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                </div>

                                {/* Add Follow-up Form */}
                                {showFuForm && (
                                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                            {ACTIVITY_TYPES.map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setFuType(t)}
                                                    style={{
                                                        padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                        border: `1.5px solid ${fuType === t ? '#6366f1' : '#e2e8f0'}`,
                                                        background: fuType === t ? '#ede9fe' : 'white',
                                                        color: fuType === t ? '#6366f1' : '#64748b',
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                    }}
                                                >
                                                    {ACTIVITY_ICONS[t]} {t}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                                            placeholder="What happened in this interaction?"
                                            value={fuNotes}
                                            onChange={e => setFuNotes(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button onClick={() => setShowFuForm(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#475569' }}>Cancel</button>
                                            <button
                                                onClick={handleAddFollowUp}
                                                disabled={savingFu || !fuNotes.trim()}
                                                style={{ flex: 2, padding: '7px 0', borderRadius: 7, border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (savingFu || !fuNotes.trim()) ? 0.6 : 1 }}
                                            >
                                                {savingFu ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                                Log {fuType}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Timeline */}
                                {lead.followUps.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No follow-ups logged yet.</p>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        {lead.followUps.map((fu, i) => (
                                            <div key={fu.followUpId} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                                                        {ACTIVITY_ICONS[fu.activityType as ActivityType] ?? <FileText size={12} />}
                                                    </div>
                                                    {i < lead.followUps.length - 1 && (
                                                        <div style={{ width: 2, flex: 1, background: '#e2e8f0', marginTop: 4 }} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 12, color: '#6366f1' }}>{fu.activityType}</span>
                                                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <Clock size={11} /> {formatDateTimeIST(fu.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{fu.notes}</p>
                                                    {fu.authorName && (
                                                        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>by {fu.authorName}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </>
    );
};
