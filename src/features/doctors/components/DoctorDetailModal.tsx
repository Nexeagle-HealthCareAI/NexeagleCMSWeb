import React, { useEffect, useState } from 'react';
import { X, Stethoscope, Phone, Mail, Award, Building2, Star, EyeOff, Percent, Globe, ShieldCheck, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getDoctorDetail, updateDoctorMarketing, type DoctorDetail } from '../services/doctorService';
import { copyToClipboard } from '../../../utils/clipboard';
import './DoctorDetailModal.css';

// No official public API exists for verifying an Indian doctor's registration (the NMC's Indian
// Medical Register only has a manual web-search UI, no documented programmatic access) — so
// "Verify" copies the registration number and opens the NMC's own register for the admin to
// confirm by hand, rather than pretending to auto-verify.
const NMC_IMR_SEARCH_URL = 'https://www.nmc.org.in/information-desk/indian-medical-register/';

interface DoctorDetailModalProps {
    doctorId: string;
    onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="detail-section">
        <h4 className="detail-section-title">{title}</h4>
        {children}
    </div>
);

const Field: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
    <div className="detail-field">
        <span className="detail-field-label">{label}</span>
        <span className="detail-field-value">{value ?? <span className="detail-empty">—</span>}</span>
    </div>
);

const formatMoney = (n: number | null): string => (n != null ? `₹${n.toLocaleString('en-IN')}` : '—');
const formatDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const formatDateTime = (iso: string | null): string => {
    if (!iso) return 'Never logged in';
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const DoctorDetailModal: React.FC<DoctorDetailModalProps> = ({ doctorId, onClose }) => {
    const [detail, setDetail] = useState<DoctorDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDoctorDetail(doctorId)
            .then(d => { if (!cancelled) setDetail(d); })
            .catch(() => { if (!cancelled) setError('Failed to load doctor details.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [doctorId]);

    const handleVerifyOnNmc = async (licenseNumber: string) => {
        const copied = await copyToClipboard(licenseNumber);
        toast[copied ? 'success' : 'message'](
            copied
                ? 'Registration number copied — paste it into the search form on the page that just opened.'
                : `Registration number: ${licenseNumber} — search for it on the page that just opened.`
        );
        window.open(NMC_IMR_SEARCH_URL, '_blank', 'noopener,noreferrer');
    };

    // Full-replace marketing save, reusing the doctor's already-loaded Featured/Delisted/discount
    // values so this toggle only ever changes IsRegistrationVerified — same endpoint the Edit
    // modal's form uses, just with everything else round-tripped unchanged.
    const handleToggleVerified = async () => {
        if (!detail) return;
        const nextVerified = !detail.isRegistrationVerified;
        setVerifying(true);
        try {
            await updateDoctorMarketing(detail.doctorId, {
                isFeatured: detail.isFeatured,
                isDelistedByAdmin: detail.isDelistedByAdmin,
                isRegistrationVerified: nextVerified,
                discountPercent: detail.discountPercent,
                discountStartAt: detail.discountStartAt,
                discountEndAt: detail.discountEndAt,
            });
            setDetail({
                ...detail,
                isRegistrationVerified: nextVerified,
                registrationVerifiedAt: nextVerified ? new Date().toISOString() : null,
            });
            toast.success(nextVerified ? 'Marked as verified.' : 'Verification removed.');
        } catch {
            toast.error('Could not update verification status.');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="reject-modal-overlay" onClick={onClose}>
            <div className="doctor-detail-modal" onClick={e => e.stopPropagation()}>
                <button className="doctor-detail-close" onClick={onClose} aria-label="Close"><X size={18} /></button>

                {loading ? (
                    <div className="doctor-detail-loading">Loading doctor profile…</div>
                ) : error ? (
                    <div className="doctor-detail-loading" style={{ color: '#dc2626' }}>{error}</div>
                ) : detail ? (
                    <>
                        <div className="premium-doctor-banner">
                            <div className="premium-banner-pattern"></div>
                        </div>
                        <div className="doctor-detail-header premium-header-overlap">
                            <div className="doctor-detail-avatar premium-avatar-large">
                                {detail.photoUrl ? (
                                    <img src={detail.photoUrl} alt={detail.fullName ?? 'Doctor'} />
                                ) : (
                                    <span>{detail.fullName ? detail.fullName[0].toUpperCase() : 'D'}</span>
                                )}
                            </div>
                            
                            <div className="premium-header-content">
                                <div className="doctor-detail-identity">
                                    <h3 className="premium-doctor-name">{detail.fullName || 'Unnamed doctor'}</h3>
                                    <p className="premium-doctor-sub">{detail.qualification || '—'}{detail.experienceYears != null ? ` • ${detail.experienceYears} yrs experience` : ''}</p>
                                    <div className="doctor-detail-badges" style={{ marginTop: '12px' }}>
                                        {detail.isRegistrationVerified && (
                                            <span className="doctor-badge doctor-badge-verified" title={`Verified on ${formatDate(detail.registrationVerifiedAt)}`}>
                                                <BadgeCheck size={12} /> NMC Verified
                                            </span>
                                        )}
                                        {detail.isFeatured && <span className="doctor-badge doctor-badge-featured"><Star size={12} /> Featured</span>}
                                        {detail.isDelistedByAdmin && <span className="doctor-badge doctor-badge-delisted"><EyeOff size={12} /> Delisted</span>}
                                        {detail.discountPercent != null && detail.discountPercent > 0 && (
                                            <span className="doctor-badge doctor-badge-discount"><Percent size={12} /> {detail.discountPercent}% off</span>
                                        )}
                                        <span className={`doctor-badge ${detail.isPubliclyListed ? 'doctor-badge-discount' : 'doctor-badge-delisted'}`}>
                                            {detail.isPubliclyListed ? 'Publicly listed' : 'Not publicly listed'}
                                        </span>
                                    </div>
                                </div>
                                <div className="doctor-detail-completion premium-completion-card">
                                    <span className="doctor-detail-completion-value">{detail.profileCompletionPercent}%</span>
                                    <span className="doctor-detail-completion-label">Profile complete</span>
                                </div>
                            </div>
                        </div>

                        <div className="doctor-detail-body">
                            <Section title="Contact">
                                <div className="detail-grid">
                                    <Field label={<><Phone size={12} /> Mobile</>} value={detail.mobileNumber} />
                                    <Field label={<><Mail size={12} /> Email</>} value={detail.email} />
                                    <Field label="Public contact email" value={detail.publicContactEmail} />
                                    <Field label="Public contact phone" value={detail.publicContactPhone} />
                                </div>
                            </Section>

                            <Section title="License &amp; registration">
                                <div className="detail-grid">
                                    <Field label={<><Award size={12} /> License number</>} value={detail.licenseNumber} />
                                    <Field label="State medical council" value={detail.medicalCouncil} />
                                    <Field label="Registration year" value={detail.registrationYear} />
                                    <Field label="On platform since" value={formatDate(detail.createdAt)} />
                                    <Field label="Last login" value={formatDateTime(detail.lastLoginTime)} />
                                </div>
                                {detail.licenseNumber && (
                                    <div className="doctor-detail-verify-row">
                                        <button
                                            type="button"
                                            className="doctor-detail-verify-btn"
                                            onClick={() => handleVerifyOnNmc(detail.licenseNumber!)}
                                        >
                                            <ShieldCheck size={14} /> Verify on NMC Register
                                        </button>
                                        <button
                                            type="button"
                                            className={detail.isRegistrationVerified ? 'doctor-detail-verify-btn doctor-detail-verify-btn-active' : 'doctor-detail-verify-btn'}
                                            onClick={handleToggleVerified}
                                            disabled={verifying}
                                        >
                                            <BadgeCheck size={14} />
                                            {detail.isRegistrationVerified ? 'Remove verified mark' : 'Mark as verified'}
                                        </button>
                                        <span className="doctor-detail-verify-note">
                                            {detail.isRegistrationVerified
                                                ? `Confirmed on ${formatDate(detail.registrationVerifiedAt)}. Shows as a "Verified profile" badge on Doctor Dekho.`
                                                : 'India has no automated verification API — this copies the registration number and opens the National Medical Register for manual confirmation. Once you\'ve checked it there, mark it verified here.'}
                                        </span>
                                    </div>
                                )}
                            </Section>

                            <Section title="Professional profile">
                                <div className="detail-grid">
                                    <Field label="Qualification" value={detail.qualification} />
                                    <Field label="Experience" value={detail.experienceYears != null ? `${detail.experienceYears} years` : null} />
                                </div>
                                {detail.bio && <p className="doctor-detail-bio">{detail.bio}</p>}
                                <div className="doctor-detail-chips-row">
                                    <span className="doctor-detail-chips-label"><Stethoscope size={12} /> Specializations</span>
                                    <div className="doctor-detail-chips">
                                        {detail.specializations.length > 0
                                            ? detail.specializations.map(s => <span key={s} className="doctor-detail-chip">{s}</span>)
                                            : <span className="detail-empty">—</span>}
                                    </div>
                                </div>
                                <div className="doctor-detail-chips-row">
                                    <span className="doctor-detail-chips-label"><Globe size={12} /> Languages</span>
                                    <div className="doctor-detail-chips">
                                        {detail.languages.length > 0
                                            ? detail.languages.map(l => <span key={l} className="doctor-detail-chip">{l}</span>)
                                            : <span className="detail-empty">—</span>}
                                    </div>
                                </div>
                            </Section>

                            <Section title="Hospital affiliations">
                                {detail.hospitals.length === 0 ? (
                                    <p className="detail-empty">No hospital affiliation on record.</p>
                                ) : (
                                    <div className="doctor-detail-hospitals">
                                        {detail.hospitals.map(h => (
                                            <div key={h.hospitalId} className="doctor-detail-hospital-card">
                                                <div className="doctor-detail-hospital-name">
                                                    <Building2 size={14} /> {h.hospitalName || 'Unnamed hospital'}
                                                </div>
                                                {h.hospitalAddress && (
                                                    <div className="doctor-detail-hospital-address">{h.hospitalAddress}</div>
                                                )}
                                                <div className="detail-grid">
                                                    <Field label="Department" value={h.departmentName} />
                                                    <Field label="OPD consult fee" value={formatMoney(h.opdConsultFee)} />
                                                    <Field label="IPD visit fee" value={formatMoney(h.ipdVisitFee)} />
                                                    <Field label="Emergency fee" value={formatMoney(h.emergencyFee)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Section>

                            {(detail.discountPercent != null && detail.discountPercent > 0) && (
                                <Section title="Active discount">
                                    <div className="detail-grid">
                                        <Field label="Discount" value={`${detail.discountPercent}%`} />
                                        <Field label="Starts" value={formatDate(detail.discountStartAt)} />
                                        <Field label="Ends" value={formatDate(detail.discountEndAt)} />
                                    </div>
                                </Section>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default DoctorDetailModal;
