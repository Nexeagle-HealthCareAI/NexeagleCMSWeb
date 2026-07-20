import React from 'react';
import { Info } from 'lucide-react';

interface InsightsExplainerProps {
    children: React.ReactNode;
}

// A consistent "what am I looking at, and how do I read it" banner at the top of every Insights
// sub-tab — the numbers alone don't explain themselves (e.g. why a low Search-to-View rate might
// mean missing doctors rather than a broken search), so this carries that context inline instead
// of requiring a separate doc.
export const InsightsExplainer: React.FC<InsightsExplainerProps> = ({ children }) => (
    <div className="insights-explainer">
        <Info size={16} className="insights-explainer-icon" />
        <div className="insights-explainer-text">{children}</div>
    </div>
);

export default InsightsExplainer;
