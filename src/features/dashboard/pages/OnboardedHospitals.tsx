import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHospitals, type Hospital } from '../services/hospitalService';
import './Dashboard.css';

const OnboardedHospitals: React.FC = () => {
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Hospital; direction: 'asc' | 'desc' } | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    const fetchHospitals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getHospitals(currentPage, itemsPerPage);
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
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        fetchHospitals();
    }, [fetchHospitals]);

    const handleRowClick = (id: string) => {
        navigate(`/hospital/${id}`);
    };

    const handleSort = (key: keyof Hospital) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Client-side processing of the CURRENT PAGE data
    // Note: Ideally search/sort should be server-side params passed to getHospitals
    const processedHospitals = React.useMemo(() => {
        let items = [...hospitals];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(lowerTerm) ||
                item.city.toLowerCase().includes(lowerTerm) ||
                item.state.toLowerCase().includes(lowerTerm) ||
                item.id.toLowerCase().includes(lowerTerm)
            );
        }

        if (sortConfig) {
            items.sort((a, b) => {
                const { key, direction } = sortConfig;
                const aValue = a[key] ?? '';
                const bValue = b[key] ?? '';

                if (aValue < bValue) {
                    return direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return items;
    }, [hospitals, searchTerm, sortConfig]);

    const SortIcon = ({ columnKey }: { columnKey: keyof Hospital }) => {
        if (sortConfig?.key !== columnKey) return <span className="sort-icon inactive">↕</span>;
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
                        placeholder="Search current page..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : error ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>
                ) : (
                    <>
                        {/* Desktop View: Table */}
                        <div className="table-responsive-wrapper hospitals-desktop-table">
                            <table className="dashboard-table">
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-header-cell" onClick={() => handleSort('id')}>Hospital ID <SortIcon columnKey="id" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('name')}>Hospital Name <SortIcon columnKey="name" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('contactNumber')}>Contact Number <SortIcon columnKey="contactNumber" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('email')}>Email <SortIcon columnKey="email" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('address')}>Address <SortIcon columnKey="address" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('city')}>City <SortIcon columnKey="city" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('state')}>State <SortIcon columnKey="state" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('totalPatients')}>Total Patients <SortIcon columnKey="totalPatients" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('registeredOn')}>Registered On <SortIcon columnKey="registeredOn" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('partnerName')}>Partner Name <SortIcon columnKey="partnerName" /></th>
                                        <th className="table-header-cell" onClick={() => handleSort('status')}>Status <SortIcon columnKey="status" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedHospitals.map((hospital) => (
                                        <tr
                                            key={hospital.id}
                                            onClick={() => handleRowClick(hospital.id)}
                                            className="table-row"
                                        >
                                            <td className="table-cell">{hospital.id}</td>
                                            <td className="table-cell">
                                                <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{hospital.name}</div>
                                            </td>
                                            <td className="table-cell">{hospital.contactNumber}</td>
                                            <td className="table-cell">{hospital.email}</td>
                                            <td className="table-cell">{hospital.address}</td>
                                            <td className="table-cell">{hospital.city}</td>
                                            <td className="table-cell">{hospital.state}</td>
                                            <td className="table-cell">{hospital.totalPatients?.toLocaleString() || 0}</td>
                                            <td className="table-cell">
                                                {new Date(hospital.registeredOn).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="table-cell">
                                                <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{hospital.partnerName || '-'}</div>
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
                                    {processedHospitals.length === 0 && (
                                        <tr>
                                            <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>No hospitals found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Cards (Android Compatible) */}
                        <div className="hospitals-mobile-cards">
                            {processedHospitals.map((hospital) => (
                                <div 
                                    key={hospital.id} 
                                    className="hospital-mobile-card" 
                                    onClick={() => handleRowClick(hospital.id)}
                                >
                                    <div className="hospital-mobile-card-header">
                                        <div className="hospital-avatar-wrapper">
                                            <span className="hospital-avatar">{hospital.name[0].toUpperCase()}</span>
                                        </div>
                                        <div className="hospital-meta">
                                            <h3 className="hospital-name">{hospital.name}</h3>
                                            <p className="hospital-id">ID: {hospital.id.split('-')[0]}...</p>
                                        </div>
                                        <span className={`hospital-status-badge ${hospital.status.toLowerCase()}`}>
                                            {hospital.status}
                                        </span>
                                    </div>
                                    
                                    <div className="hospital-mobile-card-details">
                                        <div className="detail-item">
                                            <span className="detail-label">City/State</span>
                                            <span className="detail-value">{hospital.city}, {hospital.state}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Total Patients</span>
                                            <span className="detail-value">{hospital.totalPatients?.toLocaleString() || 0}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Partner</span>
                                            <span className="detail-value">{hospital.partnerName || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {processedHospitals.length === 0 && (
                                <div className="hospitals-empty-mobile">No hospitals found.</div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="pagination-container">
                            <div className="pagination-info">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                            </div>
                            <div className="pagination-controls">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="pagination-button"
                                >
                                    Previous
                                </button>
                                <span style={{ margin: '0 10px' }}>Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
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
