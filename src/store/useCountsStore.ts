import { create } from 'zustand';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../services/endpoints';

/**
 * Small "waiting" counts for the menu badges. Payment approvals are fetched
 * here (both products) and refreshed every minute while the app is open; the
 * Today page reports its own total so the Today badge matches its list.
 */
interface CountsState {
    hmsPending: number;
    radPending: number;
    today: number;
    loadedAt: number | null;
    refreshApprovals: () => Promise<void>;
    setToday: (n: number) => void;
}

export const useCountsStore = create<CountsState>((set) => ({
    hmsPending: 0,
    radPending: 0,
    today: 0,
    loadedAt: null,
    refreshApprovals: async () => {
        const [hms, rad] = await Promise.allSettled([
            api.get('/SubscriptionApproval/pending'),
            api.get(API_ENDPOINTS.RAD_SUBSCRIPTIONS.PAYMENT_REQUESTS),
        ]);
        const hmsList = hms.status === 'fulfilled' && Array.isArray(hms.value.data) ? hms.value.data : null;
        const radList = rad.status === 'fulfilled' && Array.isArray(rad.value.data) ? rad.value.data : null;
        set((s) => ({
            hmsPending: hmsList ? hmsList.length : s.hmsPending,
            radPending: radList
                ? radList.filter((r: { status?: string }) => String(r.status || '').toLowerCase() === 'pending').length
                : s.radPending,
            loadedAt: Date.now(),
        }));
    },
    setToday: (n) => set({ today: n }),
}));
