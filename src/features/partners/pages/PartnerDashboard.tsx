import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Building2, Activity, Copy } from 'lucide-react';
import { partnerService } from '../services/partnerService';
import type { Partner } from '../services/partnerService';
import { toast } from 'sonner';
import { copyToClipboard } from '../../../utils/clipboard';
import './PartnerDashboard.css';

interface DashboardStats {
  profile: Partner;
  totalHospitalsOnboarded: number;
}

const PartnerDashboard: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessTime, setAccessTime] = useState<string>('');

  useEffect(() => {
    setAccessTime(new Date().toLocaleString());
  }, []);

  useEffect(() => {
    if (!token) return;
    
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await partnerService.getDashboardStats(token);
        setStats(data);
      } catch (err) {
        console.error(err);
        setError('Invalid or expired dashboard link.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [token]);

  const copyPartnerCode = async () => {
    if (stats?.profile.partnerCode) {
      await copyToClipboard(stats.profile.partnerCode);
      toast.success('Partner Code Copied!');
    }
  };

  if (!token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="pd-loading-container">
        <div className="pd-bg-orb pd-orb-1"></div>
        <div className="pd-bg-orb pd-orb-2"></div>
        <div className="pd-bg-orb pd-orb-3"></div>
        
        <div className="pd-loading-content glass-card">
          <div className="pd-loading-logo">
            <img src="/Logo.png" alt="NexEagle Logo" className="pd-brand-image-large" />
            <div className="pd-logo-glow"></div>
          </div>
          <h2 className="pd-loading-title">Welcome to Your Workspace</h2>
          <p className="pd-loading-subtitle">
            Empowering healthcare, together.<br/>
            We are proud to have you in the NexEagle network.
          </p>
          <div className="pd-spinner-modern">
            <div className="pd-spinner-ring"></div>
            <div className="pd-spinner-dot"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="pd-loading-container">
        <div className="pd-error-card glass-card">
          <Activity size={48} className="text-red-400 mx-auto mb-4" />
          <h2>Access Denied</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const { profile, totalHospitalsOnboarded } = stats;

  return (
    <div className="pd-container">
      {/* Background Orbs */}
      <div className="pd-bg-orb pd-orb-1"></div>
      <div className="pd-bg-orb pd-orb-2"></div>
      <div className="pd-bg-orb pd-orb-3"></div>

      {/* Top Navbar */}
      <nav className="pd-top-nav glass-card">
        <div className="pd-brand-logo">
          <img src="/Logo.png" alt="NexEagle Logo" className="pd-brand-image" />
          <span className="pd-brand-text">NexEagle</span>
        </div>
        <h2 className="pd-nav-title">Partner Workspace</h2>
        <div style={{ width: '100px' }}></div> {/* Spacer for center alignment */}
      </nav>

      <div className="pd-content">
        
        {/* Dashboard Header */}
        <header className="pd-header glass-card">
          <div className="pd-header-left">
            <h1 className="pd-title">Welcome back, {profile.name}!</h1>
            <p className="pd-subtitle">Manage your onboarding pipeline and earnings.</p>
            {accessTime && (
              <p className="pd-access-time">Session Started: {accessTime}</p>
            )}
          </div>

          <div className="pd-header-right">
            <div className="pd-code-box" onClick={copyPartnerCode}>
              <span className="pd-code-label">Your Partner Code</span>
              <div className="pd-code-value">
                {profile.partnerCode}
                <Copy size={16} className="pd-copy-icon" />
              </div>
            </div>
          </div>
        </header>

        <div className="pd-grid">
          
          {/* Stats Card */}
          <div className="pd-stat-card glass-card">
            <div className="pd-stat-header">
              <span className="pd-stat-title">Network Impact</span>
              <div className="pd-stat-icon">
                <Building2 size={24} />
              </div>
            </div>
            <div className="pd-stat-body">
              <div className="pd-stat-value">{totalHospitalsOnboarded}</div>
              <div className="pd-stat-label">Hospitals Onboarded</div>
            </div>
            <div className="pd-stat-footer">
              <div className="pd-progress-bar">
                <div className="pd-progress-fill" style={{ width: totalHospitalsOnboarded > 0 ? '100%' : '5%' }}></div>
              </div>
              <span className="pd-stat-trend">Active Connections</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
