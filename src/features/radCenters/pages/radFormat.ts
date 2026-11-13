/** Small display helpers shared by the 1Rad centres list and a centre's page. */
export const radTone = (s?: string | null) => {
    switch ((s || '').toLowerCase()) {
        case 'active': return 'ok';
        case 'trial': return 'info';
        case 'expiring': case 'pending': return 'warn';
        case 'expired': case 'locked': case 'blocked': return 'bad';
        default: return 'muted';
    }
};

export const radStatusText = (s?: string | null) => {
    switch ((s || '').toLowerCase()) {
        case 'active': return 'Paying';
        case 'trial': return 'On trial';
        case 'expiring': return 'Ending soon';
        case 'expired': return 'Expired';
        case 'locked': return 'Locked';
        case '': case 'none': return 'No plan';
        default: return s as string;
    }
};

export const editionOf = (modules?: string | null) => {
    const m = (modules || '').toUpperCase();
    if (m.includes('RIS') && m.includes('PACS')) return 'RIS + PACS';
    if (m.includes('PACS')) return 'PACS';
    if (m.includes('RIS')) return 'RIS';
    return modules || '—';
};
