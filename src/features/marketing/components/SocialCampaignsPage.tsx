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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ background: '#fefce8', border: '1px solid #fde047', padding: '20px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a16207', fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>
                    <Sparkles size={20} /> AI Social Campaign Generator
                </div>
                <p style={{ margin: '0 0 16px 0', color: '#713f12', fontSize: '14px' }}>Enter a topic (e.g., "offline billing", "patient queues") and Groq 70B will generate optimized posts for all platforms.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g. Benefits of cloud prescriptions..."
                        style={{ flex: 1, padding: '12px 16px', border: '1px solid #fde047', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={generating || !topic.trim()}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eab308', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, opacity: (generating || !topic.trim()) ? 0.6 : 1 }}
                    >
                        {generating ? 'Generating...' : 'Generate Campaign'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {campaigns.map((c: any, i: number) => (
                    <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>Generated Campaign</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            {/* Instagram */}
                            <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e1306c', fontWeight: 600, fontSize: '13px' }}>
                                        <Instagram size={16} /> Instagram Carousel
                                    </div>
                                    <button onClick={() => copyToClipboard(c.instagramCarousel, `${i}-ig`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-ig` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>{c.instagramCarousel}</div>
                            </div>
                            
                            {/* Facebook */}
                            <div style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1877f2', fontWeight: 600, fontSize: '13px' }}>
                                        <Facebook size={16} /> Facebook Ad
                                    </div>
                                    <button onClick={() => copyToClipboard(c.facebookAdCopy, `${i}-fb`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-fb` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>{c.facebookAdCopy}</div>
                            </div>

                            {/* YouTube */}
                            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff0000', fontWeight: 600, fontSize: '13px' }}>
                                        <Youtube size={16} /> YT Shorts Script
                                    </div>
                                    <button onClick={() => copyToClipboard(c.youtubeShortsScript, `${i}-yt`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-yt` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>{c.youtubeShortsScript}</div>
                            </div>

                            {/* Twitter */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1da1f2', fontWeight: 600, fontSize: '13px' }}>
                                        <Twitter size={16} /> X / Twitter Thread
                                    </div>
                                    <button onClick={() => copyToClipboard(c.twitterThread, `${i}-tw`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        {copied === `${i}-tw` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>{c.twitterThread}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
