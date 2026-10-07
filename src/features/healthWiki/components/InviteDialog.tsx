import { useState } from 'react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import type { Contributor, InviteContributorPayload } from '../types';
import Modal from './Modal';

type InviteType = InviteContributorPayload['type'];

interface Props {
  onClose: () => void;
  onInvited: (c: Contributor) => void;
}

export default function InviteDialog({ onClose, onInvited }: Props) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [type, setType] = useState<InviteType>('INDEPENDENT_DOCTOR');
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const digits = mobile.replace(/\D/g, '');
    const e: typeof errors = {};
    if (!fullName.trim()) e.name = 'Enter the name.';
    if (digits.length !== 10) e.mobile = 'Enter a 10-digit mobile number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const c = await healthWikiService.inviteContributor({ fullName: fullName.trim(), mobile: digits, type });
      toast.success(`Link sent to ${c.fullName} on WhatsApp`);
      onInvited(c);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send the invitation. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Invite a contributor" onClose={onClose}>
      <p className="hw-sub">We send a one-time link on WhatsApp. It works for 7 days and only for this number.</p>
      <div className="hw-field">
        <label className="hw-label" htmlFor="inv-type">Role</label>
        <select id="inv-type" value={type} onChange={(e) => setType(e.target.value as InviteType)}>
          <option value="INDEPENDENT_DOCTOR">Independent doctor</option>
          <option value="HEALTH_WORKER">Health worker</option>
          <option value="WRITER">Writer / technologist</option>
        </select>
      </div>
      <div className="hw-field">
        <label className="hw-label" htmlFor="inv-name">Full name</label>
        <input id="inv-name" type="text" value={fullName} placeholder="Dr. Full Name" onChange={(e) => setFullName(e.target.value)} />
        {errors.name && <span className="hw-err">{errors.name}</span>}
      </div>
      <div className="hw-field">
        <label className="hw-label" htmlFor="inv-mobile">WhatsApp number</label>
        <input id="inv-mobile" type="text" inputMode="numeric" value={mobile} placeholder="98765 43210" onChange={(e) => setMobile(e.target.value)} />
        {errors.mobile && <span className="hw-err">{errors.mobile}</span>}
      </div>
      <div className="hw-modal-actions">
        <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={send}>Send WhatsApp link</button>
      </div>
    </Modal>
  );
}
