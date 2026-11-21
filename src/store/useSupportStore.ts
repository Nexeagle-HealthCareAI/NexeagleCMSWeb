import { create } from 'zustand';
import * as signalR from '@microsoft/signalr';
import { toast } from 'sonner';
import { api, SIGNALR_URL } from '../services/api';
import { API_ENDPOINTS } from '../services/endpoints';
import { useAuthStore } from './useAuthStore';

// Live support (agent side). One SignalR connection to CMSAPI's /chathub, opened by Layout only for
// users with live-support.view (the hub refuses everyone else). Event names match Hubs/ChatHub.cs.

export interface Session {
    sessionId: string;
    guestId: string;
    guestName?: string | null;
    guestEmail?: string | null;
    status: string;
    startedAt: string;
    lastMessageText?: string | null;
    lastMessageAt?: string | null;
    lastSenderType?: string | null;
    guestOnline?: boolean;
    /** Guest messages not yet seen by this agent (per chat). */
    unread?: number;
}

export interface Message {
    messageId: string;
    sessionId: string;
    senderType: string;
    senderId?: string;
    messageText: string;
    sentAt: string;
}

export const MAX_MESSAGE_LENGTH = 2000; // ChatHub.MaxMessageLength
const TYPING_SHOW_FOR_MS = 4000;
const TYPING_SEND_EVERY_MS = 2500;
/** Waits between reconnect attempts. The last one repeats for as long as the page is open. */
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 30000];

interface SupportState {
    connection: signalR.HubConnection | null;
    connected: boolean;
    sessions: Session[];
    messages: Message[];
    activeSession: Session | null;
    /** Total unread guest messages across chats (sidebar badge). */
    unreadCount: number;
    /** sessionId -> true while that guest is typing. */
    typing: Record<string, boolean>;
    initConnection: () => void;
    disconnect: () => void;
    selectSession: (session: Session) => Promise<void>;
    clearSelection: () => void;
    sendMessage: (text: string) => Promise<boolean>;
    notifyTyping: () => void;
    closeSession: (sessionId: string) => Promise<void>;
    resetUnread: () => void;
}

/** Name to show for a guest: their name, else their email, else a short id. */
export const guestLabel = (s: Pick<Session, 'guestName' | 'guestEmail' | 'guestId'>): string =>
    s.guestName?.trim() || s.guestEmail?.trim() || `Visitor ${s.guestId.substring(0, 6)}`;

// Most recent activity first.
const byActivity = (a: Session, b: Session) =>
    new Date(b.lastMessageAt ?? b.startedAt).getTime() - new Date(a.lastMessageAt ?? a.startedAt).getTime();

const totalUnread = (sessions: Session[]) => sessions.reduce((n, s) => n + (s.unread ?? 0), 0);

// One shared <audio> element, replayed from the start on each notification.
let notifyAudio: HTMLAudioElement | null = null;
const playNotify = () => {
    try {
        if (!notifyAudio) notifyAudio = new Audio('/notification.mp3');
        notifyAudio.currentTime = 0;
        void notifyAudio.play().catch(() => {});
    } catch {
        /* autoplay blocked / unsupported — ignore */
    }
};

// Native notification, only when the tab is in the background (in-app toasts cover the rest).
const browserNotify = (title: string, body: string) => {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
            new Notification(title, { body });
        }
    } catch {
        /* ignore */
    }
};

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let lastTypingSentAt = 0;
let startTimer: ReturnType<typeof setTimeout> | null = null;
let wakeListener: (() => void) | null = null;

/** A chat whose last message is the visitor's is waiting for an answer. */
const waiting = (s: Pick<Session, 'lastSenderType'>) => (s.lastSenderType === 'Guest' ? 1 : 0);

export const useSupportStore = create<SupportState>((set, get) => ({
    connection: null,
    connected: false,
    sessions: [],
    messages: [],
    activeSession: null,
    unreadCount: 0,
    typing: {},

    initConnection: () => {
        if (get().connection) return;

        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(SIGNALR_URL, { accessTokenFactory: () => useAuthStore.getState().token ?? '' })
            // Never give up: an agent who is silently disconnected shows as "away" to every visitor.
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: ctx => RECONNECT_DELAYS_MS[Math.min(ctx.previousRetryCount, RECONNECT_DELAYS_MS.length - 1)],
            })
            .build();

        const joinAgents = () =>
            connection.invoke('JoinAgentGroup').catch(err => console.error('JoinAgentGroup failed:', err));

        const setGuestTyping = (sessionId: string, on: boolean) =>
            set(state => ({ typing: { ...state.typing, [sessionId]: on } }));

        connection.on('ActiveSessions', (sessions: Session[]) => {
            // Keep unread counts this agent already had for chats that are still open. A chat this
            // agent has not seen yet counts as unread when the visitor wrote last: messages left
            // while nobody was signed in must not sit there unnoticed.
            const previous = new Map(get().sessions.map(s => [s.sessionId, s.unread ?? 0]));
            const openId = get().activeSession?.sessionId;
            const merged = sessions
                .map(s => ({ ...s, unread: s.sessionId === openId ? 0 : previous.get(s.sessionId) ?? waiting(s) }))
                .sort(byActivity);
            set({ sessions: merged, unreadCount: totalUnread(merged) });
        });

        // Sent with the visitor's first message, which is in the summary (lastMessageText).
        connection.on('NewSession', (session: Session) => {
            set(state => {
                if (state.sessions.some(s => s.sessionId === session.sessionId)) return state;
                const sessions = [{ ...session, unread: waiting(session) }, ...state.sessions].sort(byActivity);
                return { sessions, unreadCount: totalUnread(sessions) };
            });
            toast.info(`New chat from ${guestLabel(session)}`, { description: session.lastMessageText || 'A visitor is waiting for support.' });
            playNotify();
            browserNotify('New support chat', `${guestLabel(session)} is waiting for support.`);
        });

        // Agents get SessionUpdate for every message in every chat (their own replies included).
        connection.on('SessionUpdate', (sessionId: string, msg: Message) => {
            const isActive = get().activeSession?.sessionId === sessionId;
            const seen = isActive && !document.hidden;
            const fromGuest = msg.senderType === 'Guest';

            set(state => {
                const sessions = state.sessions
                    .map(s => s.sessionId !== sessionId ? s : {
                        ...s,
                        lastMessageText: msg.messageText,
                        lastMessageAt: msg.sentAt,
                        lastSenderType: msg.senderType,
                        unread: fromGuest && !seen ? (s.unread ?? 0) + 1 : s.unread,
                    })
                    .sort(byActivity);
                return {
                    sessions,
                    unreadCount: totalUnread(sessions),
                    messages: isActive && !state.messages.some(m => m.messageId === msg.messageId)
                        ? [...state.messages, msg]
                        : state.messages,
                    typing: fromGuest ? { ...state.typing, [sessionId]: false } : state.typing,
                };
            });

            if (fromGuest && !seen) {
                const s = get().sessions.find(x => x.sessionId === sessionId);
                const who = s ? guestLabel(s) : 'a visitor';
                toast(`New message from ${who}`, { description: msg.messageText });
                playNotify();
                browserNotify(`Message from ${who}`, msg.messageText);
            }
        });

        connection.on('GuestTyping', (sessionId: string) => {
            setGuestTyping(sessionId, true);
            const old = typingTimers.get(sessionId);
            if (old) clearTimeout(old);
            typingTimers.set(sessionId, setTimeout(() => setGuestTyping(sessionId, false), TYPING_SHOW_FOR_MS));
        });

        connection.on('GuestPresence', (sessionId: string, online: boolean) => {
            set(state => ({
                sessions: state.sessions.map(s => (s.sessionId === sessionId ? { ...s, guestOnline: online } : s)),
                activeSession: state.activeSession?.sessionId === sessionId
                    ? { ...state.activeSession, guestOnline: online }
                    : state.activeSession,
            }));
        });

        connection.on('SessionRemoved', (sessionId: string) => {
            set(state => {
                const sessions = state.sessions.filter(s => s.sessionId !== sessionId);
                return {
                    sessions,
                    unreadCount: totalUnread(sessions),
                    activeSession: state.activeSession?.sessionId === sessionId ? null : state.activeSession,
                    messages: state.activeSession?.sessionId === sessionId ? [] : state.messages,
                };
            });
        });

        connection.onreconnecting(() => set({ connected: false }));
        connection.onreconnected(() => {
            set({ connected: true });
            joinAgents(); // re-register: a reconnect is a fresh connection on the server
        });
        // start() does not retry by itself, and the connection also closes for good when the server
        // refuses a reconnect (an expired sign-in, say). Either way keep trying while this is still
        // the store's connection, so the agent comes back without reloading the page.
        let attempt = 0;
        const start = () => {
            if (get().connection !== connection || connection.state !== signalR.HubConnectionState.Disconnected) return;
            connection
                .start()
                .then(() => {
                    attempt = 0;
                    set({ connected: true });
                    joinAgents();
                })
                .catch(err => {
                    console.error('Support connection error:', err);
                    const delay = RECONNECT_DELAYS_MS[Math.min(++attempt, RECONNECT_DELAYS_MS.length - 1)];
                    if (startTimer) clearTimeout(startTimer);
                    startTimer = setTimeout(start, delay);
                });
        };
        connection.onclose(() => {
            set({ connected: false });
            if (startTimer) clearTimeout(startTimer);
            startTimer = setTimeout(start, RECONNECT_DELAYS_MS[1]);
        });

        // Back on the network or back on this tab: try at once instead of waiting out the delay.
        wakeListener = () => { if (!document.hidden) start(); };
        window.addEventListener('online', wakeListener);
        document.addEventListener('visibilitychange', wakeListener);

        set({ connection });
        start();
    },

    disconnect: () => {
        const { connection } = get();
        // Cleared first, so the close that follows does not start it again.
        set({ connection: null });
        if (startTimer) { clearTimeout(startTimer); startTimer = null; }
        if (wakeListener) {
            window.removeEventListener('online', wakeListener);
            document.removeEventListener('visibilitychange', wakeListener);
            wakeListener = null;
        }
        if (connection) void connection.stop().catch(() => {});
        typingTimers.forEach(t => clearTimeout(t));
        typingTimers.clear();
        set({ connection: null, connected: false, sessions: [], messages: [], activeSession: null, unreadCount: 0, typing: {} });
    },

    selectSession: async (session: Session) => {
        set(state => {
            const sessions = state.sessions.map(s => (s.sessionId === session.sessionId ? { ...s, unread: 0 } : s));
            return { activeSession: { ...session, unread: 0 }, messages: [], sessions, unreadCount: totalUnread(sessions) };
        });
        try {
            const res = await api.get<Message[]>(`${API_ENDPOINTS.CHAT.HISTORY}/${session.sessionId}`);
            // Ignore the result if the agent switched chats while history was loading; keep anything
            // that arrived over the hub meanwhile.
            if (get().activeSession?.sessionId === session.sessionId) {
                set(state => {
                    const known = new Set(res.data.map(m => m.messageId));
                    return { messages: [...res.data, ...state.messages.filter(m => !known.has(m.messageId))] };
                });
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
            toast.error('Could not load this chat. Try selecting it again.');
        }
    },

    clearSelection: () => set({ activeSession: null, messages: [] }),

    sendMessage: async (text: string) => {
        const { connection, connected, activeSession } = get();
        const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!connection || !connected || !activeSession || !trimmed) return false;
        try {
            // senderType/senderId are derived server-side from the auth context.
            await connection.invoke('SendMessage', activeSession.sessionId, trimmed);
            return true;
        } catch (e) {
            console.error('Failed to send message:', e);
            toast.error('Message not sent. Check your connection and try again.');
            return false;
        }
    },

    notifyTyping: () => {
        const { connection, connected, activeSession } = get();
        const now = Date.now();
        if (!connection || !connected || !activeSession || now - lastTypingSentAt < TYPING_SEND_EVERY_MS) return;
        lastTypingSentAt = now;
        connection.invoke('Typing', activeSession.sessionId).catch(() => {});
    },

    closeSession: async (sessionId: string) => {
        const { connection } = get();
        if (!connection) return;
        try {
            await connection.invoke('CloseSession', sessionId);
        } catch (e) {
            console.error('Failed to close session:', e);
            toast.error('Could not end the chat. Try again.');
        }
    },

    resetUnread: () => {
        // Kept for callers; it no longer clears anything. The badge is the number of unanswered
        // visitor messages, and it used to drop to zero on a click on the menu item while the chats
        // themselves stayed unread, then jump back with the next message. Opening a chat clears it.
    },
}));
