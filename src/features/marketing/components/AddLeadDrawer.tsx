import React, { useState } from 'react';
import { X, Building2, User, Phone, Mail, MapPin, Loader2, Check } from 'lucide-react';
import {
    salesLeadService,
    CreateSalesLeadRequest,
    LeadStage,
    LeadPriority,
    LeadSource,
} from '../services/salesLeadService';
import type { UserSummary } from '../../admin/services/adminService';

interface AddLeadDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    users: UserSummary[];
    onCreated: () => void;
}

const STAGES: LeadStage[] = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won', 'Closed Lost'];
const PRIORITIES: LeadPriority[] = ['High', 'Medium', 'Low'];
const SOURCES: LeadSource[] = ['Cold Call', 'WhatsApp', 'Website', 'Referral', 'Event', 'Partner', 'Manual', 'Other'];

const PRIORITY_COLORS: Record<LeadPriority, string> = {
    High:   'background:#fee2e2;color:#b91c1c',
    Medium: 'background:#fef9c3;color:#92400e',
    Low:    'background:#dcfce7;color:#166534',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 13, background: 'white', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px',
};
const fieldStyle: React.CSSProperties = { marginBottom: 16 };

export const AddLeadDrawer: React.FC<AddLeadDrawerProps> = ({ isOpen, onClose, users, onCreated }) => {
    const [form, setForm] = useState<Partial<CreateSalesLeadRequest>>({
        stage: 'New',
        priority: 'Medium',
        source: 'Manual',
    });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: keyof CreateSalesLeadRequest, v: string) =>
        setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.hospitalName?.trim()) { setError('Hospital name is required'); return; }
        try {
            setSaving(true);
            setError(null);
            await salesLeadService.createLead({
                hospitalName:    form.hospitalName!,
                contactName:     form.contactName,
                mobile:          form.mobile,
                email:           form.email,
                city:            form.city,
                state:           form.state,
                source:          form.source as LeadSource,
                stage:           form.stage as LeadStage,
                priority:        form.priority as LeadPriority,
                notes:           form.notes,
                assignedToUserId: form.assignedToUserId,
            });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setForm({ stage: 'New', priority: 'Medium', source: 'Manual' });
                onCreated();
                onClose();
            }, 1500);
        } catch {
            setError('Failed to create lead. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(2px)', zIndex: 1000,
                }}
            />
            {/* Drawer */}
            <div style={{
                position: 'fixed', top: 0, right: 0, height: '100%', width: '100%',
                maxWidth: 460, zIndex: 1001, background: 'white',
                boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
                display: 'flex', flexDirection: 'column',
                animation: 'slideInRight 0.25s ease',
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    padding: '20px 20px 16px', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ color: 'white', fontWeight: 700, fontSize: 17, margin: 0 }}>
                                Add New Lead
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '4px 0 0' }}>
                                Track a prospective hospital client
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                                padding: 8, cursor: 'pointer', color: 'white', display: 'flex',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={28} color="#059669" />
                            </div>
                            <p style={{ fontWeight: 700, color: '#059669', fontSize: 15 }}>Lead Created!</p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
                                    {error}
                                </div>
                            )}

                            {/* Hospital Info */}
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Building2 size={13} /> Hospital Details
                                </p>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Hospital Name *</label>
                                    <input style={inputStyle} placeholder="e.g. City Care Hospital" value={form.hospitalName || ''} onChange={e => set('hospitalName', e.target.value)} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>City</label>
                                        <input style={inputStyle} placeholder="Patna" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>State</label>
                                        <input style={inputStyle} placeholder="Bihar" value={form.state || ''} onChange={e => set('state', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <User size={13} /> Contact Person
                                </p>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Contact Name</label>
                                    <input style={inputStyle} placeholder="Dr. Ravi Kumar" value={form.contactName || ''} onChange={e => set('contactName', e.target.value)} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>Mobile</label>
                                        <input style={inputStyle} placeholder="+91-98XXXXXXXX" value={form.mobile || ''} onChange={e => set('mobile', e.target.value)} />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>Email</label>
                                        <input type="email" style={inputStyle} placeholder="dr@hospital.in" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* Pipeline Fields */}
                            <div style={{ paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
                                    Pipeline
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>Stage</label>
                                        <select style={inputStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
                                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>Priority</label>
                                        <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Source</label>
                                    <select style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}>
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Assign To</label>
                                    <select style={inputStyle} value={form.assignedToUserId || ''} onChange={e => set('assignedToUserId', e.target.value)}>
                                        <option value="">— Unassigned —</option>
                                        {users.map(u => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Initial Notes</label>
                                    <textarea
                                        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                                        placeholder="Any context from the initial conversation..."
                                        value={form.notes || ''}
                                        onChange={e => set('notes', e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, flexShrink: 0 }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Create Lead'}
                        </button>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </>
    );
};
