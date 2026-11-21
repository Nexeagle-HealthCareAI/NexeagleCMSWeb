import React from 'react';
import LiveSessionsPanel from '../components/LiveSessionsPanel';
import ChatHistoryPanel from '../components/ChatHistoryPanel';
import '../../insights/components/Insights.css';
import './LiveSupport.css';

/** Live chat and chat history are two menu items (Support group); this page shows one of them. */
const LiveSupport: React.FC<{ view?: 'live' | 'history' }> = ({ view = 'live' }) => (
    <div className="live-support-page">
        <header className="ne-page-head">
            <h1>{view === 'live' ? 'Live chat' : 'Chat history'}</h1>
            <p>{view === 'live' ? 'People waiting to talk to the team right now.' : 'Every past conversation, newest first.'}</p>
        </header>
        <div className="insights-panel-animated" key={view}>
            {view === 'live' ? <LiveSessionsPanel /> : <ChatHistoryPanel />}
        </div>
    </div>
);

export default LiveSupport;
