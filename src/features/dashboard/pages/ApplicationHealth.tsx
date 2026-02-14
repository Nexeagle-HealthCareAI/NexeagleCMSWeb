import React from 'react';
import { Activity } from 'lucide-react';
import './Dashboard.css'; // Re-use dashboard styles for consistency

const ApplicationHealth: React.FC = () => {
    const [health, setHealth] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchHealth = async () => {
            try {
                // Import dynamically to avoid circular dependency issues if any, or just standard import
                const { getApplicationHealth } = await import('../services/healthService');
                const data = await getApplicationHealth();
                setHealth(data);
            } catch (err) {
                setError('Failed to load system health');
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
    }, []);

    if (loading) {
        return (
            <div className="dashboard-container">
                <div style={{ padding: '20px', textAlign: 'center' }}>Loading health status...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        <Activity size={28} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                        Application Health
                    </h1>
                    <p className="dashboard-subtitle">Monitor system performance and status.</p>
                </div>
            </header>

            <div className="table-card" style={{ padding: '24px', width: '100%', maxWidth: '33%', minWidth: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: health?.status === 'Healthy' ? '#10b981' : '#ef4444',
                        marginRight: '12px'
                    }} />
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>CMSAPI Status: {health?.status}</h2>
                </div>

                <div style={{ color: '#64748b', marginBottom: '8px' }}>
                    Total Duration: {health?.totalDuration}
                </div>

                {health?.checks && health.checks.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Component Checks</h3>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {health.checks.map((check: any, index: number) => (
                                <div key={index} style={{
                                    padding: '12px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontWeight: 500 }}>{check.component}</span>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.875rem',
                                        backgroundColor: check.status === 'Healthy' ? '#dcfce7' : '#fee2e2',
                                        color: check.status === 'Healthy' ? '#166534' : '#991b1b'
                                    }}>
                                        {check.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicationHealth;
