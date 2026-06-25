import React from 'react';
import { Users, Building2, Stethoscope, UserPlus } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
// import { useNavigate } from 'react-router-dom'; // navigating internally in dashboard removed
import { getDashboardStats } from '../services/hospitalService';
import type { DashboardStats } from '../services/hospitalService';
import StatCard from '../components/StatCard';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    // navigate is no longer used unless we add navigation back
    // const navigate = useNavigate(); 

    // Removed table filtering/sorting/pagination state

    const [dashboardStats, setDashboardStats] = React.useState<DashboardStats | null>(null);
    const [statsError, setStatsError] = React.useState<string | null>(null);
    const [timeRange, setTimeRange] = React.useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

    // Date and Time State
    const [currentDateTime, setCurrentDateTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    React.useEffect(() => {
        const fetchStats = async () => {
            try {
                const stats = await getDashboardStats();
                setDashboardStats(stats);
            } catch {
                setStatsError('Failed to load dashboard statistics.');
            }
        };
        fetchStats();
    }, []);

    // Helper to format change string
    const formatChange = (metric: { change: number; changeType: 'increase' | 'decrease' | 'nochange'; period: string }) => {
        if (metric.changeType === 'nochange') return 'No change';
        const prefix = metric.changeType === 'increase' ? '+' : '-';
        return `${prefix}${metric.change} ${metric.period}`;
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Dashboard Overview</h1>
                    <p className="dashboard-subtitle">Welcome back to the CMS.</p>
                </div>
                <div className="dashboard-datetime">
                    <div className="time">
                        {currentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="date">
                        {currentDateTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            {statsError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
                    {statsError}
                </div>
            )}
            {dashboardStats && (
                <div className="stats-grid">
                    <StatCard
                        icon={<Building2 size={24} color="#FFF" />}
                        title="Total Hospital OnBoarded"
                        value={dashboardStats.totalHospitals.value.toLocaleString()}
                        change={formatChange(dashboardStats.totalHospitals)}
                        gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
                    />
                    <StatCard
                        icon={<Stethoscope size={24} color="#FFF" />}
                        title="Total Doctors Onboarded"
                        value={dashboardStats.totalDoctors.value.toLocaleString()}
                        change={formatChange(dashboardStats.totalDoctors)}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    />
                    <StatCard
                        icon={<Users size={24} color="#FFF" />}
                        title="Total Patients"
                        value={dashboardStats.totalPatients.value.toLocaleString()}
                        change={formatChange(dashboardStats.totalPatients)}
                        gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                    />
                    <StatCard
                        icon={<UserPlus size={24} color="#FFF" />}
                        title="Total Users Onboarded"
                        value={dashboardStats.totalUsers.value.toLocaleString()}
                        change={formatChange(dashboardStats.totalUsers)}
                        gradient="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
                    />
                </div>
            )}

            {/* Analytics Section */}
            {dashboardStats && (
                <div className="analytics-section">
                    <div className="analytics-header">
                        <div className="analytics-title">
                            <Building2 size={20} color="#FFFFFF" />
                            Analytics Overview
                        </div>
                        <div className="time-range-selector">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="analytics-grid">
                        {/* Hospitals Chart */}
                        <div className="chart-card">
                            <h3 className="chart-title">Hospitals Onboarded ({timeRange})</h3>
                            <div className="chart-area">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dashboardStats.charts.hospitals[timeRange]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Doctors Chart */}
                        <div className="chart-card">
                            <h3 className="chart-title">Doctors Onboarded ({timeRange})</h3>
                            <div className="chart-area">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dashboardStats.charts.doctors[timeRange]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Patients Chart */}
                        <div className="chart-card">
                            <h3 className="chart-title">Patients Onboarded ({timeRange})</h3>
                            <div className="chart-area">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dashboardStats.charts.patients[timeRange]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Users Chart */}
                        <div className="chart-card">
                            <h3 className="chart-title">Users Onboarded ({timeRange})</h3>
                            <div className="chart-area">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dashboardStats.charts.users[timeRange]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, fill: '#ec4899' }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
