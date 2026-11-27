import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { SOCIAL_MOCK, type SocialCan } from '../access';
import { socialService, socialError } from '../services/socialService';
import type { LeadSource, SocialAccount, SocialLeadForm, SocialLeadPage } from '../types';
import { ago, LEAD_SOURCE, money, when } from '../socialUtils';
import { LeadDetailDrawer } from '../../marketing/components/LeadDetailDrawer';
import { adminService, type Assignee } from '../../admin/services/adminService';

// Social → Leads: people from lead forms, and people who messaged or commented and were made a lead. Every
// row is a CRM lead (CmsSalesLeads), so its stage and owner are the CRM's. The missed-lead check compares
// Meta's count per form with the CRM's and brings in what the webhook missed.

const SOURCES: { id: LeadSource; label: string }[] = [
  { id: '', label: 'All' }, { id: 'form', label: 'Lead forms' }, { id: 'messenger', label: 'Messenger' }, { id: 'instagram', label: 'Instagram' }, { id: 'comment', label: 'Comments' },
];
const STAGE_CLASS: Record<string, string> = { New: 'wa-st-wait', Contacted: 'wa-st-warn', 'Closed Won': 'wa-st-ok', 'Closed Lost': 'wa-st-bad' };

export default function LeadsTab({ account, can }: { account: SocialAccount; can: SocialCan }) {
  const perms = useAuthStore(s => s.permissions) || [];
  const canOpen = !SOCIAL_MOCK && perms.includes('marketing.view');
  const [source, setSource] = useState<LeadSource>('');
  const [formId, setFormId] = useState('');
  const [page, setPage] = useState<SocialLeadPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [cpl, setCpl] = useState<{ value: number | null; currency: string } | null>(null);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [users, setUsers] = useState<Assignee[]>([]);
  const [size, setSize] = useState(50);

  useEffect(() => {
    let live = true;
    socialService.leads({ accountId: account.accountId, source: source || undefined, formId: formId || undefined, page: 1, pageSize: size })
      .then(p => { if (live) { setPage(p); setError(null); } })
      .catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [account.accountId, source, formId, version, size]);
  useEffect(() => {
    if (!can.ads || !account.adAccountId) return;
    const to = new Date(); const from = new Date(Date.now() - 29 * 86_400_000);
    socialService.ads({ accountId: account.accountId, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), level: 'campaign' })
      .then(a => setCpl({ value: a.costPerLead ?? null, currency: a.currency })).catch(() => { /* tile is optional */ });
  }, [account.accountId, account.adAccountId, can.ads]);
  useEffect(() => { if (canOpen) adminService.getAssignees().then(setUsers).catch(() => { /* drawer still opens */ }); }, [canOpen]);

  const s = page?.summary;
  const missing = (page?.forms ?? []).filter(f => f.missing > 0);

  return (
    <div className="wa-pad">
      <MissedCheck account={account} can={can} forms={page?.forms ?? []} missing={missing} onDone={() => setVersion(v => v + 1)} />

      {s && (
        <div className="wa-tiles">
          <div className="wa-tile"><span>New leads, last 7 days</span><b>{s.last7Days}</b><span>{s.fromForms7} lead forms · {s.fromChats7} chats and comments</span></div>
          <div className="wa-tile"><span>Not contacted yet</span><b>{s.notContacted}</b><span>{s.oldestNotContactedAt ? `oldest ${ago(s.oldestNotContactedAt)} ago` : 'none waiting'}</span></div>
          <div className="wa-tile"><span>Became customers</span><b>{s.customers}</b><span>stage “Closed Won” in the CRM</span></div>
          {cpl && <div className="wa-tile"><span>Cost per lead (ads, 30 days)</span><b>{money(cpl.value, cpl.currency)}</b><span><Link to="/social/ads">See ads</Link></span></div>}
        </div>
      )}

      <div className="hw-bar wa-bar wa-flush">
        <div className="sc-seg" role="group" aria-label="Came from">
          {SOURCES.map(x => <button key={x.id || 'all'} type="button" className={source === x.id ? 'on' : ''} aria-pressed={source === x.id} onClick={() => setSource(x.id)}>{x.label}</button>)}
        </div>
        {(page?.forms.length ?? 0) > 0 && (
          <select value={formId} onChange={e => setFormId(e.target.value)} aria-label="Form">
            <option value="">All forms</option>
            {page!.forms.map(f => <option key={f.formId} value={f.formId}>{f.name}</option>)}
          </select>
        )}
      </div>

      {error && <p className="hw-err">{error}</p>}
      {!page && !error && <p className="hw-muted">Loading…</p>}
      {page && page.items.length === 0 && <p className="hw-empty">No leads yet{source ? ' from here' : ''}. Lead forms come in by themselves once webhooks are connected; chats and comments become leads from the Inbox.</p>}
      {page && page.items.length > 0 && (
        <div className="hw-tbl">
          <table className="sc-leads">
            <thead><tr><th>Person</th><th>Came from</th><th>Ad or post</th><th>Their answers</th><th>Received</th><th>Stage</th><th>Owner</th>{canOpen && <th />}</tr></thead>
            <tbody>
              {page.items.map(l => (
                <tr key={l.socialLeadId}>
                  <td><b>{l.name}</b><div className="hw-muted wa-small">{[l.phone, l.email].filter(Boolean).join(' · ')}</div></td>
                  <td>{LEAD_SOURCE[l.source] ?? l.source}{l.formName && <div className="hw-muted wa-small">{l.formName}</div>}</td>
                  <td>{l.adName ?? (l.isOrganic ? 'Organic (no ad)' : '—')}{l.campaignName && <div className="hw-muted wa-small">{l.campaignName}{l.platform ? ` · ${l.platform === 'ig' ? 'Instagram' : l.platform === 'fb' ? 'Facebook' : l.platform}` : ''}</div>}</td>
                  <td className="sc-answers">{l.answers.length ? l.answers.map(a => <div key={a.name}><span className="hw-muted">{a.name}:</span> {a.value}</div>) : '—'}</td>
                  <td className="sc-nowrap">{when(l.receivedAt)}</td>
                  <td>{l.stage ? <span className={`wa-st ${STAGE_CLASS[l.stage] ?? ''}`}>{l.stage}</span> : l.inCrm ? '—' : <span className="wa-st wa-st-bad">Removed from the CRM</span>}</td>
                  <td>{l.owner ?? <span className="hw-muted">Nobody yet</span>}</td>
                  {canOpen && <td>{l.inCrm && <button type="button" className="hw-btn" onClick={() => setOpenLead(l.leadId)}>Open</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page && page.total > page.items.length && <button type="button" className="hw-btn sc-more" onClick={() => setSize(x => x + 50)}>Show more ({page.total - page.items.length} left)</button>}
      <p className="hw-muted wa-small">
        Every row is a CRM lead{canOpen ? '; open one to call, message or move its stage' : ''}. Leads made from a chat or comment keep it attached.
      </p>
      {canOpen && <LeadDetailDrawer leadId={openLead} isOpen={!!openLead} onClose={() => setOpenLead(null)} users={users} onUpdated={() => setVersion(v => v + 1)} />}
    </div>
  );
}

function MissedCheck({ account, can, forms, missing, onDone }: { account: SocialAccount; can: SocialCan; forms: SocialLeadForm[]; missing: SocialLeadForm[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [checked, setChecked] = useState<SocialLeadForm[] | null>(null);
  const list = checked ?? forms;
  const gaps = checked ? checked.filter(f => f.missing > 0) : missing;
  const lastCheck = list.map(f => f.checkedAt).filter(Boolean).sort().pop();

  const check = async () => {
    setBusy('check');
    try { const r = await socialService.checkForms(account.accountId); setChecked(r); toast.success(r.some(f => f.missing > 0) ? 'Some leads are missing.' : 'Nothing missing.'); }
    catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };
  const bring = async (f: SocialLeadForm) => {
    setBusy(f.formId);
    try {
      const r = await socialService.importMissing(account.accountId, f.formId);
      toast.success(r.message ?? `${r.data} brought in.`);
      setChecked(c => (c ?? forms).map(x => (x.formId === f.formId ? { ...x, missing: 0, crmCount: x.metaCount } : x)));
      onDone();
    } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };

  if (!account.pageId) return null;
  return (
    <div className={`sc-missed${gaps.length ? ' gap' : ''}`} role="status">
      <div className="wa-grow">
        <b>Missed-lead check:</b>{' '}
        {list.length === 0 ? 'no lead forms found on the Page yet.'
          : gaps.length === 0 ? `every lead in the last 30 days is in the CRM (${list.length} form${list.length === 1 ? '' : 's'}).`
            : gaps.map(f => <span key={f.formId}>Meta has {f.metaCount} leads for the form “{f.name}” in the last 30 days; the CRM has {f.crmCount}. </span>)}
        {lastCheck && <span className="hw-muted"> Checked {ago(lastCheck)} ago.</span>}
      </div>
      {can.reply && gaps.map(f => (
        <button key={f.formId} type="button" className="hw-btn hw-btn-primary" disabled={!!busy} onClick={() => bring(f)}>
          {busy === f.formId ? 'Bringing in…' : `Bring in the missing lead${f.missing === 1 ? '' : 's'} (${f.missing})`}
        </button>
      ))}
      <button type="button" className="hw-btn" disabled={!!busy} onClick={check}><RefreshCw size={13} /> {busy === 'check' ? 'Checking…' : 'Check now'}</button>
    </div>
  );
}
