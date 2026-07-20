import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHospitals, type Hospital } from '../services/hospitalService';
import './Dashboard.css';
import './PremiumHospitals.css';

const getGradientClass = (name: string) => {
    if (!name) return 'gradient-1';
    const char = name[0].toUpperCase();
    if (/[A-E]/.test(char)) return 'gradient-1';
    if (/[F-J]/.test(char)) return 'gradient-2';
    if (/[K-O]/.test(char)) return 'gradient-3';
    if (/[P-T]/.test(char)) return 'gradient-4';
    return 'gradient-5';
};

const SubscriptionCell: React.FC<{ hospital: Hospital }> = ({ hospital }) => {
    if (!hospital.subscriptionStatus) {
        return <span style={{ color: '#94a3b8', fontSize: '13px' }}>No subscription</span>;
    }
    const planLabel = hospital.subscriptionIsEnterprise ? 'Enterprise' : (hospital.subscriptionPlanName || 'No Plan Selected');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="premium-sub-plan">{planLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`premium-sub-badge premium-status-${hospital.subscriptionStatus.toLowerCase()}`}>
                    {hospital.subscriptionStatus}
                </span>
                {hospital.subscriptionDaysRemaining != null && (
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        {hospital.subscriptionDaysRemaining}d left
                    </span>
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
    const [statusFilter, setStatusFilter] = useState('');
    const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('');

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
            const response = await getHospitals(
                currentPage, itemsPerPage, search, sortConfig.key, sortConfig.direction,
                statusFilter, subscriptionStatusFilter
            );
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
    }, [currentPage, itemsPerPage, search, sortConfig, statusFilter, subscriptionStatusFilter]);

    useEffect(() => {
        fetchHospitals();
    }, [fetchHospitals]);

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setCurrentPage(1);
    };

    const handleSubscriptionStatusFilterChange = (value: string) => {
        setSubscriptionStatusFilter(value);
        setCurrentPage(1);
    };

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
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Onboarded Hospitals</h1>
                    <p className="premium-subtitle">Manage and view all registered hospitals.</p>
                </div>
            </header>

            <div className="premium-table-card">
                <div className="premium-controls">
                    <h2 className="premium-table-title">
                        All Hospitals
                        <span className="premium-badge-count">
                            {totalItems}
                        </span>
                    </h2>
                    <div className="premium-filters-row">
                        <div className="premium-search-wrapper">
                            <svg className="premium-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search hospitals..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="premium-search-input"
                            />
                        </div>
                        <select
                            className="premium-filter-select"
                            value={statusFilter}
                            onChange={(e) => handleStatusFilterChange(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Pending">Pending</option>
                        </select>
                        <select
                            className="premium-filter-select"
                            value={subscriptionStatusFilter}
                            onChange={(e) => handleSubscriptionStatusFilterChange(e.target.value)}
                        >
                            <option value="">All Subscriptions</option>
                            <option value="Trial">Trial</option>
                            <option value="Active">Active</option>
                            <option value="Expired">Expired</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Rejected">Rejected</option>
                            <option value="PendingApproval">Pending Approval</option>
                            <option value="None">No Subscription</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading hospitals...</div>
                ) : error ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
                ) : (
                    <>
                        {/* Desktop View: Table */}
                        <div className="premium-responsive-wrapper premium-desktop-table">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('name')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Hospital <SortIcon columnKey="name" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('contactnumber')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Contact <SortIcon columnKey="contactnumber" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('totalpatients')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Total Patients <SortIcon columnKey="totalpatients" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('totaldoctors')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Total Doctors <SortIcon columnKey="totaldoctors" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('totalnondoctorusers')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Other Users <SortIcon columnKey="totalnondoctorusers" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('registeredon')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Registered On <SortIcon columnKey="registeredon" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('subscriptionstatus')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Subscription <SortIcon columnKey="subscriptionstatus" />
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('status')} className="premium-sortable-th">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Status <SortIcon columnKey="status" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hospitals.map((hospital) => (
                                        <tr
                                            key={hospital.id}
                                            onClick={() => handleRowClick(hospital.id)}
                                            className="premium-row"
                                        >
                                            <td>
                                                <div className="premium-hospital-cell">
                                                    <div className={`premium-avatar ${getGradientClass(hospital.name)}`}>
                                                        {hospital.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="premium-hospital-name">{hospital.name}</div>
                                                        <span className="premium-hospital-location">
                                                            {[hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, color: '#334155', marginBottom: '4px' }}>{hospital.contactNumber}</div>
                                                <div style={{ fontSize: '13px', color: '#64748b' }}>{hospital.email}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                                                    {hospital.totalPatients?.toLocaleString() || 0}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#059669' }}>
                                                    {hospital.totalDoctors ?? 0}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#4f46e5' }}>
                                                    {hospital.totalNonDoctorUsers ?? 0}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ color: '#475569' }}>
                                                    {new Date(hospital.registeredOn).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric'
                                                    })}
                                                </div>
                                            </td>
                                            <td>
                                                <SubscriptionCell hospital={hospital} />
                                            </td>
                                            <td>
                                                <span className={`premium-status premium-status-${hospital.status.toLowerCase()}`}>
                                                    {hospital.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {hospitals.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>No hospitals found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Cards */}
                        <div className="premium-mobile-cards">
                            {hospitals.map((hospital) => (
                                <div 
                                    key={hospital.id} 
                                    className="premium-mobile-card" 
                                    onClick={() => handleRowClick(hospital.id)}
                                >
                                    <div className="premium-mobile-header">
                                        <div className={`premium-avatar ${getGradientClass(hospital.name)}`}>
                                            {hospital.name[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 className="premium-hospital-name">{hospital.name}</h3>
                                            <p className="premium-hospital-location">
                                                {[hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')}
                                            </p>
                                        </div>
                                        <span className={`premium-status premium-status-${hospital.status.toLowerCase()}`}>
                                            {hospital.status}
                                        </span>
                                    </div>

                                    <div className="premium-mobile-details">
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Contact</span>
                                            <span className="premium-mobile-detail-value">{hospital.contactNumber}</span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Total Patients</span>
                                            <span className="premium-mobile-detail-value" style={{ color: '#3b82f6' }}>
                                                {hospital.totalPatients?.toLocaleString() || 0}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Total Doctors</span>
                                            <span className="premium-mobile-detail-value" style={{ color: '#059669' }}>
                                                {hospital.totalDoctors ?? 0}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Other Users</span>
                                            <span className="premium-mobile-detail-value" style={{ color: '#4f46e5' }}>
                                                {hospital.totalNonDoctorUsers ?? 0}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Subscription</span>
                                            <span className="premium-mobile-detail-value">
                                                {hospital.subscriptionStatus || 'None'}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Registered</span>
                                            <span className="premium-mobile-detail-value">
                                                {new Date(hospital.registeredOn).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {hospitals.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                                    No hospitals found.
                                </div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="premium-pagination">
                            <div className="premium-page-info">
                                Showing <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalItems}</span> entries
                            </div>
                            <div className="premium-page-controls">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="premium-page-btn"
                                >
                                    Previous
                                </button>
                                <span style={{ margin: '0 12px', fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="premium-page-btn"
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
