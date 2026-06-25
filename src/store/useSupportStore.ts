import { create } from 'zustand';
import * as signalR from '@microsoft/signalr';
import { toast } from 'sonner';
import { api, SIGNALR_URL } from '../services/api';
import { API_ENDPOINTS } from '../services/endpoints';
import { useAuthStore } from './useAuthStore';

export interface Session {
    sessionId: string;
    guestId: string;
    guestName?: string;
    guestEmail?: string;
    status: string;
    startedAt: string;
}

export interface Message {
    messageId: string;
    sessionId: string;
    senderType: string;
    senderId?: string;
    messageText: string;
    sentAt: string;
}

interface SupportState {
    connection: signalR.HubConnection | null;
    connected: boolean;
    sessions: Session[];
    messages: Message[];
    activeSession: Session | null;
    unreadCount: number;
    initConnection: () => void;
    selectSession: (session: Session) => Promise<void>;
    clearSelection: () => void;
    sendMessage: (text: string) => Promise<void>;
    closeSession: (sessionId: string) => Promise<void>;
    resetUnread: () => void;
}

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

export const useSupportStore = create<SupportState>((set, get) => ({
    connection: null,
    connected: false,
    sessions: [],
    messages: [],
    activeSession: null,
    unreadCount: 0,

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

        connection.on('ActiveSessions', (sessions: Session[]) => set({ sessions }));

        connection.on('NewSession', (session: Session) => {
            set(state =>
                state.sessions.some(s => s.sessionId === session.sessionId)
                    ? state
                    : { sessions: [session, ...state.sessions], unreadCount: state.unreadCount + 1 }
            );
            toast.info(`New chat from Guest ${session.guestId.substring(0, 5)}`, {
                description: 'A new guest is waiting for support.',
            });
            playNotify();
            browserNotify('New Support Session', 'A new guest is waiting for support.');
        });

        // Agents sit in the "Agents" group and get SessionUpdate for every message in any
        // session (ReceiveMessage targets the per-session group, i.e. the guest).
        connection.on('SessionUpdate', (sessionId: string, msg: Message) => {
            const isActive = get().activeSession?.sessionId === sessionId;
            if (isActive) {
                set(state => ({ messages: [...state.messages, msg] }));
            }
            if (msg.senderType === 'Guest' && (!isActive || document.hidden)) {
                set(state => ({ unreadCount: state.unreadCount + 1 }));
                toast(`New message from Guest ${(msg.senderId ?? '').substring(0, 5)}`, {
                    description: msg.messageText,
                });
                playNotify();
                browserNotify('New Message', msg.messageText);
            }
        });

        connection.on('SessionRemoved', (sessionId: string) => {
            set(state => ({
                sessions: state.sessions.filter(s => s.sessionId !== sessionId),
                activeSession: state.activeSession?.sessionId === sessionId ? null : state.activeSession,
                messages: state.activeSession?.sessionId === sessionId ? [] : state.messages,
            }));
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

    selectSession: async (session: Session) => {
        set({ activeSession: session, messages: [] });
        try {
            const res = await api.get<Message[]>(`${API_ENDPOINTS.CHAT.HISTORY}/${session.sessionId}`);
            // Ignore the result if the agent switched sessions while history was loading.
            if (get().activeSession?.sessionId === session.sessionId) {
                set({ messages: res.data });
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
    },

    clearSelection: () => set({ activeSession: null, messages: [] }),

    sendMessage: async (text: string) => {
        const { connection, connected, activeSession } = get();
        const trimmed = text.trim();
        if (!connection || !connected || !activeSession || !trimmed) return;
        try {
            // senderType/senderId are derived server-side from the auth context.
            await connection.invoke('SendMessage', activeSession.sessionId, trimmed);
        } catch (e) {
            console.error('Failed to send message:', e);
        }
    },

    closeSession: async (sessionId: string) => {
        const { connection } = get();
        if (!connection) return;
        try {
            await connection.invoke('CloseSession', sessionId);
        } catch (e) {
            console.error('Failed to close session:', e);
        }
    },

    resetUnread: () => set({ unreadCount: 0 }),
}));
