import React from 'react';

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string;
    change: string;
    /** Accent for the icon tile; the first colour of a CSS gradient is used. */
    gradient: string;
}

/** A plain number card, same look as the Today page cards. */
const StatCard: React.FC<StatCardProps> = ({ icon, title, value, change, gradient }) => {
    const accent = (gradient.match(/#[0-9a-fA-F]{6}/) || ['#4F46E5'])[0];
    return (
        <div className="ne-stat">
            <div className="ne-stat-top">
                <span className="ne-stat-title">{title}</span>
                <span className="ne-stat-ico" style={{ color: accent, background: `${accent}1A` }}>{icon}</span>
            </div>
            <div className="ne-stat-num">{value}</div>
            {change && <div className="ne-stat-sub">{change}</div>}
        </div>
    );
};

export default StatCard;
