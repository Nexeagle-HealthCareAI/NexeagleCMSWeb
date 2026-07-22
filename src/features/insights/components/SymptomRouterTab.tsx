import React, { useState } from 'react';
import { TrainingDataPanel } from './TrainingDataPanel';
import { FeedbackLogPanel } from './FeedbackLogPanel';
import { ModelInfoPanel } from './ModelInfoPanel';
import { Database, MessageSquareWarning, Cpu } from 'lucide-react';
import '../../dashboard/pages/PremiumHospitals.css';
import './Insights.css';

type SymptomRouterSubTab = 'training' | 'feedback' | 'model';

export const SymptomRouterTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<SymptomRouterSubTab>('training');

    const tabs: { key: SymptomRouterSubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'training', label: 'Training Data', icon: <Database size={16} /> },
        { key: 'feedback', label: 'Feedback Log', icon: <MessageSquareWarning size={16} /> },
        { key: 'model', label: 'Model Info', icon: <Cpu size={16} /> },
    ];

    return (
        <div className="insights-premium-container">
            <div className="insights-subtabs">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        className={`insights-subtab-btn ${activeSubTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveSubTab(t.key)}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            <div className="insights-panel-animated" key={activeSubTab}>
                {activeSubTab === 'training' && <TrainingDataPanel />}
                {activeSubTab === 'feedback' && <FeedbackLogPanel />}
                {activeSubTab === 'model' && <ModelInfoPanel />}
            </div>
        </div>
    );
};

export default SymptomRouterTab;
