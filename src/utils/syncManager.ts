/* syncManager.ts - Background synchronization manager for offline mutations */

import axios from 'axios';
import { api } from '../services/api';
import { toast } from 'sonner';

export interface QueuedMutation {
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body: any;
    description: string;
    timestamp: number;
}

const QUEUE_KEY = 'nexeagle-cms-sync-queue';
const SYNC_LOCK = 'nexeagle-cms-sync';
let activeSync: Promise<void> | null = null;

export const syncManager = {
    getQueue(): QueuedMutation[] {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse sync queue:', e);
            return [];
        }
    },

    saveQueue(queue: QueuedMutation[]): void {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            // Dispatch custom event to notify UI components of queue status changes
            window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: { count: queue.length } }));
        } catch (e) {
            console.error('Failed to save sync queue:', e);
        }
    },

    enqueue(url: string, method: QueuedMutation['method'], body: any, description: string = 'Operation'): void {
        const queue = this.getQueue();
        
        // Check if an identical operation is already queued to avoid duplicates
        const isDuplicate = queue.some(item => 
            item.url === url && 
            item.method === method && 
            JSON.stringify(item.body) === JSON.stringify(body)
        );

        if (isDuplicate) {
            console.log('[Sync Manager] Duplicate request ignored:', url);
            return;
        }

        const newMutation: QueuedMutation = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url,
            method,
            body,
            description,
            timestamp: Date.now()
        };

        queue.push(newMutation);
        this.saveQueue(queue);

        console.log(`[Sync Manager] Enqueued mutation: ${description} (${method} ${url})`);
        toast.info(`Offline: "${description}" will sync when connection is restored.`, {
            duration: 5000,
            position: 'bottom-center'
        });
    },

    /** Drop one item from the stored queue, re-reading it so mutations enqueued mid-sync survive. */
    remove(id: string): void {
        this.saveQueue(this.getQueue().filter(item => item.id !== id));
    },

    clear(): void {
        try {
            localStorage.removeItem(QUEUE_KEY);
        } catch {
            /* ignore */
        }
        window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: { count: 0 } }));
    },

    /**
     * Replays queued mutations once. Concurrent calls in this tab share one run, and other tabs are
     * kept out with a Web Lock, so the same queued mutation is never sent twice at the same time.
     */
    sync(): Promise<void> {
        if (activeSync) return activeSync;
        const run = () => this.runSync();
        const locks: LockManager | undefined = typeof navigator !== 'undefined' ? navigator.locks : undefined;
        const pending: Promise<void> = locks
            ? locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock): Promise<void> => { if (lock) await run(); }).then(() => undefined)
            : run();
        activeSync = pending.finally(() => { activeSync = null; });
        return activeSync;
    },

    async runSync(): Promise<void> {
        const queue = this.getQueue();
        if (queue.length === 0) return;

        if (!navigator.onLine) {
            console.log('[Sync Manager] Offline. Delaying synchronization...');
            return;
        }

        console.log(`[Sync Manager] Starting background sync of ${queue.length} operations...`);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
        toast.loading('Syncing offline updates...', { id: 'sync-status-toast', position: 'bottom-center' });

        let successCount = 0;
        try {
            for (const item of queue) {
                try {
                    await api.request({
                        url: item.url,
                        method: item.method,
                        data: item.body,
                        // Same key on every retry of this item, so a server that honours it can drop repeats.
                        headers: { 'Idempotency-Key': item.id },
                    });
                    successCount++;
                    this.remove(item.id); // remove as soon as it lands, not after the whole batch
                    console.log(`[Sync Manager] Successfully synced: ${item.description}`);
                } catch (err) {
                    console.error(`[Sync Manager] Sync failed for item ${item.description}:`, err);
                    // A client-side rejection (400, 422 ...) will never succeed: drop it and say so.
                    // Server errors and network loss stay queued for the next attempt.
                    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
                    if (status !== undefined && status >= 400 && status < 500) {
                        this.remove(item.id);
                        toast.error(`Sync error: ${item.description} was rejected by server.`, { position: 'bottom-center' });
                    }
                }
            }
        } finally {
            window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'idle' } }));
        }

        if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} operation(s) in background!`, {
                id: 'sync-status-toast',
                duration: 4000,
                position: 'bottom-center'
            });
            window.dispatchEvent(new CustomEvent('sync-completed'));
        } else {
            toast.dismiss('sync-status-toast');
        }
    }
};

// Setup online listener to trigger background syncing automatically
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Sync Manager] Network restored. Triggering sync...');
        // Wait a second for connection to stabilize
        setTimeout(() => syncManager.sync(), 1000);
    });
}
