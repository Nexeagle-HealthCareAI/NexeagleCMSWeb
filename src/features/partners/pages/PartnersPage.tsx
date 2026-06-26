import React, { useEffect, useState, useMemo } from 'react';
import { partnerService } from '../services/partnerService';
import type { Partner } from '../services/partnerService';
import AddPartnerModal from '../components/AddPartnerModal';
import { Plus, Handshake, Users, MapPin, Copy, Check, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Sorting, searching, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Partner | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  const handleSort = (field: keyof Partner) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter, Sort, and Paginate logic
  const filteredAndSortedPartners = useMemo(() => {
    let result = [...partners];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.partnerCode.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.currentProfession.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [partners, searchQuery, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedPartners.length / itemsPerPage);
  
  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortOrder]);

  const currentPartners = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedPartners.slice(start, start + itemsPerPage);
  }, [filteredAndSortedPartners, currentPage]);

  const SortIcon = ({ field }: { field: keyof Partner }) => {
    if (sortField !== field) return <ChevronUp size={14} className="text-gray-300 ml-1 inline" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-blue-600 ml-1 inline" /> : <ChevronDown size={14} className="text-blue-600 ml-1 inline" />;
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} className="text-gray-400" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search partners..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">Loading partners...</div>
        ) : partners.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="text-gray-400 mb-4 mx-auto" />
            <h3>No Partners Yet</h3>
            <p>Click "Add Partner" to onboard your first partner.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Partner Name <SortIcon field="name" />
                    </th>
                    <th onClick={() => handleSort('partnerCode')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Partner Code <SortIcon field="partnerCode" />
                    </th>
                    <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Contact Info <SortIcon field="email" />
                    </th>
                    <th onClick={() => handleSort('city')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Location <SortIcon field="city" />
                    </th>
                    <th onClick={() => handleSort('currentProfession')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Profession <SortIcon field="currentProfession" />
                    </th>
                    <th style={{ textAlign: 'right' }}>Dashboard Link</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPartners.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No partners found matching your search.</td></tr>
                  ) : currentPartners.map(p => (
                    <tr key={p.partnerId}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{p.sex}, {p.age} yrs</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{p.partnerCode}</span>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(p.partnerCode); }} 
                            title="Copy Code"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <Copy size={14} />
                          </button>
                        </div>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedPartners.length)} of {filteredAndSortedPartners.length} partners
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f8fafc' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: '#475569' }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{ 
                        padding: '8px 14px', 
                        borderRadius: '6px', 
                        border: '1px solid',
                        borderColor: currentPage === page ? '#3b82f6' : '#cbd5e1',
                        background: currentPage === page ? '#eff6ff' : 'white', 
                        color: currentPage === page ? '#1d4ed8' : '#475569',
                        fontWeight: currentPage === page ? 600 : 400,
                        cursor: 'pointer' 
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f8fafc' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: '#475569' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
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
