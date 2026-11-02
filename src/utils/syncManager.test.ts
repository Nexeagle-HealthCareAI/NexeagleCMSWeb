import { describe, it, expect, beforeEach, vi } from 'vitest';

const request = vi.fn();
vi.mock('../services/api', () => ({ api: { request: (...args: unknown[]) => request(...args) } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }) }));

import { syncManager } from './syncManager';

describe('syncManager', () => {
    beforeEach(() => {
        localStorage.clear();
        request.mockReset();
    });

    it('sends each queued mutation once even when sync() is triggered twice', async () => {
        let release!: () => void;
        request.mockImplementation(() => new Promise<void>(r => { release = r; }).then(() => ({ status: 200 })));
        syncManager.enqueue('/SubscriptionApproval/h1/approve', 'POST', {}, 'Approve');

        const first = syncManager.sync();
        const second = syncManager.sync();          // e.g. two 'online' listeners firing
        await Promise.resolve();
        release();
        await Promise.all([first, second]);

        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][0].headers['Idempotency-Key']).toBeTruthy();
        expect(syncManager.getQueue()).toHaveLength(0);
    });

    it('drops 4xx rejections, keeps server errors, and keeps items queued during the sync', async () => {
        syncManager.enqueue('/a', 'POST', { n: 1 }, 'A');
        syncManager.enqueue('/b', 'POST', { n: 2 }, 'B');
        request
            .mockImplementationOnce(() => {
                syncManager.enqueue('/c', 'POST', { n: 3 }, 'C');   // queued while syncing
                return Promise.reject({ isAxiosError: true, response: { status: 422 } });
            })
            .mockImplementationOnce(() => Promise.reject({ isAxiosError: true, response: { status: 503 } }));

        await syncManager.sync();

        expect(syncManager.getQueue().map(i => i.url)).toEqual(['/b', '/c']);
    });
});
