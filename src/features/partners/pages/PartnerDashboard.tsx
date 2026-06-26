import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { partnerService } from '../services/partnerService';
import type { Partner } from '../services/partnerService';
import { Handshake, Building2, MapPin, User, Mail, Phone, Activity, Plus, Copy } from 'lucide-react';
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

  const handleOnboardHospital = () => {
    toast.info('Hospital onboarding portal coming soon!');
  };

  if (!token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="pd-loading-container">
        <div className="pd-spinner"></div>
        <div className="pd-loading-text">Loading Workspace...</div>
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

      <div className="pd-content">
        
        {/* Header */}
        <header className="pd-header glass-card">
          <div className="pd-header-left">
            <div className="pd-brand-icon">
              <Handshake size={32} />
            </div>
            <div>
              <h1 className="pd-title">Partner Workspace</h1>
              <p className="pd-subtitle">Welcome back, <span className="text-blue-300 font-semibold">{profile.name}</span></p>
            </div>
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

        {/* Action Bar */}
        <div className="pd-action-bar">
          <button className="pd-btn-primary" onClick={handleOnboardHospital}>
            <Plus size={20} />
            <span>Onboard New Hospital</span>
            <div className="pd-btn-glow"></div>
          </button>
        </div>

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

          {/* Profile Card */}
          <div className="pd-profile-card glass-card">
            <h3 className="pd-card-title">
              <User size={20} className="text-blue-400" /> 
              Partner Profile
            </h3>
            
            <div className="pd-profile-list">
              <div className="pd-profile-item">
                <span className="pd-profile-label">Name</span>
                <span className="pd-profile-value">{profile.name}</span>
              </div>
              <div className="pd-profile-item">
                <span className="pd-profile-label">Profession</span>
                <span className="pd-profile-value">{profile.currentProfession}</span>
              </div>
              <div className="pd-profile-item">
                <span className="pd-profile-label">Qualification</span>
                <span className="pd-profile-value">{profile.highestQualification}</span>
              </div>
              {profile.email && (
                <div className="pd-profile-item">
                  <span className="pd-profile-label"><Mail size={16} /> Email</span>
                  <span className="pd-profile-value">{profile.email}</span>
                </div>
              )}
              {profile.phoneNumber && (
                <div className="pd-profile-item">
                  <span className="pd-profile-label"><Phone size={16} /> Phone</span>
                  <span className="pd-profile-value">{profile.phoneNumber}</span>
                </div>
              )}
              <div className="pd-profile-item">
                <span className="pd-profile-label"><MapPin size={16} /> Location</span>
                <span className="pd-profile-value">{profile.city}, {profile.state}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
