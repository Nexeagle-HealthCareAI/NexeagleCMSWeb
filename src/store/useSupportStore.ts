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
            .withAutomaticReconnect()
            .build();

        const joinAgents = () =>
            connection.invoke('JoinAgentGroup').catch(err => console.error('JoinAgentGroup failed:', err));

        const setGuestTyping = (sessionId: string, on: boolean) =>
            set(state => ({ typing: { ...state.typing, [sessionId]: on } }));

        connection.on('ActiveSessions', (sessions: Session[]) => {
            // Keep unread counts this agent already had for chats that are still open.
            const previous = new Map(get().sessions.map(s => [s.sessionId, s.unread ?? 0]));
            const merged = sessions.map(s => ({ ...s, unread: previous.get(s.sessionId) ?? 0 })).sort(byActivity);
            set({ sessions: merged, unreadCount: totalUnread(merged) });
        });

        connection.on('NewSession', (session: Session) => {
            set(state =>
                state.sessions.some(s => s.sessionId === session.sessionId)
                    ? state
                    : { sessions: [{ ...session, unread: 0 }, ...state.sessions].sort(byActivity) }
            );
            toast.info(`New chat from ${guestLabel(session)}`, { description: 'A visitor is waiting for support.' });
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
        connection.onclose(() => set({ connected: false }));

        connection
            .start()
            .then(() => {
                set({ connected: true });
                joinAgents();
            })
            .catch(err => console.error('Support connection error:', err));

        set({ connection });
    },

    disconnect: () => {
        const { connection } = get();
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
        // Sidebar "seen" action: clears the badge without marking individual chats as read.
        set({ unreadCount: 0 });
    },
}));
