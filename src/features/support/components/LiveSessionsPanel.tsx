import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, CheckCircle2, ChevronLeft, Mail, Search } from 'lucide-react';
import { useSupportStore, guestLabel, MAX_MESSAGE_LENGTH, type Session } from '../../../store/useSupportStore';
import '../pages/LiveSupport.css';

const initials = (s: Session) =>
    guestLabel(s).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

const timeAgo = (iso?: string | null) => {
    if (!iso) return '';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const LiveSessionsPanel: React.FC = () => {
    // All realtime state lives in the shared support store (one SignalR connection, opened in
    // Layout for users with live-support.view). This panel is a view + actions over it.
    const sessions = useSupportStore(s => s.sessions);
    const messages = useSupportStore(s => s.messages);
    const activeSession = useSupportStore(s => s.activeSession);
    const connected = useSupportStore(s => s.connected);
    const typing = useSupportStore(s => s.typing);
    const selectSession = useSupportStore(s => s.selectSession);
    const sendMessage = useSupportStore(s => s.sendMessage);
    const notifyTyping = useSupportStore(s => s.notifyTyping);
    const closeSession = useSupportStore(s => s.closeSession);
    const clearSelection = useSupportStore(s => s.clearSelection);

    const [draft, setDraft] = useState('');
    const [filter, setFilter] = useState('');
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // The session list holds the live presence; the selected copy may be older.
    const current = activeSession ? sessions.find(s => s.sessionId === activeSession.sessionId) ?? activeSession : null;
    const guestTyping = current ? !!typing[current.sessionId] : false;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, guestTyping]);

    // Another chat selected: reset the composer (React's "adjust state while rendering" pattern),
    // then focus it once rendered.
    const activeId = activeSession?.sessionId;
    const [shownId, setShownId] = useState(activeId);
    if (shownId !== activeId) {
        setShownId(activeId);
        setConfirmEnd(false);
        setDraft('');
    }
    useEffect(() => {
        if (activeId) inputRef.current?.focus();
    }, [activeId]);

    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, [draft]);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        if (!(await sendMessage(text))) setDraft(text); // keep the text if it did not go out
    };

    const visible = filter.trim()
        ? sessions.filter(s => `${guestLabel(s)} ${s.guestEmail ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase()))
        : sessions;

    return (
        <div className={`live-support-container ${isMobile ? 'mobile' : ''} ${activeSession ? 'chat-open' : ''}`}>
            <div className="support-sidebar">
                <div className="sidebar-header">
                    <h2>Live chats</h2>
                    <span className={`active-count ${connected ? '' : 'offline'}`} title={connected ? 'You are online to visitors' : 'Not connected'}>
                        {connected ? `${sessions.length} active` : 'Connecting…'}
                    </span>
                </div>
                {sessions.length > 5 && (
                    <div className="session-search">
                        <Search size={14} />
                        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find a visitor" aria-label="Find a visitor" />
                    </div>
                )}
                <div className="session-list">
                    {visible.length === 0 ? (
                        <div className="empty-state">
                            {sessions.length === 0 ? 'No one is chatting right now. New chats appear here.' : 'No chats match.'}
                        </div>
                    ) : (
                        visible.map(session => {
                            const unread = session.unread ?? 0;
                            return (
                                <button
                                    type="button"
                                    key={session.sessionId}
                                    className={`session-item ${activeSession?.sessionId === session.sessionId ? 'selected' : ''} ${unread > 0 ? 'has-unread' : ''}`}
                                    onClick={() => selectSession(session)}
                                >
                                    <div className="session-avatar">
                                        {initials(session)}
                                        <span className={`presence-dot ${session.guestOnline ? 'on' : 'off'}`} title={session.guestOnline ? 'On the website now' : 'Left the website'} />
                                    </div>
                                    <div className="session-info">
                                        <div className="session-top">
                                            <span className="guest-name">{guestLabel(session)}</span>
                                            <span className="session-time">{timeAgo(session.lastMessageAt ?? session.startedAt)}</span>
                                        </div>
                                        <div className="session-bottom">
                                            <span className="session-preview">
                                                {typing[session.sessionId]
                                                    ? <em>typing…</em>
                                                    : session.lastMessageText
                                                        ? `${session.lastSenderType === 'Agent' ? 'You: ' : ''}${session.lastMessageText}`
                                                        : 'New chat, no messages yet'}
                                            </span>
                                            {unread > 0 && <span className="unread-pill">{unread > 9 ? '9+' : unread}</span>}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="chat-area">
                {current ? (
                    <>
                        <div className="chat-header">
                            {isMobile && (
                                <button className="mobile-chat-back-btn" onClick={clearSelection} title="Back to chats">
                                    <ChevronLeft size={20} />
                                </button>
                            )}
                            <div className="guest-details">
                                <h3>{guestLabel(current)}</h3>
                                <p>
                                    <span className={`presence-text ${current.guestOnline ? 'on' : 'off'}`}>
                                        {current.guestOnline ? 'On the website now' : 'Left the website'}
                                    </span>
                                    {current.guestEmail && (
                                        <a href={`mailto:${current.guestEmail}`} className="guest-email"><Mail size={12} /> {current.guestEmail}</a>
                                    )}
                                    <span>Started {new Date(current.startedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </p>
                            </div>
                            {confirmEnd ? (
                                <div className="end-confirm">
                                    <span>End this chat?</span>
                                    <button className="close-session-btn" onClick={() => { setConfirmEnd(false); void closeSession(current.sessionId); }}>Yes, end</button>
                                    <button className="end-cancel-btn" onClick={() => setConfirmEnd(false)}>Cancel</button>
                                </div>
                            ) : (
                                <button className="close-session-btn" onClick={() => setConfirmEnd(true)}>
                                    <CheckCircle2 size={18} />
                                    End chat
                                </button>
                            )}
                        </div>

                        {!current.guestOnline && (
                            <div className="guest-left-note">
                                The visitor has left the website. They will see your reply the next time they open the chat
                                {current.guestEmail ? ', or you can email them.' : '.'}
                            </div>
                        )}

                        <div className="messages-container">
                            {messages.map((msg, i) => {
                                const first = i === 0 || messages[i - 1].senderType !== msg.senderType;
                                return (
                                    <div key={msg.messageId} className={`message-wrapper ${msg.senderType === 'Agent' ? 'agent' : 'guest'}`}>
                                        <div className="message-stack">
                                            {first && (
                                                <span className="sender-label">{msg.senderType === 'Agent' ? (msg.senderId ?? 'Support') : guestLabel(current)}</span>
                                            )}
                                            <div className="message-bubble">
                                                <p>{msg.messageText}</p>
                                                <span className="timestamp">
                                                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {guestTyping && <div className="typing-indicator">{guestLabel(current)} is typing…</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-container">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                placeholder={connected ? 'Write a reply… (Enter to send, Shift+Enter for a new line)' : 'Connecting to server…'}
                                value={draft}
                                maxLength={MAX_MESSAGE_LENGTH}
                                onChange={e => { setDraft(e.target.value); if (e.target.value.trim()) notifyTyping(); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        void handleSend();
                                    }
                                }}
                                disabled={!connected}
                                aria-label="Reply"
                            />
                            <button onClick={() => void handleSend()} disabled={!connected || !draft.trim()} aria-label="Send reply">
                                <Send size={20} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <MessageSquare size={48} />
                        <p>Pick a chat on the left to reply</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveSessionsPanel;
