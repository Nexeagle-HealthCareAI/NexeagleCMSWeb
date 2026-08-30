import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Plus, Filter, LayoutGrid, List, AlertCircle, Building2, User, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { salesLeadService, SalesLeadSummary, SalesLeadFilter, LeadStage, LeadPriority } from '../../marketing/services/salesLeadService';
import { adminService, UserSummary } from '../../admin/services/adminService';
import { AddLeadDrawer } from './AddLeadDrawer';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { formatDateTimeIST } from '../utils/formatters';

const STAGES: LeadStage[] = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Closed Won', 'Closed Lost'];
const PRIORITIES: LeadPriority[] = ['High', 'Medium', 'Low'];

const STAGE_COLORS: Record<LeadStage, { bg: string; text: string }> = {
    'New':            { bg: '#e0f2fe', text: '#0369a1' },
    'Contacted':      { bg: '#fef9c3', text: '#92400e' },
    'Demo Scheduled': { bg: '#ddd6fe', text: '#5b21b6' },
    'Demo Done':      { bg: '#cffafe', text: '#0e7490' },
    'Negotiation':    { bg: '#fde68a', text: '#78350f' },
    'Closed Won':     { bg: '#d1fae5', text: '#065f46' },
    'Closed Lost':    { bg: '#fee2e2', text: '#991b1b' },
};

const PRIORITY_COLORS: Record<LeadPriority, { bg: string; text: string; border: string }> = {
    High:   { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
    Medium: { bg: '#fefce8', text: '#a16207', border: '#fde047' },
    Low:    { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
};

export const LeadsPipeline: React.FC = () => {
    // State
    const [leads, setLeads] = useState<SalesLeadSummary[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<UserSummary[]>([]);

    // Filters
    const [stage, setStage] = useState<LeadStage | ''>('');
    const [priority, setPriority] = useState<LeadPriority | ''>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 15;

    // Drawers
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    // Initial load for users
    useEffect(() => {
        adminService.getUsers(1, 100)
            .then(res => setUsers(res.users))
            .catch(console.error);
    }, []);

    // Load leads
    const loadLeads = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const filter: SalesLeadFilter = { page: p, limit };
            if (stage) filter.stage = stage;
            if (priority) filter.priority = priority;
            if (search.trim()) filter.search = search.trim();
            const res = await salesLeadService.getLeads(filter);
            setLeads(res.data);
            setTotalItems(res.totalItems);
            setPage(p);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load leads pipeline.');
        } finally {
            setLoading(false);
        }
    }, [stage, priority, search, page]);

    useEffect(() => {
        // debounce search
        const timer = setTimeout(() => {
            loadLeads(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, stage, priority]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header & Filters */}
            <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                        <input
                            style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, minWidth: 200, outline: 'none' }}
                            placeholder="Search hospital or contact..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {/* Stage Filter */}
                    <select
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', color: stage ? '#0f172a' : '#94a3b8', outline: 'none', cursor: 'pointer' }}
                        value={stage}
                        onChange={e => setStage(e.target.value as LeadStage | '')}
                    >
                        <option value="">All Stages</option>
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {/* Priority Filter */}
                    <select
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', color: priority ? '#0f172a' : '#94a3b8', outline: 'none', cursor: 'pointer' }}
                        value={priority}
                        onChange={e => setPriority(e.target.value as LeadPriority | '')}
                    >
                        <option value="">All Priorities</option>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    {(search || stage || priority) && (
                        <button
                            onClick={() => { setSearch(''); setStage(''); setPriority(''); }}
                            style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsAddOpen(true)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)' }}
                >
                    <Plus size={16} /> Add Lead
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                        <tr>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hospital</th>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</th>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage</th>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</th>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owner</th>
                            <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Follow-ups</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && leads.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading pipeline...</td></tr>
                        ) : leads.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No leads found. Create one or change filters.</td></tr>
                        ) : (
                            leads.map((l) => (
                                <tr
                                    key={l.leadId}
                                    onClick={() => setSelectedLeadId(l.leadId)}
                                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                                                <Building2 size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{l.hospitalName}</div>
                                                {(l.city || l.state) && (
                                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{[l.city, l.state].filter(Boolean).join(', ')}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {l.contactName ? (
                                            <div>
                                                <div style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{l.contactName}</div>
                                                {l.mobile && <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.mobile}</div>}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: STAGE_COLORS[l.stage].bg, color: STAGE_COLORS[l.stage].text }}>
                                            {l.stage}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: PRIORITY_COLORS[l.priority].bg, color: PRIORITY_COLORS[l.priority].text, border: `1px solid ${PRIORITY_COLORS[l.priority].border}` }}>
                                            {l.priority}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {l.assignedToName ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                                                <User size={14} color="#94a3b8" /> {l.assignedToName}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{l.followUpCount}</div>
                                        {l.lastFollowUpAt && <div style={{ fontSize: 11, color: '#94a3b8' }}>Last: {formatDateTimeIST(l.lastFollowUpAt).split(',')[0]}</div>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {loading && leads.length > 0 && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ padding: '12px 24px', background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                            Updating...
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 0', marginTop: 'auto' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                        Showing <strong>{((page - 1) * limit) + 1}</strong> to <strong>{Math.min(page * limit, totalItems)}</strong> of <strong>{totalItems}</strong> leads
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => loadLeads(page - 1)}
                            disabled={page === 1 || loading}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: (page === 1 || loading) ? 'not-allowed' : 'pointer', opacity: (page === 1 || loading) ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => loadLeads(page + 1)}
                            disabled={page >= totalPages || loading}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: (page >= totalPages || loading) ? 'not-allowed' : 'pointer', opacity: (page >= totalPages || loading) ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            <AddLeadDrawer
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                users={users}
                onCreated={() => loadLeads(1)}
            />

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
