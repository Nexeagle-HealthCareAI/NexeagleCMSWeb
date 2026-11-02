import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isCacheableUrl, clearClientData, CACHE_PREFIX, SYNC_QUEUE_KEY } from './clientData';
import { useAuthStore } from '../store/useAuthStore';

vi.mock('../features/login/services/authService');

describe('isCacheableUrl', () => {
    it.each([
        '/dashboard/stats',
        '/hospitals',
        '/hospitals?page=2&limit=10',
        '/SubscriptionApproval/pending',
        '/EasyHmsSubscriptionPlans',
        '/free-tier-settings/global',
    ])('allows %s', url => expect(isCacheableUrl(url)).toBe(true));

    it.each([
        '/insights/appointments?page=1',
        '/insights/patient-logins',
        '../chat/history/abc',
        '/marketing/leads',
        '/marketing/leads/123',
        '/users',
        '/hospitals/123',            // details carry staff and patient data
        '/auth/me',
        undefined,
    ])('refuses %s', url => expect(isCacheableUrl(url)).toBe(false));
});

describe('clearClientData', () => {
    beforeEach(() => localStorage.clear());

    it('purges only disallowed entries when asked', () => {
        localStorage.setItem(`${CACHE_PREFIX}/dashboard/stats?`, '{}');
        localStorage.setItem(`${CACHE_PREFIX}/insights/appointments?{"page":1}`, '{}');
        localStorage.setItem(SYNC_QUEUE_KEY, '[]');
        clearClientData({ onlyDisallowed: true, keepQueue: true });
        expect(localStorage.getItem(`${CACHE_PREFIX}/dashboard/stats?`)).not.toBeNull();
        expect(localStorage.getItem(`${CACHE_PREFIX}/insights/appointments?{"page":1}`)).toBeNull();
        expect(localStorage.getItem(SYNC_QUEUE_KEY)).not.toBeNull();
    });

    it('logout wipes cached API data and the offline queue', () => {
        localStorage.setItem(`${CACHE_PREFIX}/dashboard/stats?`, '{}');
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([{ id: '1' }]));
        localStorage.setItem('unrelated-key', 'kept');
        useAuthStore.getState().logout();
        expect(localStorage.getItem(`${CACHE_PREFIX}/dashboard/stats?`)).toBeNull();
        expect(localStorage.getItem(SYNC_QUEUE_KEY)).toBeNull();
        expect(localStorage.getItem('unrelated-key')).toBe('kept');
    });
});
