import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react';
import { getHospitals, type Hospital } from '../services/hospitalService';
import CustomerTabs from '../../../components/CustomerTabs';
import './customers.css';

/**
 * Customers › Hospitals · 1HMS. Same filters as before (search, onboarding
 * status, plan status, archived) plus quick plan chips; sortable columns; the
 * row opens the hospital. Phones get one card per hospital.
 */
const PLAN_CHIPS: { value: string; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'Active', label: 'Paying' },
    { value: 'Trial', label: 'On trial' },
    { value: 'PendingApproval', label: 'Payment waiting' },
    { value: 'Expired', label: 'Expired' },
    { value: 'Blocked', label: 'Blocked' },
    { value: 'Rejected', label: 'Payment rejected' },
    { value: 'None', label: 'No plan' },
];
const PAGE_SIZE = 25;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const planTone = (s?: string | null) => {
    switch ((s || '').toLowerCase()) {
        case 'active': return 'ok';
        case 'trial': return 'info';
        case 'pendingapproval': case 'pending': return 'warn';
        case 'expired': case 'blocked': case 'rejected': return 'bad';
        default: return 'muted';
    }
};
const planLabel = (s?: string | null) => (s === 'Active' ? 'Paying' : s === 'PendingApproval' ? 'Payment waiting' : s || 'No plan');

const PlanCell: React.FC<{ h: Hospital }> = ({ h }) => {
    const name = h.subscriptionIsEnterprise ? 'Enterprise' : (h.subscriptionPlanName || (h.subscriptionStatus ? 'No plan picked' : '—'));
    const trial = h.subscriptionStatus === 'Trial';
    const used = h.freeTierUsedCount, limit = h.freeTierLimit;
    const over = trial && used != null && limit != null && used >= limit;
    const days = h.subscriptionStatus === 'Active' ? h.subscriptionDaysRemaining : null;
    return (
        <span className="cu-plan">
            <span className="cu-plan-name">{name}</span>
            <span className="cu-plan-meta">
                <span className={`cu-pill ${planTone(h.subscriptionStatus)}`}>{planLabel(h.subscriptionStatus)}</span>
                {over && <span className="cu-flag bad">Free limit reached</span>}
                {trial && !over && used != null && limit != null && <span className="cu-flag">{used}/{limit} used</span>}
                {days != null && <span className={`cu-flag ${days <= 7 ? 'warn' : ''}`}>{days <= 0 ? 'ends today' : days === 1 ? '1 day left' : `${days} days left`}</span>}
            </span>
        </span>
    );
};

type SortState = { key: string; direction: 'asc' | 'desc' };
const SortHead: React.FC<{ k: string; sort: SortState; onSort: (k: string) => void; children: React.ReactNode; className?: string }> = ({ k, sort, onSort, children, className }) => (
    <th scope="col" className={className} aria-sort={sort.key === k ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="cu-sort" onClick={() => onSort(k)}>
            {children}
            {sort.key !== k ? <ChevronsUpDown size={14} className="cu-sort-idle" /> : sort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
    </th>
);

const OnboardedHospitals: React.FC = () => {
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortState>({ key: 'registeredon', direction: 'desc' });
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [version, setVersion] = useState(0);

    // Debounce the search box so we're not firing a request per keystroke.
    useEffect(() => {
        const handle = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    useEffect(() => {
        let alive = true;
        getHospitals(page, PAGE_SIZE, search, sort.key, sort.direction, statusFilter, planFilter, includeArchived)
            .then(r => {
                if (!alive) return;
                setHospitals(r.data);
                setTotalPages(r.pagination.totalPages);
                setTotalItems(r.pagination.totalItems);
                setError(null);
            })
            .catch(() => { if (alive) setError('Could not load hospitals.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [page, search, sort, statusFilter, planFilter, includeArchived, version]);

    const change = (fn: () => void) => { setLoading(true); fn(); setPage(1); };
    const sortBy = (key: string) => change(() => setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })));

    const from = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, totalItems);

    return (
        <div className="cu">
            <header className="ne-page-head">
                <div>
                    <h1>Customers</h1>
                    <p>Every 1HMS hospital, its plan and how much it is used.</p>
                </div>
            </header>
            <CustomerTabs />

            <div className="cu-bar">
                <label className="cu-search">
                    <Search size={16} aria-hidden="true" />
                    <input value={searchInput} onChange={e => { setLoading(true); setSearchInput(e.target.value); }} placeholder="Name, town, mobile or email" aria-label="Search hospitals" />
                </label>
                <select className="cu-select" value={statusFilter} onChange={e => change(() => setStatusFilter(e.target.value))} aria-label="Onboarding status">
                    <option value="">Any onboarding status</option>
                    <option value="Active">Onboarded</option>
                    <option value="Pending">Onboarding pending</option>
                </select>
                <label className="cu-check">
                    <input type="checkbox" checked={includeArchived} onChange={e => change(() => setIncludeArchived(e.target.checked))} />
                    Show archived
                </label>
            </div>
            <div className="cu-chips" role="radiogroup" aria-label="Plan">
                {PLAN_CHIPS.map(c => (
                    <button key={c.value || 'all'} type="button" role="radio" aria-checked={planFilter === c.value}
                        className={`cu-chip ${planFilter === c.value ? 'is-on' : ''}`} onClick={() => change(() => setPlanFilter(c.value))}>
                        {c.label}
                    </button>
                ))}
            </div>

            {error && <div className="cu-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setVersion(v => v + 1); }}>Try again</button></div>}

            <div className="cu-card">
                <div className="cu-table-wrap">
                    <table className="cu-table">
                        <thead>
                            <tr>
                                <SortHead sort={sort} onSort={sortBy} k="name">Hospital</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="subscriptionstatus">Plan</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="totalpatients" className="num">Patients</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="totaldoctors" className="num">Doctors</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="totalnondoctorusers" className="num">Other staff</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="contactnumber">Contact</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="registeredon">Joined</SortHead>
                                <SortHead sort={sort} onSort={sortBy} k="status">Onboarding</SortHead>
                                <th scope="col" aria-label="Open"></th>
                            </tr>
                        </thead>
                        <tbody className={loading ? 'is-loading' : ''}>
                            {hospitals.map(h => (
                                <tr key={h.id} className={h.isArchived ? 'is-archived' : ''} onClick={() => navigate(`/hospital/${h.id}`)}>
                                    <td>
                                        <Link to={`/hospital/${h.id}`} className="cu-name" onClick={e => e.stopPropagation()}>{h.name}</Link>
                                        <span className="cu-sub">{[h.city, h.state].filter(Boolean).join(', ') || '—'}{h.isArchived ? ' · archived' : ''}</span>
                                    </td>
                                    <td><PlanCell h={h} /></td>
                                    <td className="num">{(h.totalPatients ?? 0).toLocaleString('en-IN')}</td>
                                    <td className="num">{h.totalDoctors ?? 0}</td>
                                    <td className="num">{h.totalNonDoctorUsers ?? 0}</td>
                                    <td><span className="cu-contact">{h.contactNumber || '—'}</span><span className="cu-sub">{h.email || ''}</span></td>
                                    <td className="cu-muted">{h.registeredOn ? fmtDate(h.registeredOn) : '—'}</td>
                                    <td><span className={`cu-pill ${h.status === 'Active' ? 'ok' : 'warn'}`}>{h.status === 'Active' ? 'Onboarded' : h.status || '—'}</span></td>
                                    <td className="cu-go"><ChevronRight size={16} aria-hidden="true" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="cu-cards">
                    {hospitals.map(h => (
                        <Link key={h.id} to={`/hospital/${h.id}`} className={`cu-mcard ${h.isArchived ? 'is-archived' : ''}`}>
                            <span className="cu-mcard-top">
                                <span className="cu-name">{h.name}</span>
                                <ChevronRight size={16} aria-hidden="true" />
                            </span>
                            <span className="cu-sub">{[h.city, h.state].filter(Boolean).join(', ')}{h.isArchived ? ' · archived' : ''}</span>
                            <PlanCell h={h} />
                            <span className="cu-mcard-stats">
                                <span><strong>{(h.totalPatients ?? 0).toLocaleString('en-IN')}</strong> patients</span>
                                <span><strong>{h.totalDoctors ?? 0}</strong> doctors</span>
                                <span><strong>{h.totalNonDoctorUsers ?? 0}</strong> staff</span>
                            </span>
                        </Link>
                    ))}
                </div>

                {!loading && hospitals.length === 0 && !error && (
                    <p className="cu-empty">No hospitals match. Try another plan chip or clear the search.</p>
                )}

                <div className="cu-foot">
                    <span>{totalItems ? `${from}–${to} of ${totalItems.toLocaleString('en-IN')}` : ''}</span>
                    <span className="cu-pager">
                        <button type="button" className="cu-btn" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(p => p - 1); }}>Previous</button>
                        <span className="cu-muted">Page {page} of {Math.max(1, totalPages)}</span>
                        <button type="button" className="cu-btn" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage(p => p + 1); }}>Next</button>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OnboardedHospitals;
