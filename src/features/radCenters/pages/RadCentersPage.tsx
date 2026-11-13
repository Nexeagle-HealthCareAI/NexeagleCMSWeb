import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { getRadHospitals, type RadHospitalItem } from '../services/radHospitalsService';
import CustomerTabs from '../../../components/CustomerTabs';
import { radTone, radStatusText, editionOf } from './radFormat';
import '../../dashboard/pages/customers.css';

/**
 * Customers › Diagnostic centres · 1Rad. Same list look as 1HMS hospitals:
 * plan chips, search, one row per centre opening its own page.
 */
const RadCentersPage: React.FC = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [centres, setCentres] = useState<RadHospitalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    // ?q= pre-fills the search (Ctrl K search opens a centre this way).
    const [search, setSearch] = useState(() => params.get('q') || '');
    const [chip, setChip] = useState('');

    useEffect(() => {
        let alive = true;
        getRadHospitals()
            .then(list => { if (alive) { setCentres(list || []); setError(null); } })
            .catch(() => { if (alive) setError('Could not load 1Rad centres.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [version]);

    const statuses = useMemo(() => {
        const m = new Map<string, number>();
        centres.forEach(c => m.set(c.subscriptionStatus || 'None', (m.get(c.subscriptionStatus || 'None') || 0) + 1));
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [centres]);

    const list = useMemo(() => {
        const q = search.trim().toLowerCase();
        return centres
            .filter(c => !chip || (c.subscriptionStatus || 'None') === chip)
            .filter(c => !q || [c.hospitalName, c.hospitalAddress, c.registrationNumber, c.gstin, c.nabhNumber].some(v => (v || '').toLowerCase().includes(q)))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [centres, search, chip]);

    return (
        <div className="cu">
            <header className="ne-page-head">
                <div>
                    <h1>Customers</h1>
                    <p>Every diagnostic centre on 1Rad, its plan and its team.</p>
                </div>
            </header>
            <CustomerTabs />

            <div className="cu-bar">
                <label className="cu-search">
                    <Search size={16} aria-hidden="true" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, address, GSTIN or registration number" aria-label="Search centres" />
                </label>
            </div>
            {statuses.length > 1 && (
                <div className="cu-chips" role="radiogroup" aria-label="Plan">
                    <button type="button" role="radio" aria-checked={chip === ''} className={`cu-chip ${chip === '' ? 'is-on' : ''}`} onClick={() => setChip('')}>All · {centres.length}</button>
                    {statuses.map(([s, n]) => (
                        <button key={s} type="button" role="radio" aria-checked={chip === s} className={`cu-chip ${chip === s ? 'is-on' : ''}`} onClick={() => setChip(s)}>
                            {radStatusText(s)} · {n}
                        </button>
                    ))}
                </div>
            )}

            {error && <div className="cu-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setVersion(v => v + 1); }}>Try again</button></div>}

            <div className="cu-card">
                <div className="cu-table-wrap">
                    <table className="cu-table">
                        <thead>
                            <tr>
                                <th scope="col"><span className="cu-sort">Centre</span></th>
                                <th scope="col"><span className="cu-sort">Plan</span></th>
                                <th scope="col"><span className="cu-sort">Modules</span></th>
                                <th scope="col" className="num"><span className="cu-sort">Staff</span></th>
                                <th scope="col"><span className="cu-sort">Joined</span></th>
                                <th scope="col" aria-label="Open"></th>
                            </tr>
                        </thead>
                        <tbody className={loading ? 'is-loading' : ''}>
                            {list.map(c => (
                                <tr key={c.hospitalId} onClick={() => navigate(`/rad-centers/${c.hospitalId}`)}>
                                    <td>
                                        <Link to={`/rad-centers/${c.hospitalId}`} className="cu-name" onClick={e => e.stopPropagation()}>{c.hospitalName}</Link>
                                        <span className="cu-sub">{c.hospitalAddress || '—'}</span>
                                    </td>
                                    <td>
                                        <span className="cu-plan">
                                            <span className="cu-plan-name">{c.billingCycle || '—'}</span>
                                            <span className="cu-plan-meta"><span className={`cu-pill ${radTone(c.subscriptionStatus)}`}>{radStatusText(c.subscriptionStatus)}</span></span>
                                        </span>
                                    </td>
                                    <td>{editionOf(c.modules)}</td>
                                    <td className="num">{c.staff.length}</td>
                                    <td className="cu-muted">{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                    <td className="cu-go"><ChevronRight size={16} aria-hidden="true" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="cu-cards">
                    {list.map(c => (
                        <Link key={c.hospitalId} to={`/rad-centers/${c.hospitalId}`} className="cu-mcard">
                            <span className="cu-mcard-top"><span className="cu-name">{c.hospitalName}</span><ChevronRight size={16} aria-hidden="true" /></span>
                            <span className="cu-sub">{c.hospitalAddress}</span>
                            <span className="cu-plan-meta"><span className={`cu-pill ${radTone(c.subscriptionStatus)}`}>{radStatusText(c.subscriptionStatus)}</span><span className="cu-flag">{editionOf(c.modules)} · {c.billingCycle}</span></span>
                            <span className="cu-mcard-stats"><span><strong>{c.staff.length}</strong> staff</span></span>
                        </Link>
                    ))}
                </div>
                {!loading && list.length === 0 && !error && <p className="cu-empty">No centres match. Try another chip or clear the search.</p>}
                <div className="cu-foot"><span>{list.length} of {centres.length} centres</span></div>
            </div>
        </div>
    );
};

export default RadCentersPage;
