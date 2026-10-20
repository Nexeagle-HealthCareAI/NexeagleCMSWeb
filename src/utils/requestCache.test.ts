import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { memoGet, clearRequestCache, TTL_MS, isMemoCacheable } from './requestCache';
import { api } from '../services/api';

describe('memoGet', () => {
    beforeEach(() => clearRequestCache());

    it('shares one load between concurrent and repeat callers within the TTL', async () => {
        const load = vi.fn(() => Promise.resolve(1));
        await Promise.all([memoGet('k', load, 0), memoGet('k', load, 10)]);
        await memoGet('k', load, TTL_MS - 1);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('reloads after the TTL and never keeps a failed load', async () => {
        const load = vi.fn(() => Promise.resolve(1));
        await memoGet('k', load, 0);
        await memoGet('k', load, TTL_MS + 1);
        expect(load).toHaveBeenCalledTimes(2);

        const failing = vi.fn(() => Promise.reject(new Error('down')));
        await expect(memoGet('f', failing, 0)).rejects.toThrow('down');
        await expect(memoGet('f', failing, 1)).rejects.toThrow('down');
        expect(failing).toHaveBeenCalledTimes(2);
    });

    it('never caches auth or chat calls', () => {
        expect(isMemoCacheable('/auth/me')).toBe(false);
        expect(isMemoCacheable('../chat/history/abc')).toBe(false);
        expect(isMemoCacheable('/insights/searches')).toBe(true);
    });
});

describe('api.get cache', () => {
    beforeEach(() => clearRequestCache());

    it('serves repeat GETs from memory and refetches after a successful change', async () => {
        const adapter = vi.fn<AxiosAdapter>(async (config: InternalAxiosRequestConfig) =>
            ({ data: { url: config.url }, status: 200, statusText: 'OK', headers: {}, config }));
        api.defaults.adapter = adapter;

        await api.get('/insights/searches', { params: { page: 1 } });
        await api.get('/insights/searches', { params: { page: 1 } });
        expect(adapter).toHaveBeenCalledTimes(1);

        await api.get('/insights/searches', { params: { page: 2 } });   // different params = different entry
        expect(adapter).toHaveBeenCalledTimes(2);

        await api.post('/symptom-router/retrain', {});
        await api.get('/insights/searches', { params: { page: 1 } });
        expect(adapter).toHaveBeenCalledTimes(4);                      // post + fresh get
    });
});
