import React, { useEffect, useState } from 'react';
import { partnerService, Partner } from '../services/partnerService';
import AddPartnerModal from '../components/AddPartnerModal';
import { Plus, Link as LinkIcon, Handshake, Users, MapPin, Copy, Check } from 'lucide-react';

const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const data = await partnerService.getAll();
      setPartners(data);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/partner-dashboard/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title"><Handshake size={28} className="text-primary" style={{ display: 'inline', marginRight: '10px' }} /> Partner Network</h1>
          <p className="page-subtitle">Manage onboarded partners and their dashboards.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add Partner
        </button>
      </div>

      <div className="card mt-6">
        {loading ? (
          <div className="flex justify-center p-8">Loading partners...</div>
        ) : partners.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="text-gray-400 mb-4 mx-auto" />
            <h3>No Partners Yet</h3>
            <p>Click "Add Partner" to onboard your first partner.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner Name</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>Profession</th>
                  <th style={{ textAlign: 'right' }}>Dashboard Link</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.partnerId}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{p.sex}, {p.age} yrs</div>
                    </td>
                    <td>
                      {p.email ? <div>{p.email}</div> : <span className="text-gray-400 text-xs">No email</span>}
                      {p.phoneNumber && <div style={{ fontSize: '12px', color: '#64748b' }}>{p.phoneNumber}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} className="text-gray-400" />
                        <span>{p.city}, {p.state}</span>
                      </div>
                    </td>
                    <td>
                      <div>{p.currentProfession}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{p.highestQualification}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={() => handleCopyLink(p.dashboardToken)}
                      >
                        {copiedToken === p.dashboardToken ? (
                          <><Check size={14} className="text-green-600" /> Copied</>
                        ) : (
                          <><Copy size={14} /> Copy Link</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPartnerModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchPartners();
          }}
        />
      )}
    </div>
  );
};

export default PartnersPage;
