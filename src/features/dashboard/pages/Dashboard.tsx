import React from 'react';
import { Users, Building2, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockHospitals } from '../services/hospitalService';
import type { Hospital } from '../services/hospitalService';
import StatCard from '../components/StatCard';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [sortConfig, setSortConfig] = React.useState<{ key: keyof Hospital; direction: 'asc' | 'desc' } | null>(null);

    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 5;

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

    const processedHospitals = React.useMemo(() => {
        let items = [...mockHospitals];

        // Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(lowerTerm) ||
                item.city.toLowerCase().includes(lowerTerm) ||
                item.state.toLowerCase().includes(lowerTerm) ||
                item.id.toLowerCase().includes(lowerTerm)
            );
        }

        // Sort
        if (sortConfig) {
            items.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return items;
    }, [searchTerm, sortConfig]);

    const paginatedHospitals = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedHospitals.slice(startIndex, startIndex + itemsPerPage);
    }, [processedHospitals, currentPage]);

    const totalPages = Math.ceil(processedHospitals.length / itemsPerPage);

    const SortIcon = ({ columnKey }: { columnKey: keyof Hospital }) => {
        if (sortConfig?.key !== columnKey) return <span className="sort-icon inactive">↕</span>;
        return <span className="sort-icon active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1 className="dashboard-title">Dashboard Overview</h1>
                <p className="dashboard-subtitle">Welcome back to the CMS.</p>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard
                    icon={<Building2 size={24} color="#FFF" />}
                    title="Total Hospital OnBoarded"
                    value="124"
                    change="+5 this week"
                    gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
                />
                <StatCard
                    icon={<Stethoscope size={24} color="#FFF" />}
                    title="Total Doctors Onboarded"
                    value="3,450"
                    change="+42 this week"
                    gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                />
                <StatCard
                    icon={<Users size={24} color="#FFF" />}
                    title="Total Patients"
                    value="45,231"
                    change="+8.2%"
                    gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                />
            </div>

            {/* Hospital List Table */}
            <div className="table-card">
                <div className="table-header-controls">
                    <h2 className="table-title">Registered Hospitals</h2>
                    <input
                        type="text"
                        placeholder="Search hospitals..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Reset to page 1 on search
                        }}
                        className="search-input"
                    />
                </div>
                <div className="table-responsive-wrapper">
                    <table className="dashboard-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-header-cell" onClick={() => handleSort('partnerName')}>Partner Name <SortIcon columnKey="partnerName" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('id')}>Hospital ID <SortIcon columnKey="id" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('name')}>Hospital Name <SortIcon columnKey="name" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('contactNumber')}>Contact Number <SortIcon columnKey="contactNumber" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('email')}>Email <SortIcon columnKey="email" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('address')}>Address <SortIcon columnKey="address" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('city')}>City <SortIcon columnKey="city" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('state')}>State <SortIcon columnKey="state" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('totalPatients')}>Total Patients <SortIcon columnKey="totalPatients" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('registeredOn')}>Registered On <SortIcon columnKey="registeredOn" /></th>
                                <th className="table-header-cell" onClick={() => handleSort('status')}>Subscription Status <SortIcon columnKey="status" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedHospitals.map((hospital) => (
                                <tr
                                    key={hospital.id}
                                    onClick={() => handleRowClick(hospital.id)}
                                    className="table-row"
                                >
                                    <td className="table-cell">
                                        <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{hospital.partnerName}</div>
                                    </td>
                                    <td className="table-cell">{hospital.id}</td>
                                    <td className="table-cell">
                                        <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{hospital.name}</div>
                                    </td>
                                    <td className="table-cell">{hospital.contactNumber}</td>
                                    <td className="table-cell">{hospital.email}</td>
                                    <td className="table-cell">{hospital.address}</td>
                                    <td className="table-cell">{hospital.city}</td>
                                    <td className="table-cell">{hospital.state}</td>
                                    <td className="table-cell">{hospital.totalPatients.toLocaleString()}</td>
                                    <td className="table-cell">{new Date(hospital.registeredOn).toLocaleDateString()}</td>
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
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="pagination-container">
                    <div className="pagination-info">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, processedHospitals.length)} of {processedHospitals.length} entries
                    </div>
                    <div className="pagination-controls">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="pagination-button"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="pagination-button"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
