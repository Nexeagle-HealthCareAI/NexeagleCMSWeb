import React, { useState } from 'react';
import { bulkUpdateDoctorMarketing, type BulkUpdateDoctorMarketingPayload } from '../services/doctorService';

interface BulkEditModalProps {
    doctorIds: string[];
    onClose: () => void;
    onSaved: () => void;
}

type TriState = 'nochange' | 'true' | 'false';

const fromLocalInputValue = (local: string): string | null => (local ? new Date(local).toISOString() : null);

export const BulkEditModal: React.FC<BulkEditModalProps> = ({ doctorIds, onClose, onSaved }) => {
    const [featured, setFeatured] = useState<TriState>('nochange');
    const [delisted, setDelisted] = useState<TriState>('nochange');
    const [updateDiscount, setUpdateDiscount] = useState(false);
    const [discountPercent, setDiscountPercent] = useState('');
    const [discountStartAt, setDiscountStartAt] = useState('');
    const [discountEndAt, setDiscountEndAt] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const hasAnyChange = featured !== 'nochange' || delisted !== 'nochange' || updateDiscount;

    const handleSave = async () => {
        if (!hasAnyChange) {
            setSaveError('Pick at least one change to apply.');
            return;
        }

        const percent = discountPercent.trim() === '' ? null : Number(discountPercent);
        if (updateDiscount && percent != null && (Number.isNaN(percent) || percent < 0 || percent > 100)) {
            setSaveError('Discount percent must be between 0 and 100.');
            return;
        }
        const startAt = fromLocalInputValue(discountStartAt);
        const endAt = fromLocalInputValue(discountEndAt);
        if (updateDiscount && startAt && endAt && new Date(endAt) < new Date(startAt)) {
            setSaveError('Discount end date cannot be before the start date.');
            return;
        }

        const payload: BulkUpdateDoctorMarketingPayload = {
            doctorIds,
            isFeatured: featured === 'nochange' ? undefined : featured === 'true',
            isDelistedByAdmin: delisted === 'nochange' ? undefined : delisted === 'true',
            updateDiscount,
            discountPercent: updateDiscount ? percent : undefined,
            discountStartAt: updateDiscount ? startAt : undefined,
            discountEndAt: updateDiscount ? endAt : undefined,
        };

        try {
            setSaving(true);
            setSaveError(null);
            await bulkUpdateDoctorMarketing(payload);
            onSaved();
        } catch (err: any) {
            setSaveError(err.response?.data?.message || 'Failed to apply bulk changes.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="reject-modal-overlay" onClick={() => !saving && onClose()}>
            <div className="reject-modal" onClick={e => e.stopPropagation()}>
                <div className="reject-modal-header">
                    <h3>Bulk edit {doctorIds.length} doctor{doctorIds.length === 1 ? '' : 's'}</h3>
                </div>
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                    Only the changes you pick below are applied — anything left as "No change" stays exactly as it is for every selected doctor.
                </p>

                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                        Featured
                    </label>
                    <select className="doctor-form-input" value={featured} onChange={e => setFeatured(e.target.value as TriState)}>
                        <option value="nochange">No change</option>
                        <option value="true">Feature</option>
                        <option value="false">Un-feature</option>
                    </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                        Listing status
                    </label>
                    <select className="doctor-form-input" value={delisted} onChange={e => setDelisted(e.target.value as TriState)}>
                        <option value="nochange">No change</option>
                        <option value="true">Delist</option>
                        <option value="false">Re-list (remove delist)</option>
                    </select>
                </div>

                <label className="doctor-form-checkbox">
                    <input
                        type="checkbox"
                        checked={updateDiscount}
                        onChange={e => setUpdateDiscount(e.target.checked)}
                    />
                    <div>
                        <div style={{ fontWeight: 700 }}>Update consultation-fee discount</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Replaces any existing discount on every selected doctor with the value below.</div>
                    </div>
                </label>

                {updateDiscount && (
                    <>
                        <div style={{ marginTop: 4 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                                Discount (%)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                placeholder="e.g. 20 — leave blank to remove any discount"
                                value={discountPercent}
                                onChange={e => setDiscountPercent(e.target.value)}
                                className="doctor-form-input"
                            />
                        </div>

                        <div className="doctor-modal-row">
                            <div className="doctor-modal-col">
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                                    Starts
                                </label>
                                <input
                                    type="datetime-local"
                                    value={discountStartAt}
                                    onChange={e => setDiscountStartAt(e.target.value)}
                                    className="doctor-form-input"
                                />
                            </div>
                            <div className="doctor-modal-col">
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                                    Ends
                                </label>
                                <input
                                    type="datetime-local"
                                    value={discountEndAt}
                                    onChange={e => setDiscountEndAt(e.target.value)}
                                    className="doctor-form-input"
                                />
                            </div>
                        </div>
                    </>
                )}

                {saveError && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
                        {saveError}
                    </div>
                )}

                <div className="form-actions" style={{ marginTop: 20 }}>
                    <button className="cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="approve-btn" onClick={handleSave} disabled={saving || !hasAnyChange}>
                        {saving ? 'Applying...' : `Apply to ${doctorIds.length} doctor${doctorIds.length === 1 ? '' : 's'}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
