import { useState } from 'react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { CONTRIBUTOR_TYPE_LABEL, NMC_REGISTER_URL, isDoctor, type Contributor } from '../types';
import Modal from './Modal';

interface Props {
  contributor: Contributor;
  onClose: () => void;
  onDecided: (c: Contributor) => void;
}

const row = (label: string, value: string | null) => (
  <>
    <dt>{label}</dt>
    <dd>{value || <span className="hw-muted">Not provided</span>}</dd>
  </>
);

export default function VerifyDialog({ contributor: c, onClose, onDecided }: Props) {
  const doctor = isDoctor(c.type);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    if (!approve && reason.trim().length < 3) {
      setError('Add a reason so the contributor can fix it.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const updated = approve ? await healthWikiService.verifyContributor(c.contributorId) : await healthWikiService.rejectContributor(c.contributorId, reason.trim());
      toast.success(approve ? `${c.fullName} is ${doctor ? 'verified' : 'approved'}` : `${c.fullName} was rejected and told why`);
      onDecided(updated);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the decision. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={doctor ? 'Verify registration' : 'Approve profile'} onClose={onClose}>
      <dl className="hw-dl">
        {row('Name', c.fullName)}
        {row('Role', CONTRIBUTOR_TYPE_LABEL[c.type])}
        {doctor ? (
          <>
            {row('Speciality', c.speciality)}
            {row('Qualifications', c.qualification)}
            {row('Registration number', c.registrationNumber)}
            {row('Council', c.registrationCouncil)}
          </>
        ) : (
          <>
            {row('Job title', c.roleTitle)}
            {row('Organisation', c.organisation)}
          </>
        )}
        {row('WhatsApp', c.mobile)}
      </dl>
      {doctor && (
        <div className="hw-banner info">
          Check the number and name on the NMC Indian Medical Register, then confirm.{' '}
          <a href={NMC_REGISTER_URL} target="_blank" rel="noopener noreferrer">Open the register</a>
        </div>
      )}
      <div className="hw-field">
        <label className="hw-label" htmlFor="rej-reason">If rejecting, say why</label>
        <input id="rej-reason" type="text" value={reason} placeholder="For example: number does not match the name" onChange={(e) => setReason(e.target.value)} />
        {error && <span className="hw-err">{error}</span>}
      </div>
      <div className="hw-modal-actions">
        <button type="button" className="hw-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="hw-btn" disabled={busy} onClick={() => decide(false)}>Reject</button>
        <button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={() => decide(true)}>{doctor ? 'Mark as verified' : 'Approve'}</button>
      </div>
    </Modal>
  );
}
