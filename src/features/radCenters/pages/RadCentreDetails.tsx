import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';
import { useAuthStore } from '../../../store/useAuthStore';
import { getRadHospitals, type RadHospitalItem } from '../services/radHospitalsService';
import { whatsappLink } from '../../../utils/whatsapp';
import { radTone, radStatusText, editionOf } from './radFormat';
import '../../dashboard/pages/customers.css';
import '../../dashboard/pages/customer.css';

/**
 * Customers › one 1Rad centre. Built from what the CMS already receives: the
 * centre list (details and active staff) and, for people who handle money,
 * the centre's manual payments through the 1Rad payments proxy.
 */
interface RadPayment {
    requestId: string; hospitalId: string; planName: string; billingCycle: string; status: string; reviewNote: string | null;
    createdAt: string; paymentMode: string; amount: number; modules: string | null; transactionReference: string;
    payerName: string; payerContact: string; paidAt: string; reviewedAt: string | null;
}
type Tab = 'overview' | 'staff' | 'payments';

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const inr = (n?: number | null) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');
/** "Dr. Anil Sharma" -> "Dr. Anil"; "Ravi Kumar" -> "Ravi". */
const shortName = (full: string) => {
    const m = full.trim().match(/^((?:dr|mr|mrs|ms|prof)\.?\s+)?(\S+)/i);
    return m ? `${m[1] || ''}${m[2]}` : full;
};
const payTone = (s: string) => { const v = s.toLowerCase(); return v === 'approved' ? 'ok' : v === 'pending' ? 'warn' : 'bad'; };

const RadCentreDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const canSeeMoney = useAuthStore(s => s.permissions.includes('subscriptions.view'));
    const [centre, setCentre] = useState<RadHospitalItem | null>(null);
    const [payments, setPayments] = useState<RadPayment[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('overview');

    useEffect(() => {
        let alive = true;
        getRadHospitals()
            .then(list => {
                if (!alive) return;
                const c = (list || []).find(x => x.hospitalId === id) || null;
                setCentre(c);
                setError(c ? null : 'This centre was not found on 1Rad.');
            })
            .catch(() => { if (alive) setError('Could not load this centre.'); })
            .finally(() => { if (alive) setLoading(false); });
        if (canSeeMoney) {
            api.get<RadPayment[]>(API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS)
                .then(r => { if (alive) setPayments((Array.isArray(r.data) ? r.data : []).filter(p => p.hospitalId === id)); })
                .catch(() => { if (alive) setPayments(null); });
        }
        return () => { alive = false; };
    }, [id, canSeeMoney]);

    if (loading) {
        return <div className="cx" aria-busy="true"><div className="cx-skel" aria-hidden="true"><span className="h" /><span /></div><p className="cx-loading">Loading centre…</p></div>;
    }
    if (error || !centre) {
        return (
            <div className="cx">
                <Link to="/rad-centers" className="cx-back"><ArrowLeft size={16} /> Customers</Link>
                <div className="cu-error" role="alert">{error || 'Centre not found.'}</div>
            </div>
        );
    }

    const c = centre;
    const sorted = [...(payments || [])].sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());
    const waiting = sorted.find(p => p.status.toLowerCase() === 'pending');
    const lastApproved = sorted.find(p => p.status.toLowerCase() === 'approved');
    // Message the centre's lead person: an admin or owner if marked, else the first staff member with a mobile.
    const lead = c.staff.find(s => /admin|owner|director/i.test(s.designation || '') && s.mobile) || c.staff.find(s => s.mobile) || null;
    const wa = lead ? whatsappLink(lead.mobile, `Hello ${shortName(lead.fullName)}, this is the NexEagle team about ${c.hospitalName}'s 1Rad account. `) : null;

    const TABS: { key: Tab; label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'staff', label: `Staff · ${c.staff.length}` },
        ...(canSeeMoney ? [{ key: 'payments' as Tab, label: `Payments${payments ? ` · ${payments.length}` : ''}` }] : []),
    ];

    return (
        <div className="cx">
            <Link to="/rad-centers" className="cx-back"><ArrowLeft size={16} /> Customers</Link>

            <header className="cx-head">
                <div className="cx-head-main">
                    <div className="cx-title-row">
                        <h1>{c.hospitalName}</h1>
                        <span className="cx-chip p-rad">1Rad</span>
                        <span className={`cu-pill ${radTone(c.subscriptionStatus)}`}>{radStatusText(c.subscriptionStatus)}</span>
                    </div>
                    <p className="cx-meta">
                        <span>{c.hospitalAddress || '—'}</span>
                        <span>Joined {fmtDate(c.createdAt)}</span>
                        <span>{editionOf(c.modules)} · {c.billingCycle}</span>
                    </p>
                </div>
                <div className="cx-actions">
                    {wa && lead && (
                        <a className="cu-btn cx-btn" href={wa} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={16} /> WhatsApp {shortName(lead.fullName)}
                        </a>
                    )}
                    {waiting && <Link className="cu-btn cx-btn cx-primary" to="/approvals?product=1rad">Review waiting payment</Link>}
                </div>
            </header>

            <nav className="ne-tabsbar" aria-label="Centre sections" role="tablist">
                {TABS.map(t => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                        className={`ne-tabsbar-item cx-tab ${tab === t.key ? 'is-on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
                ))}
            </nav>

            {tab === 'overview' && (
                <>
                    <div className="cx-grid3">
                        <section className="cx-card">
                            <h2>Plan</h2>
                            <span className="cx-big">{editionOf(c.modules)}</span>
                            <span className="cx-line">{radStatusText(c.subscriptionStatus)} · billed {c.billingCycle?.toLowerCase() || '—'}</span>
                            {canSeeMoney && <span className="cx-line">{lastApproved ? `Last approved payment ${inr(lastApproved.amount)} · ${fmtDate(lastApproved.reviewedAt || lastApproved.paidAt)}` : 'No approved payment yet'}</span>}
                        </section>
                        <section className="cx-card">
                            <h2>Team</h2>
                            <span className="cx-big">{c.staff.length} active staff</span>
                            <span className="cx-line">{[...new Set(c.staff.map(s => s.designation).filter(Boolean))].slice(0, 3).join(', ') || '—'}</span>
                            <button type="button" className="cx-link" onClick={() => setTab('staff')}>See everyone</button>
                        </section>
                        <section className="cx-card">
                            <h2>Main contact</h2>
                            <span className="cx-big">{lead?.fullName || '—'}</span>
                            <span className="cx-line">{[lead?.designation, lead?.mobile].filter(Boolean).join(' · ') || 'No mobile on record'}</span>
                            {lead?.email && <span className="cx-line">{lead.email}</span>}
                        </section>
                    </div>
                    <section className="cx-card">
                        <h2>Details</h2>
                        <dl className="cx-dl">
                            <dt>Address</dt><dd>{c.hospitalAddress || '—'}</dd>
                            <dt>GSTIN</dt><dd>{c.gstin || '—'}</dd>
                            <dt>Registration no.</dt><dd>{c.registrationNumber || '—'}</dd>
                            <dt>NABH no.</dt><dd>{c.nabhNumber || '—'}</dd>
                            <dt>Account</dt><dd>{c.status}</dd>
                            <dt>Centre ID</dt><dd className="cx-mono">{c.hospitalId}</dd>
                        </dl>
                    </section>
                </>
            )}

            {tab === 'staff' && (
                <section className="cx-card cx-flush">
                    <div className="cu-table-wrap">
                        <table className="cu-table cx-table">
                            <thead><tr><th>Name</th><th>Designation</th><th>Specialisation</th><th>Mobile</th><th>Email</th><th>Status</th></tr></thead>
                            <tbody>
                                {c.staff.map(s => (
                                    <tr key={s.staffId}>
                                        <td className="cx-strong">{s.fullName}</td><td>{s.designation || '—'}</td><td>{s.specialization || '—'}</td>
                                        <td>{s.mobile || '—'}</td><td>{s.email || '—'}</td>
                                        <td><span className={`cu-pill ${/active/i.test(s.status) ? 'ok' : 'muted'}`}>{s.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="cu-cards">
                        {c.staff.map(s => (
                            <div className="cu-mcard" key={`m-${s.staffId}`}>
                                <span className="cu-name">{s.fullName}</span>
                                <span className="cu-sub">{[s.designation, s.specialization].filter(Boolean).join(' · ') || '—'}</span>
                                <span className="cu-sub">{[s.mobile, s.email].filter(Boolean).join(' · ') || '—'}</span>
                            </div>
                        ))}
                    </div>
                    {c.staff.length === 0 && <p className="cu-empty">No active staff on record.</p>}
                </section>
            )}

            {tab === 'payments' && (
                <section className="cx-card cx-flush">
                    {payments === null ? <p className="cu-empty">Could not load payments.</p> : (
                        <>
                            <div className="cu-table-wrap">
                                <table className="cu-table cx-table">
                                    <thead><tr><th>Paid</th><th>Plan</th><th className="num">Amount</th><th>Method</th><th>Reference</th><th>Paid by</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {sorted.map(p => (
                                            <tr key={p.requestId}>
                                                <td>{fmtDate(p.paidAt || p.createdAt)}</td>
                                                <td>{[editionOf(p.modules), p.planName, p.billingCycle].filter(x => x && x !== '—').join(' · ')}</td>
                                                <td className="num">{inr(p.amount)}</td><td>{p.paymentMode || '—'}</td>
                                                <td className="cx-mono">{p.transactionReference || '—'}</td>
                                                <td>{[p.payerName, p.payerContact].filter(Boolean).join(' · ') || '—'}</td>
                                                <td><span className={`cu-pill ${payTone(p.status)}`}>{p.status === 'Pending' ? 'Waiting' : p.status}</span>{p.reviewNote && <span className="cu-sub">{p.reviewNote}</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="cu-cards">
                                {sorted.map(p => (
                                    <div className="cu-mcard" key={`mp-${p.requestId}`}>
                                        <span className="cu-name">{inr(p.amount)} · {p.planName || p.billingCycle}</span>
                                        <span className="cu-sub">{fmtDate(p.paidAt || p.createdAt)} · {p.paymentMode} · {p.transactionReference}</span>
                                        <span><span className={`cu-pill ${payTone(p.status)}`}>{p.status === 'Pending' ? 'Waiting' : p.status}</span></span>
                                    </div>
                                ))}
                            </div>
                            {sorted.length === 0 && <p className="cu-empty">No manual payments from this centre yet.</p>}
                        </>
                    )}
                </section>
            )}
        </div>
    );
};

export default RadCentreDetails;
