/* syncManager.ts - Background synchronization manager for offline mutations */

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

    async sync(): Promise<void> {
        const queue = this.getQueue();
        if (queue.length === 0) return;

        if (!navigator.onLine) {
            console.log('[Sync Manager] Offline. Delaying synchronization...');
            return;
        }

        console.log(`[Sync Manager] Starting background sync of ${queue.length} operations...`);
        
        // Dispatch event indicating syncing has started
        window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'syncing' } }));
        toast.loading('Syncing offline updates...', { id: 'sync-status-toast', position: 'bottom-center' });

        const failedItems: QueuedMutation[] = [];
        let successCount = 0;

        for (const item of queue) {
            try {
                // Execute using the authenticated api client
                await api.request({
                    url: item.url,
                    method: item.method,
                    data: item.body
                });
                successCount++;
                console.log(`[Sync Manager] Successfully synced: ${item.description}`);
            } catch (err: any) {
                console.error(`[Sync Manager] Sync failed for item ${item.description}:`, err);
                
                // If it is a client-side validation error (400, 422, etc.), don't keep retrying it
                if (err.response && err.response.status >= 400 && err.response.status < 500) {
                    toast.error(`Sync error: ${item.description} was rejected by server.`, { position: 'bottom-center' });
                } else {
                    // Keep server errors (500, network loss) in the queue to retry later
                    failedItems.push(item);
                }
            }
        }

        this.saveQueue(failedItems);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: { status: 'idle' } }));

        if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} operation(s) in background!`, {
                id: 'sync-status-toast',
                duration: 4000,
                position: 'bottom-center'
            });
            // Force a reload of the current page's data
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
