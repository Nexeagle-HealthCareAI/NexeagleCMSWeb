import React, { useState } from 'react';
import { Sparkles, Instagram, Facebook, Youtube, Twitter, Copy, Check } from 'lucide-react';
import { crmService } from '../services/crmService';
import { type AiSocialCampaign } from '../types/crm';
import '../pages/Marketing.css';



export const SocialCampaignsPage: React.FC = () => {
    const [generating, setGenerating] = useState(false);
    const [campaigns, setCampaigns] = useState<AiSocialCampaign[]>([]);
    const [topic, setTopic] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        
        try {
            setGenerating(true);
            const campaign = await crmService.generateSocialCampaign(topic);
            setCampaigns([{ ...campaign, topic: topic } as any, ...campaigns]); // Using topic as a UI prop if needed
            setTopic('');
        } catch (error) {
            console.error("Failed to generate campaign", error);
            alert("Failed to connect to Groq AI. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
    return (
        <div className="social-campaign-container">
            <div className="social-generator-card">
                <div className="social-generator-title">
                    <Sparkles size={20} /> AI Social Campaign Generator
                </div>
                <p className="social-generator-desc">Enter a topic (e.g., "offline billing", "patient queues") and Groq 70B will generate optimized posts for all platforms.</p>
                <div className="social-input-wrapper">
                    <input 
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g. Benefits of cloud prescriptions..."
                        className="marketing-input"
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={generating || !topic.trim()}
                        className="marketing-btn-primary"
                    >
                        {generating ? 'Generating...' : 'Generate Campaign'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {campaigns.map((c: any, i: number) => (
                    <div key={i} className="social-result-card">
                        <h3 className="social-result-title">Generated Campaign</h3>
                        <div className="social-platforms-grid">
                            {/* Instagram */}
                            <div className="platform-card platform-ig">
                                <div className="platform-header">
                                    <div className="platform-name">
                                        <Instagram size={16} /> Instagram Carousel
                                    </div>
                                    <button onClick={() => copyToClipboard(c.instagramCarousel, `${i}-ig`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-ig` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className="platform-content">{c.instagramCarousel}</div>
                            </div>
                            
                            {/* Facebook */}
                            <div className="platform-card platform-fb">
                                <div className="platform-header">
                                    <div className="platform-name">
                                        <Facebook size={16} /> Facebook Ad
                                    </div>
                                    <button onClick={() => copyToClipboard(c.facebookAdCopy, `${i}-fb`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-fb` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className="platform-content">{c.facebookAdCopy}</div>
                            </div>

                            {/* YouTube */}
                            <div className="platform-card platform-yt">
                                <div className="platform-header">
                                    <div className="platform-name">
                                        <Youtube size={16} /> YT Shorts Script
                                    </div>
                                    <button onClick={() => copyToClipboard(c.youtubeShortsScript, `${i}-yt`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-yt` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className="platform-content">{c.youtubeShortsScript}</div>
                            </div>

                            {/* Twitter */}
                            <div className="platform-card platform-tw">
                                <div className="platform-header">
                                    <div className="platform-name">
                                        <Twitter size={16} /> X / Twitter Thread
                                    </div>
                                    <button onClick={() => copyToClipboard(c.twitterThread, `${i}-tw`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-tw` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className="platform-content">{c.twitterThread}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
