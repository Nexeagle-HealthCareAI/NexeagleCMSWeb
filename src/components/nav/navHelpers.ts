import { useSupportStore } from '../../store/useSupportStore';
import { useCountsStore } from '../../store/useCountsStore';
import type { BadgeKey } from './navConfig';

/** Badge numbers for the menu, shared by the side menu, phone tabs and menu sheet. */
export const useBadgeCounts = (): Record<BadgeKey, number> => {
    const chat = useSupportStore((s) => s.unreadCount);
    const hms = useCountsStore((s) => s.hmsPending);
    const rad = useCountsStore((s) => s.radPending);
    const today = useCountsStore((s) => s.today);
    return { chat, approvals: hms + rad, today };
};

export const initialsOf = (name?: string | null) =>
    (name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
