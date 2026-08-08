import React, { useState } from 'react';
import { Radio, History } from 'lucide-react';
import LiveSessionsPanel from '../components/LiveSessionsPanel';
import ChatHistoryPanel from '../components/ChatHistoryPanel';
import '../../insights/components/Insights.css';
import './LiveSupport.css';

type SupportSubTab = 'live' | 'history';

const LiveSupport: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<SupportSubTab>('live');

    return (
        <div className="live-support-page">
            <div className="insights-subtabs">
                <button
                    className={`insights-subtab-btn ${activeSubTab === 'live' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('live')}
                >
                    <Radio size={16} />
                    <span>Live</span>
                </button>
                <button
                    className={`insights-subtab-btn ${activeSubTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('history')}
                >
                    <History size={16} />
                    <span>History</span>
                </button>
            </div>

            <div className="insights-panel-animated" key={activeSubTab}>
                {activeSubTab === 'live' ? <LiveSessionsPanel /> : <ChatHistoryPanel />}
            </div>
        </div>
    );
};

export default LiveSupport;
