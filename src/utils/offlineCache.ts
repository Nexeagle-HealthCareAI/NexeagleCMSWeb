/* offlineCache.ts - Cache manager for API responses */

interface CacheEntry<T> {
    timestamp: number;
    data: T;
    ttl: number; // in milliseconds
}

const CACHE_PREFIX = 'nexeagle-cms-cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default

export const offlineCache = {
    set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
        try {
            const entry: CacheEntry<T> = {
                timestamp: Date.now(),
                data,
                ttl: ttlMs
            };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch (e) {
            console.error('Offline Cache set failed:', e);
        }
    },

    get<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return null;

            const entry = JSON.parse(raw) as CacheEntry<T>;
            const age = Date.now() - entry.timestamp;

            // If offline, ignore TTL and serve stale data
            if (!navigator.onLine) {
                console.log(`[Offline Cache] Serving stale cache for: ${key} (Age: ${Math.round(age / 1000)}s)`);
                return entry.data;
            }

            // If online, enforce TTL limit
            if (age > entry.ttl) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }

            return entry.data;
        } catch (e) {
            console.error('Offline Cache get failed:', e);
            return null;
        }
    },

    clearAll(): void {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
};
