import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getRadHospitals, type RadHospitalItem } from '../services/radHospitalsService';

const badge = (text: string, color: string, bg: string): React.ReactNode => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, color, background: bg,
    }}>
        {text}
    </span>
);

const subscriptionBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active') return badge(status, '#16a34a', '#dcfce7');
    if (s === 'expiring') return badge(status, '#d97706', '#fef3c7');
    if (s === 'expired' || s === 'locked') return badge(status, '#dc2626', '#fee2e2');
    return badge(status, '#475569', '#f1f5f9');
};

export const RadCentersPage: React.FC = () => {
    const [centers, setCenters] = useState<RadHospitalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const data = await getRadHospitals();
                setCenters(data);
            } catch {
                toast.error('Could not load 1Rad diagnostic centers.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return centers;
        return centers.filter(c =>
            c.hospitalName.toLowerCase().includes(q) ||
            c.hospitalAddress.toLowerCase().includes(q) ||
            (c.registrationNumber ?? '').toLowerCase().includes(q)
        );
    }, [centers, search]);

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1e293b' }}>1Rad Diagnostic Centers</h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        Every diagnostic center registered on 1Rad, with its active staff roster.
                    </p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 11 }} />
                    <input
                        type="text"
                        placeholder="Search by name, address, registration no."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            height: 38, padding: '0 12px 0 34px', borderRadius: 8, border: '1px solid #cbd5e1',
                            fontSize: 13, fontFamily: 'inherit', color: '#334155', width: 300,
                        }}
                    />
                </div>
            </div>

            <div className="premium-table-card">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                        <Loader2 className="animate-spin" size={22} color="#94a3b8" />
                    </div>
                ) : (
                    <div className="premium-responsive-wrapper">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Center</th>
                                    <th>Address</th>
                                    <th>Subscription</th>
                                    <th>Modules</th>
                                    <th>Staff</th>
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => {
                                    const expanded = expandedId === c.hospitalId;
                                    return (
                                        <React.Fragment key={c.hospitalId}>
                                            <tr className="premium-row" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : c.hospitalId)}>
                                                <td style={{ width: 28 }}>{expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}</td>
                                                <td className="premium-hospital-name">{c.hospitalName}</td>
                                                <td style={{ maxWidth: 260, fontSize: 12 }}>{c.hospitalAddress}</td>
                                                <td>{subscriptionBadge(c.subscriptionStatus)} <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>{c.billingCycle}</span></td>
                                                <td style={{ fontSize: 12, color: '#475569' }}>{c.modules}</td>
                                                <td>{c.staff.length}</td>
                                                <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                            {expanded && (
                                                <tr>
                                                    <td colSpan={7} style={{ background: '#f8fafc', padding: 16 }}>
                                                        {c.staff.length === 0 ? (
                                                            <div style={{ fontSize: 12, color: '#94a3b8' }}>No active staff on record.</div>
                                                        ) : (
                                                            <table className="premium-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Name</th>
                                                                        <th>Designation</th>
                                                                        <th>Specialization</th>
                                                                        <th>Email</th>
                                                                        <th>Mobile</th>
                                                                        <th>Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {c.staff.map(s => (
                                                                        <tr key={s.staffId} className="premium-row">
                                                                            <td>{s.fullName}</td>
                                                                            <td>{s.designation || '—'}</td>
                                                                            <td>{s.specialization || '—'}</td>
                                                                            <td>{s.email || '—'}</td>
                                                                            <td>{s.mobile || '—'}</td>
                                                                            <td>{s.status}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No diagnostic centers found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RadCentersPage;
