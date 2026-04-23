import { create } from 'zustand';
import * as signalR from '@microsoft/signalr';
import { toast } from 'sonner';

interface Session {
    sessionId: string;
    guestId: string;
    guestName?: string;
    guestEmail?: string;
    status: string;
    startedAt: string;
}

interface Message {
    messageId: string;
    sessionId: string;
    senderType: string;
    senderId?: string;
    messageText: string;
    sentAt: string;
}

interface SupportState {
    sessions: Session[];
    unreadCount: number;
    connection: signalR.HubConnection | null;
    initConnection: (url: string) => void;
    setSessions: (sessions: Session[]) => void;
    incrementUnread: () => void;
    resetUnread: () => void;
}

export const useSupportStore = create<SupportState>((set, get) => ({
    sessions: [],
    unreadCount: 0,
    connection: null,

    initConnection: (url: string) => {
        if (get().connection) return;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(url)
            .withAutomaticReconnect()
            .build();

        connection.on('NewSession', (session: Session) => {
            set(state => ({
                sessions: [session, ...state.sessions],
                unreadCount: state.unreadCount + 1
            }));
            toast.info(`New chat session from Guest ${session.guestId.substring(0, 5)}`, {
                description: 'A new guest is waiting for support.'
            });
            // Play notification sound
            new Audio('/notification.mp3').play().catch(() => {});
        });

        connection.on('ReceiveMessage', (msg: Message) => {
            if (msg.senderType === 'Guest') {
                set(state => ({ unreadCount: state.unreadCount + 1 }));
                toast(`New message from ${msg.senderId?.substring(0, 5) || 'Guest'}`, {
                    description: msg.messageText
                });
                new Audio('/notification.mp3').play().catch(() => {});
            }
        });

        connection.on('ActiveSessions', (sessions: Session[]) => {
            set({ sessions });
        });

        connection.start().then(() => {
            connection.invoke('JoinAgentGroup');
        }).catch(err => console.error('Support Connection Error: ', err));

        set({ connection });
    },

    setSessions: (sessions: Session[]) => set({ sessions }),
    incrementUnread: () => set(state => ({ unreadCount: state.unreadCount + 1 })),
    resetUnread: () => set({ unreadCount: 0 })
}));
