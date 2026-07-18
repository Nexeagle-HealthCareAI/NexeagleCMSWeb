import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { getHospitals, type Hospital } from '../services/hospitalService';
import './Dashboard.css';

const statusStyles: Record<string, string> = {
    Trial: 'sub-badge-trial',
    Active: 'sub-badge-active',
    Approved: 'sub-badge-active',
    Expired: 'sub-badge-danger',
    Blocked: 'sub-badge-danger',
    Rejected: 'sub-badge-danger',
    Pending: 'sub-badge-pending',
    PendingApproval: 'sub-badge-pending',
};

const SubscriptionCell: React.FC<{ hospital: Hospital }> = ({ hospital }) => {
    if (!hospital.subscriptionStatus) {
        return <span className="sub-cell-empty">No subscription</span>;
    }
    const planLabel = hospital.subscriptionIsEnterprise ? 'Enterprise' : (hospital.subscriptionPlanName || 'No Plan Selected');
    return (
        <div className="sub-cell">
            <div className="sub-cell-plan">{planLabel}</div>
            <div className="sub-cell-meta">
                <span className={`sub-badge ${statusStyles[hospital.subscriptionStatus] || 'sub-badge-neutral'}`}>
                    {hospital.subscriptionStatus}
                </span>
                {hospital.subscriptionDaysRemaining != null && (
                    <span className="sub-cell-days">{hospital.subscriptionDaysRemaining}d left</span>
                )}
            </div>
        </div>
    );
};

const OnboardedHospitals: React.FC = () => {
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'registeredon', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // Debounce the search box so we're not firing a request per keystroke.
    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    const fetchHospitals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getHospitals(currentPage, itemsPerPage, search, sortConfig.key, sortConfig.direction);
            setHospitals(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
            setError(null);
        } catch (err) {
            setError('Failed to fetch hospitals');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, search, sortConfig]);

    useEffect(() => {
        fetchHospitals();
    }, [fetchHospitals]);

    const handleRowClick = (id: string) => {
        navigate(`/hospital/${id}`);
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <span className="sort-icon inactive">↕</span>;
        return <span className="sort-icon active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="dashboard-container fixed-layout">
            <header className="dashboard-header">
                <h1 className="dashboard-title">Onboarded Hospitals</h1>
                <p className="dashboard-subtitle">Manage and view all registered hospitals.</p>
            </header>

            <div className="table-card">
                <div className="table-header-controls">
                    <h2 className="table-title">
                        All Hospitals
                        <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 'normal' }}>
                            ({totalItems})
                        </span>
                    </h2>
                    <input
                        type="text"
                        placeholder="Search by name, phone or email..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="search-input"
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : error ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>
                ) : (
                    <>
                        {/* Desktop / tablet: table */}
                        <div className="table-responsive-wrapper hospitals-table-desktop">
                            <table className="dashboard-table">
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-header-cell" onClick={() => handleSort('name')}>Hospital <SortIcon columnKey="name" /></th>
                                        <th className="table-header-cell">Contact</th>
                                        <th className="table-header-cell">Location</th>
                                        <th className="table-header-cell">Total Patients</th>
                                        <th className="table-header-cell" onClick={() => handleSort('registeredon')}>Registered On <SortIcon columnKey="registeredon" /></th>
                                        <th className="table-header-cell">Subscription</th>
                                        <th className="table-header-cell">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hospitals.map((hospital) => (
                                        <tr
                                            key={hospital.id}
                                            onClick={() => handleRowClick(hospital.id)}
                                            className="table-row"
                                        >
                                            <td className="table-cell">
                                                <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{hospital.name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{hospital.id.split('-')[0]}...</div>
                                            </td>
                                            <td className="table-cell">
                                                <div>{hospital.contactNumber}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{hospital.email}</div>
                                            </td>
                                            <td className="table-cell">
                                                {[hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')}
                                            </td>
                                            <td className="table-cell">{hospital.totalPatients?.toLocaleString() || 0}</td>
                                            <td className="table-cell">
                                                {new Date(hospital.registeredOn).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </td>
                                            <td className="table-cell">
                                                <SubscriptionCell hospital={hospital} />
                                            </td>
                                            <td className="table-cell">
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    background: hospital.status === 'Active' ? '#D1FAE5' : '#FEF3C7',
                                                    color: hospital.status === 'Active' ? '#065F46' : '#92400E'
                                                }}>
                                                    {hospital.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {hospitals.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No hospitals found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: card list */}
                        <div className="hospitals-cards-mobile">
                            {hospitals.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No hospitals found.</div>
                            ) : hospitals.map((hospital) => (
                                <div key={hospital.id} className="hospital-card" onClick={() => handleRowClick(hospital.id)}>
                                    <div className="hospital-card-header">
                                        <div className="hospital-card-icon"><Building2 size={18} /></div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="hospital-card-name">{hospital.name}</div>
                                            <span style={{
                                                padding: '1px 8px',
                                                borderRadius: '12px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                background: hospital.status === 'Active' ? '#D1FAE5' : '#FEF3C7',
                                                color: hospital.status === 'Active' ? '#065F46' : '#92400E'
                                            }}>
                                                {hospital.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="hospital-card-row">
                                        <Phone size={13} className="hospital-card-row-icon" /> {hospital.contactNumber}
                                    </div>
                                    <div className="hospital-card-row">
                                        <Mail size={13} className="hospital-card-row-icon" /> {hospital.email}
                                    </div>
                                    <div className="hospital-card-row">
                                        <MapPin size={13} className="hospital-card-row-icon" />
                                        {[hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')}
                                    </div>

                                    <div className="hospital-card-footer">
                                        <SubscriptionCell hospital={hospital} />
                                        <div className="hospital-card-patients">{hospital.totalPatients?.toLocaleString() || 0} patients</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        <div className="pagination-container">
                            <div className="pagination-info">
                                Showing {totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                            </div>
                            <div className="pagination-controls">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="pagination-button"
                                >
                                    Previous
                                </button>
                                <span style={{ margin: '0 10px' }}>Page {currentPage} of {totalPages || 1}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="pagination-button"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OnboardedHospitals;
