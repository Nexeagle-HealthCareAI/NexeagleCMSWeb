import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { partnerService } from '../services/partnerService';
import type { Partner } from '../services/partnerService';
import { Handshake, Building2, MapPin, User, Mail, Phone, Activity } from 'lucide-react';
import '../../dashboard/dashboard.css'; // Reuse dashboard styles

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

  if (!token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="text-xl text-primary font-semibold">Loading Dashboard...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="card text-center p-8 max-w-md w-full">
          <Activity size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const { profile, totalHospitalsOnboarded } = stats;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#1e40af', color: 'white', padding: '12px', borderRadius: '12px' }}>
              <Handshake size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>NexEagle Partner Dashboard</h1>
              <p style={{ margin: 0, color: '#64748b' }}>Welcome back, {profile.name}</p>
            </div>
          </div>
          <div style={{ background: 'white', padding: '12px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Partner Code</div>
            <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 700, color: '#1e40af', letterSpacing: '2px' }}>{profile.partnerCode}</div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Stats Card */}
          <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white' }}>
            <div className="stat-header">
              <span className="stat-title" style={{ color: '#e0e7ff' }}>Hospitals Onboarded</span>
              <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <Building2 size={24} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'white' }}>{totalHospitalsOnboarded}</div>
            <div className="stat-trend" style={{ color: '#bae6fd' }}>Total active connections</div>
          </div>

          {/* Profile Card */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} className="text-primary" /> Profile Details
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Name</span>
                <span style={{ fontWeight: 500 }}>{profile.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Profession</span>
                <span style={{ fontWeight: 500 }}>{profile.currentProfession}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Qualification</span>
                <span style={{ fontWeight: 500 }}>{profile.highestQualification}</span>
              </div>
              {profile.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14} /> Email</span>
                  <span style={{ fontWeight: 500 }}>{profile.email}</span>
                </div>
              )}
              {profile.phoneNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} /> Phone</span>
                  <span style={{ fontWeight: 500 }}>{profile.phoneNumber}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> Location</span>
                <span style={{ fontWeight: 500 }}>{profile.city}, {profile.state}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
