import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { MessageSquare, Send, User, Clock, CheckCircle2 } from 'lucide-react';
import './LiveSupport.css';

const API_BASE_URL = 'http://localhost:5000'; // Update with actual API URL

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

const LiveSupport: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const selectedSessionRef = useRef<Session | null>(null);
    const notificationSound = useRef<HTMLAudioElement | null>(null);

    // Update ref whenever state changes
    useEffect(() => {
        selectedSessionRef.current = selectedSession;
    }, [selectedSession]);

    // Initialize notification sound
    useEffect(() => {
        notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        
        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const playNotificationSound = () => {
        if (notificationSound.current) {
            notificationSound.current.play().catch(e => console.error("Error playing sound:", e));
        }
    };

    const showBrowserNotification = (title: string, body: string) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/vite.svg' // You can use a specific chat icon here
            });
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}/chathub`)
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);

        return () => {
            newConnection.stop();
        };
    }, []);

    useEffect(() => {
        if (connection) {
            connection.start()
                .then(() => {
                    console.log('Connected to ChatHub as Agent');
                    connection.invoke('JoinAgentGroup');

                    connection.on('ActiveSessions', (activeSessions: Session[]) => {
                        setSessions(activeSessions);
                    });

                    connection.on('NewSession', (session: Session) => {
                        setSessions(prev => {
                            if (prev.find(s => s.sessionId === session.sessionId)) return prev;
                            return [session, ...prev];
                        });
                        
                        // Notify agent of new session
                        playNotificationSound();
                        showBrowserNotification('New Support Session', `A new guest is waiting for support.`);
                    });

                    connection.on('ReceiveMessage', (msg: Message) => {
                        // Check if message is from Guest
                        if (msg.senderType === 'Guest') {
                            playNotificationSound();
                            
                            // Show notification if session not selected or window not focused
                            if (selectedSessionRef.current?.sessionId !== msg.sessionId || document.hidden) {
                                showBrowserNotification('New Message', msg.messageText);
                            }
                        }

                        if (selectedSessionRef.current?.sessionId === msg.sessionId) {
                            setMessages(prev => [...prev, msg]);
                        }
                    });

                    connection.on('SessionUpdate', (sessionId: string, lastMsg: Message) => {
                        console.log('Session updated:', sessionId, lastMsg);
                    });

                    connection.on('SessionRemoved', (sessionId: string) => {
                        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
                        if (selectedSessionRef.current?.sessionId === sessionId) {
                            setSelectedSession(null);
                            setMessages([]);
                        }
                    });
                })
                .catch(err => console.error('SignalR Connection Error: ', err));
        }

        return () => {
            if (connection) {
                connection.off('ActiveSessions');
                connection.off('NewSession');
                connection.off('ReceiveMessage');
                connection.off('SessionUpdate');
                connection.off('SessionRemoved');
            }
        };
    }, [connection]);

    const handleSelectSession = async (session: Session) => {
        setSelectedSession(session);
        // Joining the specific session group to receive its messages
        if (connection) {
            await connection.invoke('SendMessage', session.sessionId, '', 'System', 'Agent_Preview'); // Dummy to join group or handle history
            // Actually, we should probably have a GetHistory method or similar.
            // For now, let's assume we can fetch it via REST or add a Hub method.
            try {
                const response = await fetch(`${API_BASE_URL}/api/chat/history/${session.sessionId}`);
                if (response.ok) {
                    const history = await response.json();
                    setMessages(history);
                }
            } catch (e) {
                console.error("Failed to fetch history", e);
            }
        }
    };

    const handleSendMessage = async () => {
        if (newMessage.trim() && selectedSession && connection) {
            try {
                await connection.invoke('SendMessage', selectedSession.sessionId, newMessage, 'Agent', 'Agent_User');
                setNewMessage('');
            } catch (e) {
                console.error("Error sending message", e);
            }
        }
    };

    const handleCloseSession = async (sessionId: string) => {
        if (connection) {
            await connection.invoke('CloseSession', sessionId);
        }
    };

    return (
        <div className="live-support-container">
            <div className="support-sidebar">
                <div className="sidebar-header">
                    <h2>Live Support</h2>
                    <span className="active-count">{sessions.length} Active</span>
                </div>
                <div className="session-list">
                    {sessions.length === 0 ? (
                        <div className="empty-state">No active sessions</div>
                    ) : (
                        sessions.map(session => (
                            <div 
                                key={session.sessionId} 
                                className={`session-item ${selectedSession?.sessionId === session.sessionId ? 'selected' : ''}`}
                                onClick={() => handleSelectSession(session)}
                            >
                                <div className="session-icon">
                                    <User size={20} />
                                </div>
                                <div className="session-info">
                                    <div className="guest-id">Guest: {session.guestId.substring(0, 8)}</div>
                                    <div className="started-at">
                                        <Clock size={12} />
                                        {new Date(session.startedAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="chat-area">
                {selectedSession ? (
                    <>
                        <div className="chat-header">
                            <div className="guest-details">
                                <h3>Chat with {selectedSession.guestId.substring(0, 8)}</h3>
                                <p>Session ID: {selectedSession.sessionId}</p>
                            </div>
                            <button className="close-session-btn" onClick={() => handleCloseSession(selectedSession.sessionId)}>
                                <CheckCircle2 size={18} />
                                Close Session
                            </button>
                        </div>
                        <div className="messages-container">
                            {messages.map((msg, index) => (
                                <div key={index} className={`message-wrapper ${msg.senderType === 'Agent' ? 'agent' : 'guest'}`}>
                                    <div className="message-bubble">
                                        <p>{msg.messageText}</p>
                                        <span className="timestamp">
                                            {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="chat-input-container">
                            <input 
                                type="text" 
                                placeholder="Type a response..." 
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                                <Send size={20} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <MessageSquare size={48} />
                        <p>Select a session to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveSupport;
