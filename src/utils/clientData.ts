/* clientData.ts - what CMS data may live in this browser, and wiping it.
 *
 * Every successful GET used to be copied into localStorage, including patient names, chat
 * transcripts, lead phone numbers and visitor IPs, and nothing removed it at logout. Now only the
 * screens the offline mode exists for (dashboard, hospitals list, subscriptions and plans,
 * operations) are cached, and logout wipes the cache and the offline queue.
 *
 * Deliberately has no imports, so the auth store can use it without an import cycle.
 */

export const CACHE_PREFIX = 'nexeagle-cms-cache:';
export const SYNC_QUEUE_KEY = 'nexeagle-cms-sync-queue';

// Paths relative to the API base URL. EXACT matches the path only; PREFIX also matches sub-paths.
const EXACT = new Set([
    '/dashboard/stats',
    '/hospitals',                    // the list only: hospital details carry staff and patient data
    '/hospital-operations/summary',
    '/rad-hospitals',
    '/night-jobs',
    '/night-jobs/runs',
]);
const PREFIX = [
    '/free-tier-settings',
    '/SubscriptionPlans',
    '/EasyHmsSubscriptionPlans',
    '/SubscriptionApproval',
    '/ReferralCodes',
];

/** True when a GET to this URL may be stored for offline use. Everything else is never stored. */
export function isCacheableUrl(url: string | undefined): boolean {
    if (!url) return false;
    const path = url.split('?')[0].replace(/\/+$/, '');
    if (EXACT.has(path)) return true;
    return PREFIX.some(p => path === p || path.startsWith(p + '/'));
}

/** Remove cached API responses (all, or only those no longer allowed) and optionally the offline queue. */
export function clearClientData(options: { onlyDisallowed?: boolean; keepQueue?: boolean } = {}): void {
    try {
        Object.keys(localStorage).forEach(key => {
            if (!key.startsWith(CACHE_PREFIX)) return;
            if (options.onlyDisallowed && isCacheableUrl(key.slice(CACHE_PREFIX.length))) return;
            localStorage.removeItem(key);
        });
        if (!options.keepQueue) localStorage.removeItem(SYNC_QUEUE_KEY);
    } catch {
        /* storage unavailable - nothing to clear */
    }
}
