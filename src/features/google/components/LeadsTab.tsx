import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { GOOGLE_MOCK } from '../access';
import { googleService, googleError } from '../services/googleService';
import type { GoogleAccount, GoogleLeadPage, GoogleLeadSource } from '../types';
import { ago, day, pct, when } from '../googleUtils';
import { LeadDetailDrawer } from '../../marketing/components/LeadDetailDrawer';
import { adminService, type Assignee } from '../../admin/services/adminService';

// Google → Leads: people from the website's contact form (with Google's click ID when they came from an ad) and
// from Google Ads lead forms. Every row is a CRM lead, so its stage and owner are the CRM's; "Told Google" is the
// latest result sent back to Google Ads.

const SOURCES: { id: GoogleLeadSource; label: string }[] = [{ id: '', label: 'All' }, { id: 'web', label: 'Website forms' }, { id: 'form', label: 'Google lead forms' }];
const STAGE_CLASS: Record<string, string> = { New: 'wa-st-wait', Contacted: 'wa-st-warn', 'Closed Won': 'wa-st-ok', 'Closed Lost': 'wa-st-bad' };

export default function LeadsTab({ account }: { account: GoogleAccount }) {
  const perms = useAuthStore(s => s.permissions) || [];
  const canOpen = !GOOGLE_MOCK && perms.includes('marketing.view');
  const [source, setSource] = useState<GoogleLeadSource>('');
  const [campaign, setCampaign] = useState('');
  const [page, setPage] = useState<GoogleLeadPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [size, setSize] = useState(50);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [users, setUsers] = useState<Assignee[]>([]);

  useEffect(() => {
    let live = true;
    googleService.leads({ accountId: account.accountId, source: source || undefined, campaign: campaign || undefined, page: 1, pageSize: size })
      .then(p => { if (live) { setPage(p); setError(null); } })
      .catch(e => { if (live) setError(googleError(e)); });
    return () => { live = false; };
  }, [account.accountId, source, campaign, size, version]);
  useEffect(() => { if (canOpen) adminService.getAssignees().then(setUsers).catch(() => { /* drawer still opens */ }); }, [canOpen]);

  const s = page?.summary;
  return (
    <div className="wa-pad">
      {s && (
        <div className="wa-tiles">
          <div className="wa-tile"><span>Leads from Google, last 7 days</span><b>{s.last7Days}</b><span>website forms {s.web7} · Google lead forms {s.forms7}</span></div>
          <div className="wa-tile"><span>Not contacted yet</span><b>{s.notContacted}</b><span>{s.oldestNotContactedAt ? `oldest ${ago(s.oldestNotContactedAt)} ago` : 'none waiting'}</span></div>
          <div className="wa-tile"><span>Reached a demo, this month</span><b>{s.reachedDemoThisMonth}</b><span>{pct(s.reachedDemoThisMonth, s.leadsThisMonth)} of this month's Google leads</span></div>
          <div className="wa-tile"><span>Results sent to Google, this month</span><b>{s.sentThisMonth}</b><span>so ads aim at people who buy</span></div>
        </div>
      )}

      <div className="hw-bar wa-bar wa-flush">
        <div className="sc-seg" role="group" aria-label="Came from">
          {SOURCES.map(x => <button key={x.id || 'all'} type="button" className={source === x.id ? 'on' : ''} aria-pressed={source === x.id} onClick={() => setSource(x.id)}>{x.label}</button>)}
        </div>
        {(page?.campaigns.length ?? 0) > 0 && (
          <select value={campaign} onChange={e => setCampaign(e.target.value)} aria-label="Campaign">
            <option value="">All campaigns</option>
            {page!.campaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {error && <p className="hw-err">{error}</p>}
      {!page && !error && <p className="hw-muted">Loading…</p>}
      {page && page.items.length === 0 && <p className="hw-empty">No leads from Google yet{source || campaign ? ' here' : ''}. Website forms come in as soon as the site sends them; Google lead forms once their webhook is set in Setup.</p>}
      {page && page.items.length > 0 && (
        <div className="hw-tbl">
          <table>
            <thead><tr><th>Person</th><th>Came from</th><th>Campaign and search</th><th>Their answers</th><th>Received</th><th>Stage</th><th>Told Google</th>{canOpen && <th />}</tr></thead>
            <tbody>
              {page.items.map(l => (
                <tr key={l.googleLeadId}>
                  <td><b>{l.name}</b><div className="hw-muted wa-small">{[l.phone, l.email].filter(Boolean).join(' · ')}</div></td>
                  <td>{l.source === 'form' ? 'Google lead form' : 'Website form'}{l.formName && <div className="hw-muted wa-small">{l.formName}</div>}</td>
                  <td>
                    {l.campaignName ?? (l.fromGoogleAd ? 'Google ad' : '—')}
                    <div className="hw-muted wa-small">{l.keyword ? `searched: ${l.keyword}` : !l.fromGoogleAd ? `no Google click${l.utmSource ? `: came from ${l.utmSource}` : ''}` : ''}</div>
                  </td>
                  <td className="sc-answers">{l.answers.length ? l.answers.map(a => <div key={a.name}><span className="hw-muted">{a.name}:</span> {a.value}</div>) : '—'}</td>
                  <td className="sc-nowrap">{when(l.receivedAt)}</td>
                  <td>{l.stage ? <span className={`wa-st ${STAGE_CLASS[l.stage] ?? ''}`}>{l.stage}</span> : l.inCrm ? '—' : <span className="wa-st wa-st-bad">Removed from the CRM</span>}</td>
                  <td className="wa-small">
                    {l.sendError ? <span className="hw-err">Refused: {l.sendError}</span>
                      : l.sentStage ? <>{l.sentStage}{l.sentAt ? ` · sent ${day(l.sentAt)}` : ''}</>
                        : <span className="hw-muted">{l.fromGoogleAd ? 'Not yet' : 'Not from a Google ad: nothing to send'}</span>}
                  </td>
                  {canOpen && <td>{l.inCrm && <button type="button" className="hw-btn" onClick={() => setOpenLead(l.leadId)}>Open</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page && page.total > page.items.length && <button type="button" className="hw-btn sc-more" onClick={() => setSize(x => x + 50)}>Show more ({page.total - page.items.length} left)</button>}
      <p className="hw-muted wa-small">
        Every row is a CRM lead{canOpen ? '; open one to call, message or move its stage' : ''}. When a lead from a Google ad reaches a stage chosen in Setup, the CMS tells Google, without names or phone numbers. Google's test leads are not shown.
      </p>
      {canOpen && <LeadDetailDrawer leadId={openLead} isOpen={!!openLead} onClose={() => setOpenLead(null)} users={users} onUpdated={() => setVersion(v => v + 1)} />}
    </div>
  );
}
