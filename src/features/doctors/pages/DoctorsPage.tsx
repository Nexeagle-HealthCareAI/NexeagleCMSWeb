import React, { useEffect, useState, useCallback } from 'react';
import { Star, EyeOff, Percent, Stethoscope, Eye, ListChecks, X, BadgeCheck } from 'lucide-react';
import { getDoctors, updateDoctorMarketing, type DoctorListItem } from '../services/doctorService';
import { DoctorDetailModal } from '../components/DoctorDetailModal';
import { BulkEditModal } from '../components/BulkEditModal';
import { InsightsTab } from '../../insights/components/InsightsTab';
import { SymptomRouterTab } from '../../insights/components/SymptomRouterTab';
import '../../dashboard/pages/Dashboard.css';
import '../../dashboard/pages/PremiumHospitals.css';
import './DoctorsPage.css';

const getGradientClass = (name: string) => {
    if (!name) return 'gradient-1';
    const char = name[0].toUpperCase();
    if (/[A-E]/.test(char)) return 'gradient-1';
    if (/[F-J]/.test(char)) return 'gradient-2';
    if (/[K-O]/.test(char)) return 'gradient-3';
    if (/[P-T]/.test(char)) return 'gradient-4';
    return 'gradient-5';
};

// Local <input type="datetime-local"> uses "YYYY-MM-DDTHH:mm" with no timezone — treat it as the
// admin's local time and convert to/from the UTC ISO string the API stores.
const toLocalInputValue = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInputValue = (local: string): string | null => (local ? new Date(local).toISOString() : null);

const formatLastLogin = (iso: string | null): string => {
    if (!iso) return 'Never logged in';
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
};

const isDiscountActive = (doctor: DoctorListItem): boolean => {
    if (!doctor.discountPercent || doctor.discountPercent <= 0) return false;
    const now = Date.now();
    if (doctor.discountStartAt && now < new Date(doctor.discountStartAt).getTime()) return false;
    if (doctor.discountEndAt && now > new Date(doctor.discountEndAt).getTime()) return false;
    return true;
};

interface EditFormState {
    isFeatured: boolean;
    isDelistedByAdmin: boolean;
    isRegistrationVerified: boolean;
    discountPercent: string;
    discountStartAt: string;
    discountEndAt: string;
}

const DoctorsPage: React.FC = () => {
    const [pageTab, setPageTab] = useState<'doctors' | 'insights' | 'nlp'>('doctors');
    const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    const [editingDoctor, setEditingDoctor] = useState<DoctorListItem | null>(null);
    const [form, setForm] = useState<EditFormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [viewingDoctorId, setViewingDoctorId] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkEditOpen, setBulkEditOpen] = useState(false);

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

    // Selection is page-scoped (matches what's actually fetched) — clear it whenever the visible
    // set of doctors changes so a stale checkbox never silently applies to doctors no longer shown.
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage, search]);

    const toggleSelected = (doctorId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(doctorId)) next.delete(doctorId);
            else next.add(doctorId);
            return next;
        });
    };

    const allOnPageSelected = doctors.length > 0 && doctors.every(d => selectedIds.has(d.doctorId));
    const toggleSelectAllOnPage = () => {
        setSelectedIds(prev => {
            if (allOnPageSelected) return new Set();
            const next = new Set(prev);
            doctors.forEach(d => next.add(d.doctorId));
            return next;
        });
    };

    const fetchDoctors = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getDoctors(currentPage, itemsPerPage, search);
            setDoctors(response.data);
            setTotalPages(response.pagination.totalPages);
            setTotalItems(response.pagination.totalItems);
            setError(null);
        } catch (err) {
            setError('Failed to fetch doctors');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, search]);

    useEffect(() => {
        fetchDoctors();
    }, [fetchDoctors]);

    const openEdit = (doctor: DoctorListItem) => {
        setEditingDoctor(doctor);
        setSaveError(null);
        setForm({
            isFeatured: doctor.isFeatured,
            isDelistedByAdmin: doctor.isDelistedByAdmin,
            isRegistrationVerified: doctor.isRegistrationVerified,
            discountPercent: doctor.discountPercent != null ? String(doctor.discountPercent) : '',
            discountStartAt: toLocalInputValue(doctor.discountStartAt),
            discountEndAt: toLocalInputValue(doctor.discountEndAt),
        });
    };

    const closeEdit = () => {
        if (saving) return;
        setEditingDoctor(null);
        setForm(null);
    };

    const handleSave = async () => {
        if (!editingDoctor || !form) return;

        const percent = form.discountPercent.trim() === '' ? null : Number(form.discountPercent);
        if (percent != null && (Number.isNaN(percent) || percent < 0 || percent > 100)) {
            setSaveError('Discount percent must be between 0 and 100.');
            return;
        }
        const startAt = fromLocalInputValue(form.discountStartAt);
        const endAt = fromLocalInputValue(form.discountEndAt);
        if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
            setSaveError('Discount end date cannot be before the start date.');
            return;
        }

        try {
            setSaving(true);
            setSaveError(null);
            await updateDoctorMarketing(editingDoctor.doctorId, {
                isFeatured: form.isFeatured,
                isDelistedByAdmin: form.isDelistedByAdmin,
                isRegistrationVerified: form.isRegistrationVerified,
                discountPercent: percent,
                discountStartAt: startAt,
                discountEndAt: endAt,
            });
            setEditingDoctor(null);
            setForm(null);
            await fetchDoctors();
        } catch (err: any) {
            setSaveError(err.response?.data?.message || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Doctor Dekho — Doctors</h1>
                    <p className="premium-subtitle">Feature, discount, or delist any doctor across every hospital on the platform.</p>
                </div>
            </header>

            <div className="doctor-page-tabs">
                <button
                    className={`doctor-page-tab-btn ${pageTab === 'doctors' ? 'active' : ''}`}
                    onClick={() => setPageTab('doctors')}
                >
                    Doctors
                </button>
                <button
                    className={`doctor-page-tab-btn ${pageTab === 'insights' ? 'active' : ''}`}
                    onClick={() => setPageTab('insights')}
                >
                    Insights
                </button>
                <button
                    className={`doctor-page-tab-btn ${pageTab === 'nlp' ? 'active' : ''}`}
                    onClick={() => setPageTab('nlp')}
                >
                    NLP
                </button>
            </div>

            {pageTab === 'insights' && <InsightsTab />}
            {pageTab === 'nlp' && <SymptomRouterTab />}

            {pageTab === 'doctors' && (
            <div className="premium-table-card">
                <div className="premium-controls">
                    <h2 className="premium-table-title">
                        All Doctors
                        <span className="premium-badge-count">
                            {totalItems}
                        </span>
                    </h2>
                    <div className="premium-search-wrapper">
                        <svg className="premium-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name or license number..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="premium-search-input"
                        />
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <div className="doctor-bulk-toolbar">
                        <span className="doctor-bulk-count">{selectedIds.size} selected</span>
                        <button className="doctor-edit-btn" onClick={() => setBulkEditOpen(true)}>
                            <ListChecks size={14} /> Bulk Edit
                        </button>
                        <button className="doctor-bulk-clear" onClick={() => setSelectedIds(new Set())}>
                            <X size={14} /> Clear selection
                        </button>
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading doctors...</div>
                ) : error ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
                ) : (
                    <>
                        <div className="premium-responsive-wrapper doctors-desktop-table">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 36, paddingLeft: 16 }}>
                                            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                                        </th>
                                        <th>Doctor</th>
                                        <th>Hospital</th>
                                        <th>OPD Fee</th>
                                        <th>Last Login</th>
                                        <th>Marketing</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctors.map((doctor) => (
                                        <tr key={doctor.doctorId} className="premium-row">
                                            <td style={{ paddingLeft: 16 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(doctor.doctorId)}
                                                    onChange={() => toggleSelected(doctor.doctorId)}
                                                />
                                            </td>
                                            <td>
                                                <div className="premium-hospital-cell">
                                                    <div className={`premium-avatar ${getGradientClass(doctor.fullName || '')}`}>
                                                        {doctor.fullName ? doctor.fullName[0].toUpperCase() : 'D'}
                                                    </div>
                                                    <div>
                                                        <div className="premium-hospital-name">{doctor.fullName || 'Unnamed'}</div>
                                                        <div style={{ fontSize: '13px', color: '#64748b' }}>{doctor.departmentName || '—'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, color: '#334155' }}>{doctor.hospitalName || '—'}</div>
                                                {doctor.hospitalAddress && (
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{doctor.hospitalAddress}</div>
                                                )}
                                            </td>
                                            <td className="table-cell">
                                                {doctor.opdConsultFee != null ? (
                                                    isDiscountActive(doctor) ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', marginRight: 6 }}>
                                                                ₹{doctor.opdConsultFee}
                                                            </span>
                                                            <span style={{ fontWeight: 700, color: '#16a34a' }}>
                                                                ₹{Math.round(doctor.opdConsultFee * (1 - (doctor.discountPercent || 0) / 100))}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span>₹{doctor.opdConsultFee}</span>
                                                    )
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13, color: '#475569' }}>
                                                    {formatLastLogin(doctor.lastLoginTime)}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {doctor.isRegistrationVerified && (
                                                        <span className="doctor-badge doctor-badge-verified" title={`Verified on ${formatLastLogin(doctor.registrationVerifiedAt)}`}><BadgeCheck size={12} /> Verified</span>
                                                    )}
                                                    {doctor.isFeatured && (
                                                        <span className="doctor-badge doctor-badge-featured"><Star size={12} /> Featured</span>
                                                    )}
                                                    {isDiscountActive(doctor) && (
                                                        <span className="doctor-badge doctor-badge-discount"><Percent size={12} /> {doctor.discountPercent}% off</span>
                                                    )}
                                                    {doctor.isDelistedByAdmin && (
                                                        <span className="doctor-badge doctor-badge-delisted"><EyeOff size={12} /> Delisted</span>
                                                    )}
                                                    {!doctor.isRegistrationVerified && !doctor.isFeatured && !isDiscountActive(doctor) && !doctor.isDelistedByAdmin && (
                                                        <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="doctor-edit-btn" onClick={(e) => { e.stopPropagation(); setViewingDoctorId(doctor.doctorId); }}>
                                                        <Eye size={14} /> View
                                                    </button>
                                                    <button className="doctor-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(doctor); }}>
                                                        <Stethoscope size={14} /> Edit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {doctors.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No doctors found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Cards */}
                        <div className="premium-mobile-cards">
                            {doctors.map((doctor) => (
                                <div key={doctor.doctorId} className="premium-mobile-card">
                                    <div className="premium-mobile-header">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(doctor.doctorId)}
                                            onChange={() => toggleSelected(doctor.doctorId)}
                                            style={{ flexShrink: 0, marginRight: '8px' }}
                                        />
                                        <div className={`premium-avatar ${getGradientClass(doctor.fullName || '')}`}>
                                            {doctor.fullName ? doctor.fullName[0].toUpperCase() : 'D'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 className="premium-hospital-name">{doctor.fullName || 'Unnamed'}</h3>
                                            <p className="premium-hospital-id">{doctor.departmentName || '—'}</p>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px', paddingLeft: '32px' }}>
                                        {doctor.isRegistrationVerified && (
                                            <span className="doctor-badge doctor-badge-verified" title="Registration verified"><BadgeCheck size={12} /> Verified</span>
                                        )}
                                        {doctor.isFeatured && (
                                            <span className="doctor-badge doctor-badge-featured" title="Featured"><Star size={12} /> Featured</span>
                                        )}
                                        {isDiscountActive(doctor) && (
                                            <span className="doctor-badge doctor-badge-discount" title={`${doctor.discountPercent}% off`}><Percent size={12} /> {doctor.discountPercent}% off</span>
                                        )}
                                        {doctor.isDelistedByAdmin && (
                                            <span className="doctor-badge doctor-badge-delisted" title="Delisted"><EyeOff size={12} /> Delisted</span>
                                        )}
                                    </div>

                                    <div className="premium-mobile-details">
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Hospital</span>
                                            <span className="premium-mobile-detail-value" style={{ textAlign: 'right' }}>
                                                {doctor.hospitalName || '—'}
                                                {doctor.hospitalAddress && (
                                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: 2 }}>{doctor.hospitalAddress}</div>
                                                )}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">OPD Fee</span>
                                            <span className="premium-mobile-detail-value">
                                                {doctor.opdConsultFee != null ? (
                                                    isDiscountActive(doctor) ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: 6 }}>
                                                                ₹{doctor.opdConsultFee}
                                                            </span>
                                                            <strong style={{ color: '#16a34a' }}>
                                                                ₹{Math.round(doctor.opdConsultFee * (1 - (doctor.discountPercent || 0) / 100))}
                                                            </strong>
                                                        </>
                                                    ) : (
                                                        <strong>₹{doctor.opdConsultFee}</strong>
                                                    )
                                                ) : (
                                                    '—'
                                                )}
                                            </span>
                                        </div>
                                        <div className="premium-mobile-detail-item">
                                            <span className="premium-mobile-detail-label">Last Login</span>
                                            <span className="premium-mobile-detail-value">{formatLastLogin(doctor.lastLoginTime)}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                        <button className="doctor-edit-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setViewingDoctorId(doctor.doctorId)}>
                                            <Eye size={14} /> View
                                        </button>
                                        <button className="doctor-edit-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(doctor)}>
                                            <Stethoscope size={14} /> Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {doctors.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No doctors found.</div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="premium-pagination">
                            <div className="premium-page-info">
                                Showing <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalItems}</span> entries
                            </div>
                            <div className="premium-page-controls">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="premium-page-btn"
                                >
                                    Previous
                                </button>
                                <span style={{ margin: '0 12px', fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="premium-page-btn"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
            )}

            {editingDoctor && form && (
                <div className="reject-modal-overlay" onClick={closeEdit}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header" style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '20px' }}>{editingDoctor.fullName || 'Doctor Settings'}</h3>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginTop: '4px' }}>
                                {editingDoctor.hospitalName}
                            </div>
                        </div>

                        <div className="premium-edit-section">
                            <h4 className="premium-edit-section-title">Visibility & Ranking</h4>
                            
                            <label className={`premium-toggle-card ${form.isFeatured ? 'active' : ''}`}>
                                <div className="premium-toggle-card-content">
                                    <div className="premium-toggle-card-title">Featured Profile</div>
                                    <div className="premium-toggle-card-desc">Pins this doctor to the top of the public listing.</div>
                                </div>
                                <div className="premium-switch">
                                    <input
                                        type="checkbox"
                                        checked={form.isFeatured}
                                        onChange={e => setForm({ ...form, isFeatured: e.target.checked })}
                                    />
                                    <span className="premium-slider"></span>
                                </div>
                            </label>

                            <label className={`premium-toggle-card ${form.isDelistedByAdmin ? 'danger' : ''}`}>
                                <div className="premium-toggle-card-content">
                                    <div className="premium-toggle-card-title" style={{ color: form.isDelistedByAdmin ? '#dc2626' : undefined }}>Delisted by Admin</div>
                                    <div className="premium-toggle-card-desc">Hides this doctor platform-wide, overriding the hospital's choice.</div>
                                </div>
                                <div className="premium-switch">
                                    <input
                                        type="checkbox"
                                        checked={form.isDelistedByAdmin}
                                        onChange={e => setForm({ ...form, isDelistedByAdmin: e.target.checked })}
                                    />
                                    <span className="premium-slider danger-slider"></span>
                                </div>
                            </label>
                        </div>

                        <div className="premium-edit-section" style={{ marginTop: '24px' }}>
                            <h4 className="premium-edit-section-title">Promotional Discount</h4>
                            
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                                    Consultation-fee discount (%)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    placeholder="e.g. 20"
                                    value={form.discountPercent}
                                    onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                                    className="doctor-form-input premium-input"
                                />

                                <div className="doctor-modal-row" style={{ marginTop: '16px' }}>
                                    <div className="doctor-modal-col">
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                                            Starts
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={form.discountStartAt}
                                            onChange={e => setForm({ ...form, discountStartAt: e.target.value })}
                                            className="doctor-form-input premium-input"
                                        />
                                    </div>
                                    <div className="doctor-modal-col">
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                                            Ends
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={form.discountEndAt}
                                            onChange={e => setForm({ ...form, discountEndAt: e.target.value })}
                                            className="doctor-form-input premium-input"
                                        />
                                    </div>
                                </div>
                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '12px 0 0 0', lineHeight: 1.4 }}>
                                    Leave both dates blank for an always-on discount, or leave the percent blank to remove it.
                                </p>
                            </div>
                        </div>

                        {saveError && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
                                {saveError}
                            </div>
                        )}

                        <div className="form-actions" style={{ marginTop: 20 }}>
                            <button className="cancel-btn" onClick={closeEdit} disabled={saving}>Cancel</button>
                            <button className="approve-btn" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingDoctorId && (
                <DoctorDetailModal doctorId={viewingDoctorId} onClose={() => setViewingDoctorId(null)} />
            )}

            {bulkEditOpen && (
                <BulkEditModal
                    doctorIds={Array.from(selectedIds)}
                    onClose={() => setBulkEditOpen(false)}
                    onSaved={async () => {
                        setBulkEditOpen(false);
                        setSelectedIds(new Set());
                        await fetchDoctors();
                    }}
                />
            )}
        </div>
    );
};

export default DoctorsPage;
