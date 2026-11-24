import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../services/endpoints';

/**
 * People's photos. The API needs the sign-in token, so a plain <img src> can't load them: each
 * photo is fetched once as a blob and kept as an object URL for this browser tab. The version in
 * the key changes whenever the photo changes, so a new photo is fetched and the old one dropped.
 */
const cache = new Map<string, Promise<string | null>>();
const key = (userId: string, version: string) => `${userId}:${version}`;

export function photoUrl(userId: string, version: string): Promise<string | null> {
    const k = key(userId, version);
    let found = cache.get(k);
    if (!found) {
        found = api.get<Blob>(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/photo`, { params: { v: version }, responseType: 'blob' })
            .then(r => URL.createObjectURL(r.data))
            .catch(() => null);
        cache.set(k, found);
    }
    return found;
}

/** Shows a photo the person just chose without fetching it again. */
export function rememberPhoto(userId: string, version: string, blob: Blob) {
    forgetPhotos(userId);
    cache.set(key(userId, version), Promise.resolve(URL.createObjectURL(blob)));
}

/** Drops every kept photo of the person (after a new photo or none). */
export function forgetPhotos(userId: string) {
    for (const [k, url] of cache) {
        if (!k.startsWith(`${userId}:`)) continue;
        cache.delete(k);
        void url.then(u => { if (u) URL.revokeObjectURL(u); });
    }
}

/** The photo's URL, or null while it loads, when there is none, or when it could not be loaded. */
export function useUserPhoto(userId?: string | null, version?: string | null): string | null {
    const [state, setState] = useState<{ k: string; url: string | null } | null>(null);
    const k = userId && version ? key(userId, version) : null;
    useEffect(() => {
        if (!userId || !version) return;
        let live = true;
        void photoUrl(userId, version).then(url => { if (live) setState({ k: key(userId, version), url }); });
        return () => { live = false; };
    }, [userId, version]);
    return k && state?.k === k ? state.url : null;
}
