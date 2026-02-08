import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, MapPin, Phone, Mail, Building2, ChevronDown, ChevronUp,
    Users, Stethoscope, CreditCard, Calendar, Activity, GraduationCap,
    FileText, Shield, TrendingUp
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { mockHospitals } from '../services/hospitalService';
import './HospitalDetails.css';

const HospitalDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const hospital = mockHospitals.find(h => h.id === id);

    if (!hospital) {
        return <div className="p-8 text-center text-red-600">Hospital not found</div>;
    }

    return (
        <div className="hospital-details-container">
            <button
                onClick={() => navigate('/')}
                className="back-button"
            >
                <ArrowLeft size={16} />
                Back to Dashboard
            </button>

            {/* Header Section */}
            <div className="hospital-header">
                <div className="header-content">
                    <div className="header-icon-box">
                        <Building2 size={40} color="#FFFFFF" />
                    </div>
                    <div>
                        <h1 className="header-title">{hospital.name}</h1>
                        <div className="header-meta">
                            <span>ID: {hospital.id}</span>
                            <span>•</span>
                            <span>{hospital.city}, {hospital.state}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="details-content">

                {/* Analytics Section */}
                {hospital.stats && (
                    <div className="analytics-section" style={{ marginBottom: '1.5rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                            background: '#1e3a8a',
                            padding: '1rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div className="analytics-section-title" style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: 0
                            }}>
                                <TrendingUp size={20} color="#FFFFFF" />
                                Analytics Overview
                            </div>

                            <div className="time-range-selector" style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        style={{
                                            border: 'none',
                                            background: timeRange === range ? '#FFFFFF' : 'transparent',
                                            color: timeRange === range ? '#1e3a8a' : '#E0E7FF',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            textTransform: 'capitalize',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="analytics-grid">
                            {/* Unique Patients Chart */}
                            <div className="chart-container">
                                <h3 className="chart-title">Total Unique Patients ({timeRange})</h3>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={hospital.stats.uniquePatients[timeRange]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: '#6B7280' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#6B7280' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: '#2563eb' }}
                                                activeDot={{ r: 5 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Appointments Chart */}
                            <div className="chart-container">
                                <h3 className="chart-title">Appointments ({timeRange})</h3>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={hospital.stats.appointments[timeRange]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: '#6B7280' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#6B7280' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: '#10b981' }}
                                                activeDot={{ r: 5 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* General Information */}
                <CollapsibleCard title="General Information" icon={<Building2 size={20} />} defaultOpen={true}>
                    <div className="info-grid">
                        <InfoItem icon={<Building2 size={16} />} label="Hospital Name" value={hospital.name} />
                        <InfoItem icon={<MapPin size={16} />} label="Full Address" value={`${hospital.address}, ${hospital.city}, ${hospital.state}`} />
                        <InfoItem icon={<Phone size={16} />} label="Contact" value={hospital.contactNumber} />
                        <InfoItem icon={<Mail size={16} />} label="Email" value={hospital.email} />
                        <InfoItem icon={<Activity size={16} />} label="Hospital Type" value={hospital.hospitalType} />
                        <InfoItem icon={<Shield size={16} />} label="Partner" value={hospital.partnerName} />
                    </div>
                </CollapsibleCard>

                {/* User Info */}
                <CollapsibleCard title="User Info" icon={<Users size={20} />}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Total User Count: <span style={{ color: 'var(--primary)', fontSize: '16px' }}>{hospital.users.length}</span>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table className="details-table">
                            <thead>
                                <tr className="table-head-row">
                                    <th className="table-th">Name</th>
                                    <th className="table-th">Role</th>
                                    <th className="table-th">Contact</th>
                                    <th className="table-th">Email</th>
                                    <th className="table-th">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hospital.users.map((user, idx) => (
                                    <tr key={idx} className="table-tr">
                                        <td className="table-td">{user.name}</td>
                                        <td className="table-td">{user.role}</td>
                                        <td className="table-td">{user.contact}</td>
                                        <td className="table-td">{user.email}</td>
                                        <td className="table-td">
                                            <span className={`status-badge ${user.status === 'Active' ? 'status-active' : 'status-inactive'}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {hospital.users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleCard>

                {/* Doctors */}
                <CollapsibleCard title="Doctors" icon={<Stethoscope size={20} />}>
                    <div className="table-wrapper">
                        <table className="details-table">
                            <thead>
                                <tr className="table-head-row">
                                    <th className="table-th">Doctor Name</th>
                                    <th className="table-th">Details</th>
                                    <th className="table-th">Registration</th>
                                    <th className="table-th">Appointments (D/W/M/Y)</th>
                                    <th className="table-th">Unique Patients (D/W/M/Y)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hospital.doctors.map((doc, idx) => (
                                    <tr key={idx} className="table-tr">
                                        <td className="table-td">
                                            <div style={{ fontWeight: 600 }}>{doc.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{doc.speciality}</div>
                                        </td>
                                        <td className="table-td">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><GraduationCap size={12} /> {doc.degree}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dept: {doc.departments.join(', ')}</div>
                                        </td>
                                        <td className="table-td">
                                            <div>{doc.registrationNumber}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Reg: {doc.registeredOn}</div>
                                        </td>
                                        <td className="table-td">
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                                                <span>D: {doc.appointments.daily}</span>
                                                <span>W: {doc.appointments.weekly}</span>
                                                <span>M: {doc.appointments.monthly}</span>
                                                <span>Y: {doc.appointments.yearly}</span>
                                            </div>
                                        </td>
                                        <td className="table-td">
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
                                                <span>D: {doc.uniquePatients.daily}</span>
                                                <span>W: {doc.uniquePatients.weekly}</span>
                                                <span>M: {doc.uniquePatients.monthly}</span>
                                                <span>Y: {doc.uniquePatients.yearly}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {hospital.doctors.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No doctors found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleCard>

                {/* Subscription */}
                <CollapsibleCard title="Subscription" icon={<CreditCard size={20} />}>
                    <div className="info-grid">
                        <InfoItem icon={<Calendar size={16} />} label="Hospital Registered On" value={hospital.registeredOn} />
                        <InfoItem icon={<FileText size={16} />} label="Subscription Mode" value={hospital.subscriptionMode} />
                        <InfoItem icon={<CreditCard size={16} />} label="Payment Mode" value={hospital.paymentMode} />
                        <InfoItem icon={<Activity size={16} />} label="Current Status" value={hospital.status} />
                    </div>
                </CollapsibleCard>



            </div>
        </div>
    );
};

// Start of Helper Components

const CollapsibleCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="collapsible-card">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`card-header ${isOpen ? 'card-header-active' : ''}`}
            >
                <div className="card-title-group">
                    <div className="card-icon">
                        {icon}
                    </div>
                    <span className="card-title">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
            </div>

            <div className="card-content-wrapper" style={{ maxHeight: isOpen ? '2000px' : '0', opacity: isOpen ? 1 : 0 }}>
                <div className="card-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="info-item">
        <div className="info-icon">{icon}</div>
        <div>
            <div className="info-label">{label}</div>
            <div className="info-value">{value || 'N/A'}</div>
        </div>
    </div>
);

export default HospitalDetails;
