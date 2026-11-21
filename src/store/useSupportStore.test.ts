import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the SignalR connection: the test fires server events and decides whether start() works.
const hub = vi.hoisted(() => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const state = {
        handlers,
        startResults: [] as boolean[],
        starts: 0,
        invoked: [] as string[],
        state: 'Disconnected',
        retryPolicy: null as null | { nextRetryDelayInMilliseconds: (ctx: { previousRetryCount: number }) => number | null },
        onclose: null as null | (() => void),
        onreconnected: null as null | (() => void),
        fire: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
    };
    return state;
});

vi.mock('@microsoft/signalr', () => {
    const connection = {
        get state() { return hub.state; },
        on: (event: string, fn: (...args: unknown[]) => void) => { hub.handlers.set(event, fn); },
        onreconnecting: () => undefined,
        onreconnected: (fn: () => void) => { hub.onreconnected = fn; },
        onclose: (fn: () => void) => { hub.onclose = fn; },
        start: () => {
            hub.starts++;
            const ok = hub.startResults.length ? hub.startResults.shift() : true;
            if (ok) { hub.state = 'Connected'; return Promise.resolve(); }
            return Promise.reject(new Error('down'));
        },
        stop: () => { hub.state = 'Disconnected'; return Promise.resolve(); },
        invoke: (method: string) => { hub.invoked.push(method); return Promise.resolve(); },
    };
    class HubConnectionBuilder {
        withUrl() { return this; }
        withAutomaticReconnect(policy: typeof hub.retryPolicy) { hub.retryPolicy = policy; return this; }
        build() { return connection; }
    }
    return { HubConnectionBuilder, HubConnectionState: { Disconnected: 'Disconnected', Connected: 'Connected' } };
});
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn() }) }));
vi.mock('../services/api', () => ({ api: { get: vi.fn().mockResolvedValue({ data: [] }) }, SIGNALR_URL: 'http://test/chathub' }));

import { useSupportStore, type Session } from './useSupportStore';

const session = (id: string, over: Partial<Session> = {}): Session => ({
    sessionId: id, guestId: `guest-${id}-0000`, guestName: `Visitor ${id}`, status: 'Active', startedAt: '2026-11-21T08:00:00Z', ...over,
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
    vi.useFakeTimers();
    hub.handlers.clear(); hub.startResults = []; hub.starts = 0; hub.invoked = []; hub.state = 'Disconnected';
});
afterEach(() => {
    useSupportStore.getState().disconnect();
    vi.useRealTimers();
});

describe('support store', () => {
    it('counts chats left waiting while nobody was signed in', async () => {
        useSupportStore.getState().initConnection();
        await flush();

        hub.fire('ActiveSessions', [
            session('a', { lastSenderType: 'Guest', lastMessageText: 'Anyone there?', lastMessageAt: '2026-11-21T09:00:00Z' }),
            session('b', { lastSenderType: 'Agent', lastMessageText: 'Sent you the quote', lastMessageAt: '2026-11-21T09:05:00Z' }),
        ]);

        const state = useSupportStore.getState();
        expect(state.unreadCount).toBe(1);
        expect(state.sessions.find(s => s.sessionId === 'a')?.unread).toBe(1);
        expect(state.sessions.find(s => s.sessionId === 'b')?.unread).toBe(0);
    });

    it('keeps what was already read when the list is sent again after a reconnect', async () => {
        useSupportStore.getState().initConnection();
        await flush();
        const waiting = session('a', { lastSenderType: 'Guest', lastMessageAt: '2026-11-21T09:00:00Z' });
        hub.fire('ActiveSessions', [waiting]);
        await useSupportStore.getState().selectSession(useSupportStore.getState().sessions[0]);
        expect(useSupportStore.getState().unreadCount).toBe(0);

        hub.fire('ActiveSessions', [waiting]);

        expect(useSupportStore.getState().unreadCount).toBe(0);
    });

    it('shows a new chat as unread, with its first message', async () => {
        useSupportStore.getState().initConnection();
        await flush();

        hub.fire('NewSession', session('n', { lastSenderType: 'Guest', lastMessageText: 'Need pricing', lastMessageAt: '2026-11-21T10:00:00Z' }));

        const state = useSupportStore.getState();
        expect(state.sessions[0].lastMessageText).toBe('Need pricing');
        expect(state.unreadCount).toBe(1);
    });

    it('does not clear the badge when the menu item is clicked', async () => {
        useSupportStore.getState().initConnection();
        await flush();
        hub.fire('ActiveSessions', [session('a', { lastSenderType: 'Guest' })]);

        useSupportStore.getState().resetUnread();

        expect(useSupportStore.getState().unreadCount).toBe(1);
    });

    it('keeps trying when the first connection fails, then joins as an agent', async () => {
        hub.startResults = [false, false, true];
        useSupportStore.getState().initConnection();
        await flush();
        expect(useSupportStore.getState().connected).toBe(false);

        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(5000);
        await flush();

        expect(hub.starts).toBe(3);
        expect(useSupportStore.getState().connected).toBe(true);
        expect(hub.invoked).toContain('JoinAgentGroup');
    });

    it('never gives up reconnecting, and starts again after the connection closes for good', async () => {
        useSupportStore.getState().initConnection();
        await flush();
        expect(hub.retryPolicy?.nextRetryDelayInMilliseconds({ previousRetryCount: 0 })).toBe(0);
        expect(hub.retryPolicy?.nextRetryDelayInMilliseconds({ previousRetryCount: 500 })).toBe(30000);

        hub.state = 'Disconnected';
        hub.onclose?.();
        expect(useSupportStore.getState().connected).toBe(false);
        await vi.advanceTimersByTimeAsync(2000);
        await flush();

        expect(hub.starts).toBe(2);
        expect(useSupportStore.getState().connected).toBe(true);
    });

    it('stops for good on sign-out', async () => {
        useSupportStore.getState().initConnection();
        await flush();

        useSupportStore.getState().disconnect();
        hub.onclose?.();
        await vi.advanceTimersByTimeAsync(60000);

        expect(hub.starts).toBe(1);
        expect(useSupportStore.getState().connection).toBeNull();
    });
});
