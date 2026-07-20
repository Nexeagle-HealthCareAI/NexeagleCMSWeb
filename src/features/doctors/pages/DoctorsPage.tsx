import React, { useEffect, useState, useCallback } from 'react';
import { Star, EyeOff, Percent, Stethoscope } from 'lucide-react';
import { getDoctors, updateDoctorMarketing, type DoctorListItem } from '../services/doctorService';
import '../../dashboard/pages/Dashboard.css';
import './DoctorsPage.css';

// Local <input type="datetime-local"> uses "YYYY-MM-DDTHH:mm" with no timezone — treat it as the
// admin's local time and convert to/from the UTC ISO string the API stores.
const toLocalInputValue = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInputValue = (local: string): string | null => (local ? new Date(local).toISOString() : null);

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
    discountPercent: string;
    discountStartAt: string;
    discountEndAt: string;
}

const DoctorsPage: React.FC = () => {
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

    useEffect(() => {
        const handle = setTimeout(() => {
            setSearch(searchInput);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(handle);
    }, [searchInput]);

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
        <div className="dashboard-container fixed-layout">
            <header className="dashboard-header">
                <h1 className="dashboard-title">Doctor Dekho — Doctors</h1>
                <p className="dashboard-subtitle">Feature, discount, or delist any doctor across every hospital on the platform.</p>
            </header>

            <div className="table-card">
                <div className="table-header-controls">
                    <h2 className="table-title">
                        All Doctors
                        <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 'normal' }}>
                            ({totalItems})
                        </span>
                    </h2>
                    <input
                        type="text"
                        placeholder="Search by name or license number..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="search-input"
                    />
                </div>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : error ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>
                ) : (
                    <>
                        <div className="table-responsive-wrapper doctors-desktop-table">
                            <table className="dashboard-table">
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-header-cell">Doctor</th>
                                        <th className="table-header-cell">Hospital</th>
                                        <th className="table-header-cell">OPD Fee</th>
                                        <th className="table-header-cell">Marketing</th>
                                        <th className="table-header-cell">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctors.map((doctor) => (
                                        <tr key={doctor.doctorId} className="table-row">
                                            <td className="table-cell">
                                                <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{doctor.fullName || 'Unnamed'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{doctor.departmentName || '—'}</div>
                                            </td>
                                            <td className="table-cell">{doctor.hospitalName || '—'}</td>
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
                                            <td className="table-cell">
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {doctor.isFeatured && (
                                                        <span className="doctor-badge doctor-badge-featured"><Star size={12} /> Featured</span>
                                                    )}
                                                    {isDiscountActive(doctor) && (
                                                        <span className="doctor-badge doctor-badge-discount"><Percent size={12} /> {doctor.discountPercent}% off</span>
                                                    )}
                                                    {doctor.isDelistedByAdmin && (
                                                        <span className="doctor-badge doctor-badge-delisted"><EyeOff size={12} /> Delisted</span>
                                                    )}
                                                    {!doctor.isFeatured && !isDiscountActive(doctor) && !doctor.isDelistedByAdmin && (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="table-cell">
                                                <button className="doctor-edit-btn" onClick={() => openEdit(doctor)}>
                                                    <Stethoscope size={14} /> Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {doctors.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No doctors found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: Cards (Android Compatible) */}
                        <div className="doctors-mobile-cards">
                            {doctors.map((doctor) => (
                                <div key={doctor.doctorId} className="doctor-mobile-card">
                                    <div className="doctor-card-header">
                                        <div className="doctor-avatar-wrapper">
                                            <span className="doctor-avatar">{doctor.fullName ? doctor.fullName[0].toUpperCase() : 'D'}</span>
                                        </div>
                                        <div className="doctor-meta">
                                            <h4 className="doctor-name">{doctor.fullName || 'Unnamed'}</h4>
                                            <p className="doctor-dept">{doctor.departmentName || '—'}</p>
                                        </div>
                                        <div className="doctor-card-badges">
                                            {doctor.isFeatured && (
                                                <span className="doctor-badge doctor-badge-featured" title="Featured"><Star size={12} /></span>
                                            )}
                                            {isDiscountActive(doctor) && (
                                                <span className="doctor-badge doctor-badge-discount" title={`${doctor.discountPercent}% off`}><Percent size={12} /></span>
                                            )}
                                            {doctor.isDelistedByAdmin && (
                                                <span className="doctor-badge doctor-badge-delisted" title="Delisted"><EyeOff size={12} /></span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="doctor-card-details">
                                        <div className="detail-row">
                                            <span className="label">Hospital</span>
                                            <span className="value">{doctor.hospitalName || '—'}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="label">OPD Fee</span>
                                            <span className="value">
                                                {doctor.opdConsultFee != null ? (
                                                    isDiscountActive(doctor) ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', marginRight: 6 }}>
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
                                    </div>
                                    
                                    <div className="doctor-card-actions">
                                        <button className="doctor-edit-btn mobile-edit-btn" onClick={() => openEdit(doctor)}>
                                            <Stethoscope size={14} /> Edit Marketing Settings
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {doctors.length === 0 && (
                                <div className="doctors-empty-mobile">No doctors found.</div>
                            )}
                        </div>

                        <div className="pagination-container">
                            <div className="pagination-info">
                                Showing {totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                            </div>
                            <div className="pagination-controls">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="pagination-button"
                                >
                                    Previous
                                </button>
                                <span style={{ margin: '0 10px' }}>Page {currentPage} of {totalPages || 1}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="pagination-button"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {editingDoctor && form && (
                <div className="reject-modal-overlay" onClick={closeEdit}>
                    <div className="reject-modal" onClick={e => e.stopPropagation()}>
                        <div className="reject-modal-header">
                            <h3>{editingDoctor.fullName || 'Doctor'}</h3>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                            {editingDoctor.hospitalName} — these settings apply platform-wide on Doctor Dekho.
                        </p>

                        <label className="doctor-form-checkbox">
                            <input
                                type="checkbox"
                                checked={form.isFeatured}
                                onChange={e => setForm({ ...form, isFeatured: e.target.checked })}
                            />
                            <div>
                                <div style={{ fontWeight: 700 }}>Featured</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>Pins this doctor to the top of the public listing.</div>
                            </div>
                        </label>

                        <label className="doctor-form-checkbox">
                            <input
                                type="checkbox"
                                checked={form.isDelistedByAdmin}
                                onChange={e => setForm({ ...form, isDelistedByAdmin: e.target.checked })}
                            />
                            <div>
                                <div style={{ fontWeight: 700 }}>Delisted</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>Hides this doctor from Doctor Dekho, overriding the hospital's own listing choice.</div>
                            </div>
                        </label>

                        <div style={{ marginTop: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
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
                                className="doctor-form-input"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                                    Starts
                                </label>
                                <input
                                    type="datetime-local"
                                    value={form.discountStartAt}
                                    onChange={e => setForm({ ...form, discountStartAt: e.target.value })}
                                    className="doctor-form-input"
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                                    Ends
                                </label>
                                <input
                                    type="datetime-local"
                                    value={form.discountEndAt}
                                    onChange={e => setForm({ ...form, discountEndAt: e.target.value })}
                                    className="doctor-form-input"
                                />
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0 0' }}>
                            Leave both blank for an always-on discount, or leave the percent blank to remove it. Changes may take up to a minute to appear on Doctor Dekho.
                        </p>

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
        </div>
    );
};

export default DoctorsPage;
