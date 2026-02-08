import React from 'react';

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string;
    change: string;
    gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, change, gradient }) => {
    const textColor = '#FFFFFF';

    return (
        <div style={{
            background: gradient,
            padding: 'var(--spacing-md)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.1)',
            border: 'none',
            color: textColor
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', backdropFilter: 'blur(4px)' }}>
                    {icon}
                </div>
                <span style={{
                    fontWeight: 600,
                    color: textColor,
                    background: 'rgba(255,255,255,0.15)',
                    padding: '2px 6px',
                    borderRadius: '16px',
                    fontSize: '10px'
                }}>
                    {change}
                </span>
            </div>
            <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500, fontSize: '10px' }}>{title}</div>
                <div style={{ fontSize: 'var(--font-size-header)', fontWeight: 800, color: textColor, marginTop: '2px', letterSpacing: '-0.025em' }}>{value}</div>
            </div>
        </div>
    );
};

export default StatCard;
