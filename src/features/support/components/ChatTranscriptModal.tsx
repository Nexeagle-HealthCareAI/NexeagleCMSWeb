import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getChatTranscript, type ChatSessionListItem } from '../services/chatHistoryService';
import type { Message } from '../../../store/useSupportStore';
import '../../doctors/pages/DoctorsPage.css';
import '../pages/LiveSupport.css';

interface ChatTranscriptModalProps {
    session: ChatSessionListItem;
    onClose: () => void;
}

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const ChatTranscriptModal: React.FC<ChatTranscriptModalProps> = ({ session, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getChatTranscript(session.sessionId)
            .then(data => { if (!cancelled) setMessages(data); })
            .catch(() => { if (!cancelled) setMessages([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [session.sessionId]);

    return (
        <div className="reject-modal-overlay" onClick={onClose}>
            <div
                className="reject-modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 640, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}
            >
                <div className="reject-modal-header" style={{ padding: '20px 24px 16px', marginBottom: 0, flexShrink: 0 }}>
                    <div>
                        <h3>{session.guestName || `Guest ${session.guestId.substring(0, 8)}`}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                            {session.guestEmail ? `${session.guestEmail} • ` : ''}Started {formatDateTime(session.startedAt)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                        aria-label="Close transcript"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="messages-container" style={{ flex: 1, minHeight: 0 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading…</div>
                    ) : messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No messages in this session.</div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.messageId} className={`message-wrapper ${msg.senderType === 'Agent' ? 'agent' : 'guest'}`}>
                                <div className="message-bubble">
                                    <p>{msg.messageText}</p>
                                    <span className="timestamp">
                                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatTranscriptModal;
