import React from 'react';

// Shared by HospitalOperationsTab and FreeTierLimitsPanel -- both need to show whether a
// hospital is on the free tier (Trial / no subscription row, subject to the usage limit) or
// a paid plan (Active, etc. -- no limit at all), using the same status string the backend
// derives it from.
export const PlanBadge: React.FC<{ status: string }> = ({ status }) => {
    const normalized = status.toLowerCase();
    const isTrial = normalized === 'trial' || normalized === '';
    const isActive = normalized === 'active';

    const style: React.CSSProperties = {
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...(isTrial
            ? { background: '#fef3c7', color: '#b45309' }
            : isActive
                ? { background: '#dcfce7', color: '#15803d' }
                : { background: '#f1f5f9', color: '#475569' }),
    };
    return <span style={style}>{isTrial ? 'Free Tier' : isActive ? 'Paid Plan' : status}</span>;
};

export default PlanBadge;
