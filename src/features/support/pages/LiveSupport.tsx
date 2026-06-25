import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, User, Clock, CheckCircle2 } from 'lucide-react';
import { useSupportStore } from '../../../store/useSupportStore';
import './LiveSupport.css';

const LiveSupport: React.FC = () => {
    // All realtime state lives in the shared support store (single SignalR connection,
    // initialized in Layout). This page is just a view + actions over it.
    const sessions = useSupportStore(s => s.sessions);
    const messages = useSupportStore(s => s.messages);
    const activeSession = useSupportStore(s => s.activeSession);
    const connected = useSupportStore(s => s.connected);
    const selectSession = useSupportStore(s => s.selectSession);
    const sendMessage = useSupportStore(s => s.sendMessage);
    const closeSession = useSupportStore(s => s.closeSession);

    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        const text = newMessage.trim();
        if (!text) return;
        setNewMessage('');
        await sendMessage(text);
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
                                className={`session-item ${activeSession?.sessionId === session.sessionId ? 'selected' : ''}`}
                                onClick={() => selectSession(session)}
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
                {activeSession ? (
                    <>
                        <div className="chat-header">
                            <div className="guest-details">
                                <h3>Chat with {activeSession.guestId.substring(0, 8)}</h3>
                                <p>Session ID: {activeSession.sessionId}</p>
                            </div>
                            <button className="close-session-btn" onClick={() => closeSession(activeSession.sessionId)}>
                                <CheckCircle2 size={18} />
                                Close Session
                            </button>
                        </div>
                        <div className="messages-container">
                            {messages.map((msg) => (
                                <div key={msg.messageId} className={`message-wrapper ${msg.senderType === 'Agent' ? 'agent' : 'guest'}`}>
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
                                placeholder={connected ? "Type a response..." : "Connecting to server..."}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                disabled={!connected}
                            />
                            <button onClick={handleSendMessage} disabled={!connected || !newMessage.trim()}>
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
