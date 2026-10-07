import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { CONTRIBUTOR_TYPE_LABEL, isDoctor, type Contributor, type ContributorStatus, type ContributorType } from '../types';
import { ContributorStatusPill } from '../components/StatusPill';
import SectionNav from '../components/SectionNav';
import { refreshNavCounts } from '../components/navEvents';
import VerifyDialog from '../components/VerifyDialog';
import InviteDialog from '../components/InviteDialog';
import '../healthWiki.css';

const TYPES = Object.keys(CONTRIBUTOR_TYPE_LABEL) as ContributorType[];
const STATUSES: { key: ContributorStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'VERIFIED', label: 'Verified or approved' },
  { key: 'INVITED', label: 'Invited' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function ContributorsPage() {
  const [people, setPeople] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<ContributorType | ''>('');
  const [status, setStatus] = useState<ContributorStatus | ''>('');
  const [query, setQuery] = useState('');
  const [verifying, setVerifying] = useState<Contributor | null>(null);
  const [inviting, setInviting] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPeople(await healthWikiService.listContributors());
    } catch (e) {
      setFailed(true);
      toast.error(errorMessage(e, 'Could not load the contributors.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (c: Contributor) => setPeople((list) => list.map((p) => (p.contributorId === c.contributorId ? c : p)));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => (!type || p.type === type) && (!status || p.status === status) && (!q || `${p.fullName} ${p.mobile}`.toLowerCase().includes(q)));
  }, [people, type, status, query]);

  const resend = async (c: Contributor) => {
    setSendingTo(c.contributorId);
    try {
      replace(await healthWikiService.sendLink(c.contributorId));
      toast.success(`WhatsApp link sent to ${c.fullName}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not send the link. Try again.'));
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="hw-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><Users size={24} /> Health Wiki</h1>
          <p className="hw-sub">People who write or review articles. A doctor's badge shows only after you verify the registration.</p>
        </div>
        <button type="button" className="hw-btn hw-btn-primary" onClick={() => setInviting(true)}><UserPlus size={16} /> Invite contributor</button>
      </div>
      <SectionNav />

      <div className="hw-panel">
        <div className="hw-bar hw-filters">
          <Search size={15} />
          <input type="text" value={query} placeholder="Search name or number" aria-label="Search contributors" onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="Filter by role" value={type} onChange={(e) => setType(e.target.value as ContributorType | '')}>
            <option value="">All roles</option>
            {TYPES.map((t) => <option key={t} value={t}>{CONTRIBUTOR_TYPE_LABEL[t]}</option>)}
          </select>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as ContributorStatus | '')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="hw-empty">Loading contributors…</div>
        ) : failed ? (
          <div className="hw-empty">
            <AlertTriangle size={32} />
            <b>Couldn't load the contributors</b>
            <button type="button" className="hw-btn" onClick={load}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="hw-empty">
            <b>{people.length === 0 ? 'No contributors yet' : 'No contributors match'}</b>
            {people.length === 0 ? 'Use Invite contributor to send the first WhatsApp link.' : 'Try another filter or search.'}
          </div>
        ) : (
          <div className="hw-tbl">
            <table>
              <thead><tr><th>Person</th><th>Role</th><th>WhatsApp</th><th>Registration or work</th><th>Status</th><th><span className="hw-sr">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.contributorId} className="hw-static">
                    <td>
                      <div className="hw-title">{c.fullName}{c.enrolmentSource === 'SELF_ENROLLED' && <span className="hw-tag">Self-enrolled</span>}</div>
                      <div className="hw-slug">{c.speciality || c.roleTitle || 'Profile not filled in yet'}</div>
                    </td>
                    <td>{CONTRIBUTOR_TYPE_LABEL[c.type]}</td>
                    <td>{c.type === 'STAFF' ? <span className="hw-muted">Staff</span> : c.mobile}</td>
                    <td>
                      {isDoctor(c.type)
                        ? (c.registrationNumber ? `Reg. ${c.registrationNumber}, ${c.registrationCouncil ?? ''}` : <span className="hw-muted">Not provided</span>)
                        : (c.organisation || <span className="hw-muted">—</span>)}
                    </td>
                    <td>
                      <ContributorStatusPill type={c.type} status={c.status} />
                      {c.status === 'REJECTED' && c.rejectReason && <div className="hw-slug">{c.rejectReason}</div>}
                    </td>
                    <td className="hw-actions-cell">
                      {c.status === 'PENDING' && <button type="button" className="hw-btn hw-btn-primary hw-sm" onClick={() => setVerifying(c)}>{isDoctor(c.type) ? 'Verify' : 'Approve'}</button>}
                      {(c.status === 'INVITED' || (c.type === 'INDEPENDENT_DOCTOR' && c.status !== 'REJECTED')) && (
                        <button type="button" className="hw-btn hw-sm" disabled={sendingTo === c.contributorId} onClick={() => resend(c)}>
                          {c.linkSentAt ? 'Resend link' : 'Send link'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {verifying && <VerifyDialog contributor={verifying} onClose={() => setVerifying(null)} onDecided={(c) => { replace(c); setVerifying(null); refreshNavCounts(); }} />}
      {inviting && <InviteDialog onClose={() => setInviting(false)} onInvited={(c) => { setPeople((l) => [...l, c]); setInviting(false); }} />}
    </div>
  );
}
