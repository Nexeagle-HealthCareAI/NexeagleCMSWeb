import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ArchiveRestore, Archive as ArchiveIcon, MessageCircle, MapPin, ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { getHospitalById, getHospitalAppointmentStats, archiveHospital, restoreHospital, type Hospital, type HospitalAppointmentSourceStats } from '../services/hospitalService';
import HospitalLocationMap from '../components/HospitalLocationMap';
import { whatsappLink, renewalText } from '../../../utils/whatsapp';
import './customers.css';
import './customer.css';

/**
 * Customers › one 1HMS hospital. Plan, use and contact first; staff and
 * doctors, plan and payments, activity charts and the map behind tabs.
 * Everything the old page showed is still here.
 */
type Tab = 'overview' | 'people' | 'plan' | 'activity' | 'location';
type DateFilterMode = 'today' | 'all' | 'custom';
type Range = 'daily' | 'weekly' | 'monthly' | 'yearly';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
const inr = (n?: number | null) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');
const tone = (s?: string | null) => {
    switch ((s || '').toLowerCase()) {
        case 'active': case 'approved': return 'ok';
        case 'trial': return 'info';
        case 'pending': case 'pendingapproval': return 'warn';
        case 'expired': case 'blocked': case 'rejected': return 'bad';
        default: return 'muted';
    }
};
const statusText = (s?: string | null) => s === 'Active' ? 'Paying' : s === 'PendingApproval' ? 'Payment waiting' : s || 'No plan';

const HospitalDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('overview');
    const [range, setRange] = useState<Range>('monthly');

    const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [apptStats, setApptStats] = useState<HospitalAppointmentSourceStats | null>(null);
    const [apptStatsLoading, setApptStatsLoading] = useState(true);

    const canManageHospitals = useAuthStore((s) => s.hasAccess('hospitals.manage'));
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [archiveConfirmText, setArchiveConfirmText] = useState('');
    const [isArchiving, setIsArchiving] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    React.useEffect(() => {
        if (!id) return;
        let alive = true;
        getHospitalById(id)
            .then(d => { if (alive) setHospital(d); })
            .catch(() => { if (alive) setError('Failed to fetch hospital details'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [id]);

    React.useEffect(() => {
        if (!id) return;
        // Custom range: wait until both bounds are picked rather than firing on every half-typed date.
        if (dateFilterMode === 'custom' && (!customFrom || !customTo)) return;
        const today = toDateInputValue(new Date());
        const from = dateFilterMode === 'today' ? today : dateFilterMode === 'custom' ? customFrom : undefined;
        const to = dateFilterMode === 'today' ? today : dateFilterMode === 'custom' ? customTo : undefined;
        let cancelled = false;
        getHospitalAppointmentStats(id, from, to)
            .then(stats => { if (!cancelled) setApptStats(stats); })
            .catch(() => { if (!cancelled) setApptStats(null); })
            .finally(() => { if (!cancelled) setApptStatsLoading(false); });
        return () => { cancelled = true; };
    }, [id, dateFilterMode, customFrom, customTo]);

    const pickDateMode = (m: DateFilterMode) => { setApptStatsLoading(true); setDateFilterMode(m); };

    const handleArchive = async () => {
        if (!hospital || archiveConfirmText !== hospital.name) return;
        setIsArchiving(true);
        try {
            await archiveHospital(hospital.id);
            toast.success('Hospital archived');
            setHospital(prev => prev ? { ...prev, isArchived: true, archivedAt: new Date().toISOString() } : prev);
            setShowArchiveModal(false);
            setArchiveConfirmText('');
        } catch {
            toast.error('Failed to archive hospital');
        } finally {
            setIsArchiving(false);
        }
    };

    const handleRestore = async () => {
        if (!hospital) return;
        setIsRestoring(true);
        try {
            await restoreHospital(hospital.id);
            toast.success('Hospital restored');
            setHospital(prev => prev ? { ...prev, isArchived: false, archivedAt: null } : prev);
        } catch {
            toast.error('Failed to restore hospital');
        } finally {
            setIsRestoring(false);
        }
    };

    if (loading) {
        return (
            <div className="cx" aria-busy="true">
                <div className="cx-skel" aria-hidden="true"><span className="h" /><span /><span /></div>
                <p className="cx-loading">Loading hospital…</p>
            </div>
        );
    }
    if (error || !hospital) {
        return (
            <div className="cx">
                <Link to="/onboarded-hospitals" className="cx-back"><ArrowLeft size={16} /> Customers</Link>
                <div className="cu-error" role="alert">{error || 'Hospital not found'}</div>
            </div>
        );
    }

    const h = hospital;
    const plan = h.subscriptionIsEnterprise ? 'Enterprise' : (h.subscriptionPlanName || (h.subscriptionStatus ? 'No plan picked' : 'No plan'));
    const days = h.subscriptionStatus === 'Active' ? h.subscriptionDaysRemaining : null;
    const place = `${h.city}, ${h.state}`;
    const people = (h.users?.length || 0);
    const doctors = h.doctors?.length ?? h.totalDoctors ?? 0;
    const payments = h.paymentHistory || [];
    const waiting = payments.find(p => p.status === 'PendingApproval');
    const remind = whatsappLink(h.contactNumber, renewalText(h.name, h.subscriptionPlanName, days));
    const hasLocation = h.latitude != null && h.longitude != null;

    const TABS: { key: Tab; label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'people', label: `Staff & doctors · ${people + (h.doctors?.length || 0)}` },
        { key: 'plan', label: 'Plan & payments' },
        { key: 'activity', label: 'Activity' },
        { key: 'location', label: 'Location' },
    ];

    return (
        <div className="cx">
            <Link to="/onboarded-hospitals" className="cx-back"><ArrowLeft size={16} /> Customers</Link>

            {h.isArchived && (
                <div className="cx-banner" role="status">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>Archived{h.archivedAt ? ` on ${fmtDate(h.archivedAt)}` : ''}. Staff cannot sign in and the hospital is hidden from patients.</span>
                    {canManageHospitals && (
                        <button type="button" className="cu-btn" onClick={handleRestore} disabled={isRestoring}>
                            <ArchiveRestore size={16} /> {isRestoring ? 'Restoring…' : 'Restore'}
                        </button>
                    )}
                </div>
            )}

            <header className="cx-head">
                <div className="cx-head-main">
                    <div className="cx-title-row">
                        <h1>{h.name}</h1>
                        <span className="cx-chip p-hms">1HMS</span>
                        <span className={`cu-pill ${tone(h.subscriptionStatus)}`}>{statusText(h.subscriptionStatus)}</span>
                        {days != null && days <= 7 && <span className="cu-pill warn">{days <= 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`}</span>}
                    </div>
                    <p className="cx-meta">
                        <span>{place}</span>
                        <span>Joined {fmtDate(h.registeredOn)}</span>
                        {h.partnerName && <span>Brought by {h.partnerName}</span>}
                        <span className={`cu-pill ${h.status === 'Active' ? 'ok' : 'warn'}`}>{h.status === 'Active' ? 'Onboarded' : h.status}</span>
                    </p>
                </div>
                <div className="cx-actions">
                    {remind && (
                        <a className="cu-btn cx-btn" href={remind} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={16} /> {days != null && days <= 14 ? 'Remind on WhatsApp' : 'WhatsApp'}
                        </a>
                    )}
                    {waiting && <Link className="cu-btn cx-btn cx-primary" to="/approvals?product=1hms">Review waiting payment</Link>}
                    {canManageHospitals && !h.isArchived && (
                        <button type="button" className="cu-btn cx-btn cx-danger-text" onClick={() => setShowArchiveModal(true)}>
                            <ArchiveIcon size={16} /> Archive
                        </button>
                    )}
                </div>
            </header>

            <nav className="ne-tabsbar" aria-label="Hospital sections" role="tablist">
                {TABS.map(t => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                        className={`ne-tabsbar-item cx-tab ${tab === t.key ? 'is-on' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </nav>

            {tab === 'overview' && (
                <>
                    <div className="cx-grid3">
                        <section className="cx-card">
                            <h2>Plan</h2>
                            <span className="cx-big">{plan}</span>
                            {h.subscriptionStatus === 'Trial' ? (
                                <span className="cx-line">Free tier this month: {h.freeTierUsedCount != null && h.freeTierLimit != null
                                    ? `${h.freeTierUsedCount} of ${h.freeTierLimit}${h.freeTierUsedCount >= h.freeTierLimit ? ' — limit reached' : ''}` : '—'}</span>
                            ) : (
                                <span className="cx-line">{h.subscriptionEndDate ? `Ends ${fmtDate(h.subscriptionEndDate)}` : days != null ? `${days} days left` : 'No end date'}</span>
                            )}
                            <span className="cx-line">{payments[0] ? `Last payment ${inr(payments[0].amount)} · ${fmtDate(payments[0].submittedAt)}` : 'No payments yet'}</span>
                        </section>
                        <section className="cx-card">
                            <div className="cx-card-head">
                                <h2>Appointments</h2>
                                <select className="cx-mini-select" value={dateFilterMode} onChange={e => pickDateMode(e.target.value as DateFilterMode)} aria-label="Appointments for">
                                    <option value="all">All time</option>
                                    <option value="today">Today</option>
                                    <option value="custom">Dates…</option>
                                </select>
                            </div>
                            <span className="cx-big">{apptStatsLoading ? '…' : (apptStats?.totalAppointments ?? '—').toLocaleString('en-IN')}</span>
                            <span className="cx-line">{apptStatsLoading ? '' : `${apptStats?.onlineAppointments ?? '—'} booked online · ${apptStats?.hospitalAppointments ?? '—'} at the hospital`}</span>
                            {dateFilterMode === 'custom' && (
                                <span className="cx-dates">
                                    <input type="date" value={customFrom} onChange={e => { setApptStatsLoading(true); setCustomFrom(e.target.value); }} aria-label="From" />
                                    <span>to</span>
                                    <input type="date" value={customTo} onChange={e => { setApptStatsLoading(true); setCustomTo(e.target.value); }} aria-label="To" />
                                </span>
                            )}
                        </section>
                        <section className="cx-card">
                            <h2>Team</h2>
                            <span className="cx-big">{doctors} {doctors === 1 ? 'doctor' : 'doctors'}</span>
                            <span className="cx-line">{h.totalNonDoctorUsers ?? 0} other staff · {(h.totalPatients ?? 0).toLocaleString('en-IN')} patients</span>
                            <button type="button" className="cx-link" onClick={() => setTab('people')}>See everyone</button>
                        </section>
                    </div>

                    <section className="cx-card">
                        <h2>Details</h2>
                        <dl className="cx-dl">
                            <dt>Address</dt><dd>{[h.address, h.city, h.state].filter(Boolean).join(', ') || '—'}</dd>
                            <dt>Phone</dt><dd>{h.contactNumber || '—'}</dd>
                            <dt>Email</dt><dd>{h.email || '—'}</dd>
                            <dt>Type</dt><dd>{h.hospitalType || '—'}</dd>
                            <dt>Partner</dt><dd>{h.partnerName || '—'}</dd>
                            <dt>Hospital ID</dt><dd className="cx-mono">{h.id}</dd>
                        </dl>
                    </section>
                </>
            )}

            {tab === 'people' && (
                <>
                    <section className="cx-card cx-flush">
                        <div className="cx-card-head cx-pad"><h2>Staff · {people}</h2></div>
                        <div className="cu-table-wrap">
                            <table className="cu-table cx-table">
                                <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Last sign-in</th><th>How</th><th>Status</th></tr></thead>
                                <tbody>
                                    {(h.users || []).map((u, i) => (
                                        <tr key={`${u.email}-${i}`}>
                                            <td className="cx-strong">{u.name}</td><td>{u.role}</td><td>{u.contact || '—'}</td><td>{u.email || '—'}</td>
                                            <td>{fmtDateTime(u.lastLoginTime)}</td><td>{u.loginMethod || '—'}</td>
                                            <td><span className={`cu-pill ${u.status === 'Active' ? 'ok' : 'muted'}`}>{u.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="cu-cards">
                            {(h.users || []).map((u, i) => (
                                <div className="cu-mcard" key={`m-${u.email}-${i}`}>
                                    <span className="cu-name">{u.name}</span>
                                    <span className="cu-sub">{u.role} · {u.contact || u.email || '—'}</span>
                                    <span className="cu-sub">Last sign-in {fmtDateTime(u.lastLoginTime)}{u.loginMethod ? ` · ${u.loginMethod}` : ''}</span>
                                </div>
                            ))}
                        </div>
                        {people === 0 && <p className="cu-empty">No staff yet.</p>}
                    </section>

                    <section className="cx-card cx-flush">
                        <div className="cx-card-head cx-pad"><h2>Doctors · {h.doctors?.length || 0}</h2></div>
                        <div className="cu-table-wrap">
                            <table className="cu-table cx-table">
                                <thead><tr><th>Doctor</th><th>Degree</th><th>Departments</th><th>Reg. no.</th><th className="num">Appointments (day · week · month · year)</th><th className="num">Patients (day · week · month · year)</th></tr></thead>
                                <tbody>
                                    {(h.doctors || []).map((d, i) => (
                                        <tr key={d.id || i}>
                                            <td><span className="cx-strong">{d.name}</span><span className="cu-sub">{d.speciality}</span></td>
                                            <td>{d.degree || '—'}</td><td>{(d.departments || []).join(', ') || '—'}</td><td className="cx-mono">{d.registrationNumber || '—'}</td>
                                            <td className="num">{d.appointments ? `${d.appointments.daily} · ${d.appointments.weekly} · ${d.appointments.monthly} · ${d.appointments.yearly}` : '—'}</td>
                                            <td className="num">{d.uniquePatients ? `${d.uniquePatients.daily} · ${d.uniquePatients.weekly} · ${d.uniquePatients.monthly} · ${d.uniquePatients.yearly}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="cu-cards">
                            {(h.doctors || []).map((d, i) => (
                                <div className="cu-mcard" key={`md-${d.id || i}`}>
                                    <span className="cu-name">{d.name}</span>
                                    <span className="cu-sub">{[d.degree, (d.departments || []).join(', ')].filter(Boolean).join(' · ')}</span>
                                    <span className="cu-sub">This month: {d.appointments?.monthly ?? 0} appointments · {d.uniquePatients?.monthly ?? 0} patients</span>
                                </div>
                            ))}
                        </div>
                        {!h.doctors?.length && <p className="cu-empty">No doctors yet.</p>}
                    </section>
                </>
            )}

            {tab === 'plan' && (
                <>
                    <section className="cx-card">
                        <h2>Current plan</h2>
                        <dl className="cx-dl">
                            <dt>Plan</dt><dd>{plan}</dd>
                            <dt>Status</dt><dd><span className={`cu-pill ${tone(h.subscriptionStatus)}`}>{statusText(h.subscriptionStatus)}</span></dd>
                            {h.subscriptionStatus === 'Trial' ? (
                                <><dt>Free tier this month</dt><dd>{h.freeTierUsedCount != null && h.freeTierLimit != null ? `${h.freeTierUsedCount} of ${h.freeTierLimit}` : '—'}</dd></>
                            ) : (
                                <>
                                    <dt>Started</dt><dd>{fmtDate(h.subscriptionStartDate)}</dd>
                                    <dt>Ends</dt><dd>{fmtDate(h.subscriptionEndDate)}{days != null ? ` · ${days} days left` : ''}</dd>
                                </>
                            )}
                        </dl>
                    </section>
                    <section className="cx-card cx-flush">
                        <div className="cx-card-head cx-pad"><h2>Payments · {payments.length}</h2></div>
                        <div className="cu-table-wrap">
                            <table className="cu-table cx-table">
                                <thead><tr><th>Sent</th><th>Plan</th><th className="num">Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Decided</th></tr></thead>
                                <tbody>
                                    {payments.map((p, i) => (
                                        <tr key={`${p.reference}-${i}`}>
                                            <td>{fmtDate(p.submittedAt)}</td><td>{p.planName}</td><td className="num">{inr(p.amount)}</td><td>{p.paymentMode || '—'}</td>
                                            <td className="cx-mono">{p.reference || '—'}</td>
                                            <td><span className={`cu-pill ${tone(p.status)}`}>{p.status === 'PendingApproval' ? 'Waiting' : p.status}</span>{p.rejectionReason && <span className="cu-sub">{p.rejectionReason}</span>}</td>
                                            <td>{fmtDate(p.reviewedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="cu-cards">
                            {payments.map((p, i) => (
                                <div className="cu-mcard" key={`mp-${p.reference}-${i}`}>
                                    <span className="cu-name">{inr(p.amount)} · {p.planName}</span>
                                    <span className="cu-sub">{fmtDate(p.submittedAt)} · {p.paymentMode || '—'} · {p.reference || '—'}</span>
                                    <span><span className={`cu-pill ${tone(p.status)}`}>{p.status === 'PendingApproval' ? 'Waiting' : p.status}</span></span>
                                </div>
                            ))}
                        </div>
                        {payments.length === 0 && <p className="cu-empty">No payments yet.</p>}
                    </section>
                </>
            )}

            {tab === 'activity' && (
                h.stats ? (
                    <>
                        <div className="ne-seg" role="radiogroup" aria-label="Period">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as Range[]).map(r => (
                                <button key={r} type="button" role="radio" aria-checked={range === r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
                                    {r === 'daily' ? 'By day' : r === 'weekly' ? 'By week' : r === 'monthly' ? 'By month' : 'By year'}
                                </button>
                            ))}
                        </div>
                        <div className="cx-grid2">
                            {([['Different patients', h.stats.uniquePatients[range], '#4F46E5'], ['Appointments', h.stats.appointments[range], '#079455']] as const).map(([title, data, color]) => (
                                <section className="cx-card" key={title}>
                                    <h2>{title}</h2>
                                    <div className="cx-chart">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={data as { label: string; value: number }[]} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                                <CartesianGrid stroke="#EAECF0" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#667085' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 12, fill: '#667085' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </section>
                            ))}
                        </div>
                    </>
                ) : <p className="cu-empty">No activity data for this hospital yet.</p>
            )}

            {tab === 'location' && (
                <section className="cx-card">
                    <h2>Location</h2>
                    {hasLocation ? (
                        <>
                            <HospitalLocationMap latitude={h.latitude as number} longitude={h.longitude as number} label={h.name} />
                            <a className="cx-link" href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`} target="_blank" rel="noopener noreferrer">
                                <MapPin size={15} /> Open in Google Maps <ExternalLink size={13} />
                            </a>
                        </>
                    ) : <p className="cx-line">The hospital has not set its map pin yet (1HMS › branding settings).</p>}
                </section>
            )}

            {showArchiveModal && (
                <div className="cx-modal-back" onClick={() => setShowArchiveModal(false)}>
                    <div className="cx-modal" role="dialog" aria-modal="true" aria-labelledby="cx-arch" onClick={e => e.stopPropagation()}>
                        <h2 id="cx-arch">Archive {h.name}?</h2>
                        <p>This hides <strong>{h.name}</strong> and all its data — staff access, patient records and appointments. You can restore it later.</p>
                        <label htmlFor="cx-arch-name">Type <strong>{h.name}</strong> to confirm</label>
                        <input id="cx-arch-name" value={archiveConfirmText} onChange={e => setArchiveConfirmText(e.target.value)} placeholder={h.name} autoFocus />
                        <div className="cx-modal-actions">
                            <button type="button" className="cu-btn" onClick={() => { setShowArchiveModal(false); setArchiveConfirmText(''); }}>Cancel</button>
                            <button type="button" className="cu-btn cx-danger" disabled={archiveConfirmText !== h.name || isArchiving} onClick={handleArchive}>
                                {isArchiving ? 'Archiving…' : 'Archive hospital'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalDetails;
