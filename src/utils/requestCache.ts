/* requestCache.ts - short-lived, in-memory cache for GET requests (this tab only, never on disk).
 *
 * Tabbed pages (Insights, Symptom Router, Marketing, Subscriptions) unmount their panels on every
 * tab switch, so going back to a tab used to fetch the same data again. Two components asking for
 * the same list at once (e.g. Pipeline and Kanban both loading assignees) also each made a call.
 * This cache answers repeat GETs for TTL_MS and shares one in-flight request between callers.
 *
 * Correctness rules (see api.ts):
 *  - any successful POST/PUT/PATCH/DELETE clears everything, so a change is never hidden;
 *  - logout, a finished offline sync and a hot-lead alert clear everything;
 *  - auth and chat calls are never cached (session state and live conversations).
 */

export const TTL_MS = 30_000;

const NEVER_CACHE = ['/auth/', '/chat/'];

interface Entry<T> {
    at: number;
    promise: Promise<T>;
}

const entries = new Map<string, Entry<unknown>>();

export function isMemoCacheable(url: string | undefined): boolean {
    if (!url) return false;
    return !NEVER_CACHE.some(part => url.includes(part));
}

export function cacheKey(url: string, params?: unknown): string {
    return params === undefined ? url : `${url}?${JSON.stringify(params)}`;
}

/** Returns the cached promise for key, or runs load() and caches it. Failed loads are not kept. */
export function memoGet<T>(key: string, load: () => Promise<T>, now: number = Date.now()): Promise<T> {
    const hit = entries.get(key) as Entry<T> | undefined;
    if (hit && now - hit.at < TTL_MS) return hit.promise;

    const promise = load();
    entries.set(key, { at: now, promise });
    promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
    });
    return promise;
}

export function clearRequestCache(): void {
    entries.clear();
}
