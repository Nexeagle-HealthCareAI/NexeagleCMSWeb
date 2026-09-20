import React from 'react';

interface PlanBadgeProps {
    status: string;
    // Current-month free-tier usage -- only meaningful (and only rendered) when status is Trial.
    usedCount?: number | null;
    limit?: number | null;
}

// Shared by HospitalOperationsTab, OnboardedHospitals and FreeTierLimitsPanel -- all need to show
// whether a hospital is on the free tier (Trial / no subscription row, subject to the usage
// limit) or a paid plan (Active, etc. -- no limit at all), using the same status string the
// backend derives it from. When usedCount/limit are passed for a Trial hospital, also flags
// whether this month's free-tier quota has been exceeded.
export const PlanBadge: React.FC<PlanBadgeProps> = ({ status, usedCount, limit }) => {
    const normalized = status.toLowerCase();
    const isTrial = normalized === 'trial' || normalized === '';
    const isActive = normalized === 'active';
    const isOverLimit = isTrial && usedCount != null && limit != null && usedCount >= limit;

    const style: React.CSSProperties = {
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...(isOverLimit
            ? { background: '#fee2e2', color: '#b91c1c' }
            : isTrial
                ? { background: '#fef3c7', color: '#b45309' }
                : isActive
                    ? { background: '#dcfce7', color: '#15803d' }
                    : { background: '#f1f5f9', color: '#475569' }),
    };
    const label = isOverLimit ? 'Over Limit' : isTrial ? 'Free Tier' : isActive ? 'Paid Plan' : status;

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={style}>{label}</span>
            {isTrial && usedCount != null && limit != null && (
                <span style={{ fontSize: 11, color: isOverLimit ? '#b91c1c' : '#64748b', fontWeight: 500 }}>
                    {usedCount}/{limit}
                </span>
            )}
        </span>
    );
};

export default PlanBadge;
