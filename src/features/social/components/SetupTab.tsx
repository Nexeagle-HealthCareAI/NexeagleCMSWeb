import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Circle, Copy, Eye, EyeOff, RefreshCw, XCircle } from 'lucide-react';
import type { SocialCan } from '../access';
import { isConflict, socialService, socialError } from '../services/socialService';
import type { MetaAssets, SocialAccount, SocialChecks, SocialSetup } from '../types';
import { ago, when } from '../socialUtils';

// Social → Setup: connect a Facebook Page, its Instagram account and an ad account without touching servers.
// Keys are typed in here and stored encrypted; the checklist shows what is still missing. The same Meta app and
// system user as WhatsApp marketing can be used. Several accounts (e.g. NexEagle and Doctor Dekho) can be added.

const ICON = {
  ok: <CheckCircle2 size={17} className="wa-ck-ok" aria-label="Done" />,
  warn: <AlertTriangle size={17} className="wa-ck-warn" aria-label="Check" />,
  fail: <XCircle size={17} className="wa-ck-fail" aria-label="Problem" />,
  todo: <Circle size={17} className="wa-ck-todo" aria-label="To do" />,
};
const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); } };

export default function SetupTab({ account, can, onChanged, onCreated }: { account: SocialAccount | null; can: SocialCan; onChanged: () => void; onCreated: (id: string) => void }) {
  const [setup, setSetup] = useState<SocialSetup | null>(null);
  const [checks, setChecks] = useState<SocialChecks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!account) return;
    let live = true;
    setChecks(null);
    socialService.setup(account.accountId).then(s => { if (live) { setSetup(s); setError(null); } }).catch(e => { if (live) setError(socialError(e)); });
    socialService.checks(account.accountId).then(c => { if (live) setChecks(c); })
      .catch(e => { if (live) setChecks({ ready: false, permissions: [], items: [{ key: 'x', label: 'Checks', state: 'fail', detail: socialError(e) }] }); });
    return () => { live = false; };
  }, [account, version]);

  const reload = () => { setVersion(v => v + 1); onChanged(); };
  const recheck = async () => {
    if (!account) return;
    setChecking(true);
    try { setChecks(await socialService.checks(account.accountId)); } catch (e) { toast.error(socialError(e)); } finally { setChecking(false); }
  };

  if (!account) {
    return (
      <div className="wa-pad wa-settings">
        <section className="wa-chart-card">
          <h3 className="wa-h3">Connect the first Facebook Page and Instagram account</h3>
          {can.connect ? <AddAccount onCreated={onCreated} label="Name it (e.g. the company or product)" /> : <p className="hw-muted wa-small">Someone with “Connect social accounts” does this.</p>}
        </section>
      </div>
    );
  }
  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!setup) return <p className="hw-muted wa-pad">Loading…</p>;
  const edit = can.connect && setup.canEdit;
  const tokenOk = checks?.items.some(i => i.key === 'token' && i.state === 'ok') ?? setup.hasToken;

  return (
    <div className="wa-pad wa-settings">
      <section className={`wa-chart-card wa-status${checks?.ready ? ' ready' : ''}`}>
        <div className="wa-row wa-between">
          <h3 className="wa-h3">{checks == null ? 'Checking with Meta…' : checks.ready ? `${setup.name}: connected` : `${setup.name}: not fully connected yet`}</h3>
          <button type="button" className="hw-btn" onClick={recheck} disabled={checking || checks == null}><RefreshCw size={13} /> {checking ? 'Checking…' : 'Check again'}</button>
        </div>
        <ul className="wa-checklist">
          {(checks?.items ?? []).map(c => <li key={c.key}>{ICON[c.state]}<div><b>{c.label}</b>{c.detail && <div className="hw-muted wa-small">{c.detail}</div>}</div></li>)}
        </ul>
        {(setup.postsSyncedAt || setup.syncError) && (
          <p className="hw-muted wa-small">
            {setup.postsSyncedAt && <>Posts last read {ago(setup.postsSyncedAt)} ago. </>}
            {setup.adsSyncedAt && <>Ads {ago(setup.adsSyncedAt)} ago. </>}
            {setup.leadsCheckedAt && <>Missed-lead check {ago(setup.leadsCheckedAt)} ago. </>}
            {setup.syncError && <span className="hw-err">Last read failed: {setup.syncError}</span>}
          </p>
        )}
        {edit && setup.connected && <SyncNow accountId={setup.accountId} />}
      </section>

      {setup.unreadable && <p className="wa-problem">The saved keys cannot be read on this server (the encryption key changed). Type the app secret and token again.</p>}
      {!setup.canEncrypt && <p className="wa-problem">This server has no encryption key, so keys cannot be saved. Ask whoever runs the API to set it.</p>}

      <KeysCard setup={setup} edit={edit} onSaved={s => { setSetup(s); reload(); }} />
      <AssetsCard setup={setup} edit={edit && tokenOk} onSaved={s => { setSetup(s); reload(); }} />
      <WebhookCard setup={setup} edit={edit && !!setup.pageId} onDone={c => { setChecks(c); reload(); }} />

      <section className="wa-chart-card">
        <h3 className="wa-h3">4 · Meta permissions</h3>
        {checks && checks.permissions.length > 0 ? (
          <table className="wa-mini">
            <thead><tr><th>For</th><th>Permission</th><th>State</th></tr></thead>
            <tbody>
              {checks.permissions.map(p => (
                <tr key={p.for}><td>{p.for}</td><td className="wa-mono">{p.permissions}</td>
                  <td><span className={`wa-st ${p.state === 'granted' ? 'wa-st-ok' : p.state === 'missing' ? 'wa-st-bad' : ''}`}>{p.state === 'granted' ? 'Granted' : p.state === 'missing' ? 'Missing' : 'Not known yet'}</span></td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="hw-muted wa-small">Shown once the token works.</p>}
        <p className="hw-muted wa-small">Instagram messages need Meta's App Review (instagram_manage_messages): a short description and a screen recording of this inbox. Meta gives no fixed turnaround, so send it early.</p>
      </section>

      <section className="wa-chart-card">
        <h3 className="wa-h3">Who can change this</h3>
        <p className="hw-muted wa-small">Only people with “Connect social accounts”. Everyone in Social sees this checklist.{setup.updatedBy ? ` Last changed by ${setup.updatedBy}${setup.updatedAt ? `, ${when(setup.updatedAt)}` : ''}.` : ''}</p>
      </section>

      {can.connect && (
        <section className="wa-chart-card">
          <h3 className="wa-h3">Another set of accounts</h3>
          <p className="hw-muted wa-small">For a second brand (e.g. Doctor Dekho): its own Page, Instagram and ad account. The Account switch at the top then changes every tab.</p>
          <AddAccount onCreated={onCreated} label="Name" />
        </section>
      )}
    </div>
  );
}

function SyncNow({ accountId }: { accountId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="hw-btn" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const r = await socialService.sync(accountId); toast.success(r.message ?? 'Reading from Meta now.'); } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
    }}><RefreshCw size={13} /> Read from Meta now</button>
  );
}

function AddAccount({ onCreated, label }: { onCreated: (id: string) => void; label: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { const a = await socialService.createAccount(name.trim()); setName(''); toast.success(`${a.name} added. Now enter its keys.`); onCreated(a.accountId); } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
  };
  return (
    <div className="wa-row wa-flushrow">
      <input aria-label={label} placeholder={label} value={name} maxLength={100} onChange={e => setName(e.target.value)} />
      <button type="button" className="hw-btn hw-btn-primary" onClick={add} disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add account'}</button>
    </div>
  );
}

function KeysCard({ setup, edit, onSaved }: { setup: SocialSetup; edit: boolean; onSaved: (s: SocialSetup) => void }) {
  const [name, setName] = useState(setup.name);
  const [app, setApp] = useState(setup.appId ?? '');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (clearToken = false) => {
    setBusy(true);
    try {
      const s = await socialService.saveKeys(setup.accountId, { name: name.trim(), appId: app.trim(), appSecret: secret.trim() || undefined, token: token.trim() || undefined, clearToken });
      setSecret(''); setToken('');
      toast.success(clearToken ? 'Token removed.' : 'Saved. Checking with Meta…');
      onSaved(s);
    } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
  };
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">1 · Meta keys</h3>
      <p className="wa-small hw-muted">The same Meta app and system user as WhatsApp marketing can be used. The token needs the Page, the Instagram account and the ad account assigned to the system user. Secrets are stored encrypted and never shown again.</p>
      <fieldset className="wa-plain" disabled={!edit}>
        <label className="wa-field"><span>Name in the CMS</span><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
        <label className="wa-field"><span>Meta app ID</span><input value={app} inputMode="numeric" onChange={e => setApp(e.target.value)} /></label>
        <label className="wa-field">
          <span>App secret {setup.hasAppSecret && <span className="hw-muted">· Saved. Leave empty to keep it.</span>}</span>
          <input type={show ? 'text' : 'password'} value={secret} autoComplete="off" onChange={e => setSecret(e.target.value)} />
        </label>
        <label className="wa-field">
          <span>System user token {setup.hasToken && <span className="hw-muted">· Saved{setup.tokenHint ? ` (ends ${setup.tokenHint})` : ''}. Leave empty to keep it.</span>}</span>
          <div className="wa-row wa-flushrow">
            <input type={show ? 'text' : 'password'} value={token} autoComplete="off" onChange={e => setToken(e.target.value)} />
            <button type="button" className="hw-btn" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide' : 'Show'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
        </label>
        <div className="wa-row">
          <button type="button" className="hw-btn hw-btn-primary" onClick={() => save()} disabled={busy}>{busy ? 'Saving…' : 'Save keys'}</button>
          {setup.hasToken && <button type="button" className="hw-btn" onClick={() => save(true)} disabled={busy}>Remove the token</button>}
        </div>
      </fieldset>
    </section>
  );
}

function AssetsCard({ setup, edit, onSaved }: { setup: SocialSetup; edit: boolean; onSaved: (s: SocialSetup) => void }) {
  const [assets, setAssets] = useState<MetaAssets | null>(null);
  const [page, setPage] = useState(setup.pageId ?? '');
  const [ads, setAds] = useState(setup.adAccountId ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const discover = async () => {
    setBusy('discover');
    try {
      const a = await socialService.discover(setup.accountId);
      setAssets(a);
      if (!page && a.pages.length === 1) setPage(a.pages[0].id);
      if (!ads && a.adAccounts.length === 1) setAds(a.adAccounts[0].id);
    } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };
  useEffect(() => { if (edit) discover(); /* list what the token can see once */ }, [edit]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy('save');
    try {
      const s = await socialService.chooseAssets(setup.accountId, { pageId: page || null, adAccountId: ads || null });
      toast.success(s.pageId && s.pageId !== setup.pageId ? 'Saved. Bringing in every past post now; this takes a few minutes.' : 'Saved.');
      onSaved(s);
    } catch (e) { toast.error(socialError(e)); } finally { setBusy(null); }
  };
  const chosen = assets?.pages.find(p => p.id === page);
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">2 · Choose the accounts</h3>
      {!edit && (
        <dl className="wa-dl">
          <dt>Facebook Page</dt><dd>{setup.pageName ?? '—'}</dd>
          <dt>Instagram account</dt><dd>{setup.igUsername ? `@${setup.igUsername}` : '—'}</dd>
          <dt>Ad account</dt><dd>{setup.adAccountName ?? '—'}</dd>
        </dl>
      )}
      {edit && (
        <>
          <p className="wa-small hw-muted">Listed from what the token can see{assets?.userName ? ` (${assets.userName})` : ''}. <button type="button" className="wa-link" onClick={discover} disabled={!!busy}>{busy === 'discover' ? 'Looking…' : 'Look again'}</button></p>
          <label className="wa-field"><span>Facebook Page</span>
            <select value={page} onChange={e => setPage(e.target.value)}>
              <option value="">—</option>
              {(assets?.pages ?? (setup.pageId ? [{ id: setup.pageId, name: setup.pageName ?? setup.pageId }] : [])).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="wa-field"><span>Instagram account</span>
            <div className="wa-small">{chosen ? (chosen.instagramUsername ? `@${chosen.instagramUsername} (linked to the Page)` : 'No Instagram business account is linked to this Page. Link it in the Page settings, then look again.') : setup.igUsername ? `@${setup.igUsername}` : '—'}</div>
          </div>
          <label className="wa-field"><span>Ad account (optional)</span>
            <select value={ads} onChange={e => setAds(e.target.value)}>
              <option value="">None</option>
              {(assets?.adAccounts ?? (setup.adAccountId ? [{ id: setup.adAccountId, name: setup.adAccountName ?? setup.adAccountId }] : [])).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="wa-row">
            <button type="button" className="hw-btn hw-btn-primary" onClick={save} disabled={!!busy || !page}>{busy === 'save' ? 'Saving…' : 'Save accounts'}</button>
            <span className="hw-muted wa-small">Then every past post is read in (takes a few minutes).</span>
          </div>
        </>
      )}
    </section>
  );
}

function WebhookCard({ setup, edit, onDone }: { setup: SocialSetup; edit: boolean; onDone: (c: SocialChecks) => void }) {
  const [url, setUrl] = useState(setup.webhookUrl || setup.suggestedWebhookUrl);
  const [busy, setBusy] = useState(false);
  const [elsewhere, setElsewhere] = useState<string | null>(null);
  const connect = async (replace = false) => {
    setBusy(true);
    try {
      const c = await socialService.connectWebhooks(setup.accountId, url.trim(), replace);
      setElsewhere(null);
      toast.success('Connected.');
      onDone(c);
    } catch (e) {
      if (isConflict(e) && !replace) setElsewhere(socialError(e));
      else toast.error(socialError(e));
    } finally { setBusy(false); }
  };
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">3 · Send comments, messages and leads to the CMS</h3>
      <p className="wa-small hw-muted">Subscribes the app, the Page and the Instagram account for comments, messages and lead forms. Meta calls only https addresses.</p>
      <label className="wa-field"><span>Webhook address</span>
        <div className="wa-row wa-flushrow">
          <input value={url} onChange={e => setUrl(e.target.value)} disabled={!edit} />
          <button type="button" className="hw-btn" onClick={() => copy(url)} aria-label="Copy the address"><Copy size={14} /></button>
        </div>
      </label>
      {setup.verifyToken && (
        <label className="wa-field"><span>Verify token (for Meta's app dashboard, if asked)</span>
          <div className="wa-row wa-flushrow"><input readOnly value={setup.verifyToken} className="wa-mono" /><button type="button" className="hw-btn" onClick={() => copy(setup.verifyToken!)} aria-label="Copy the verify token"><Copy size={14} /></button></div>
        </label>
      )}
      {setup.webhooksConnectedAt && <p className="hw-muted wa-small">Connected {when(setup.webhooksConnectedAt)}.{setup.lastWebhookAt ? ` Last event from Meta ${ago(setup.lastWebhookAt)} ago.` : ' No event from Meta yet.'}</p>}
      {elsewhere && (
        <div className="wa-banner">
          {elsewhere}
          <div className="wa-row"><button type="button" className="hw-btn hw-btn-primary" onClick={() => connect(true)} disabled={busy}>Move them to the CMS anyway</button><button type="button" className="hw-btn" onClick={() => setElsewhere(null)}>Leave them</button></div>
        </div>
      )}
      {edit && <div className="wa-row"><button type="button" className={`hw-btn${setup.webhooksConnectedAt ? '' : ' hw-btn-primary'}`} onClick={() => connect()} disabled={busy || !url.trim()}>{busy ? 'Connecting…' : setup.webhooksConnectedAt ? 'Connect again' : 'Connect webhooks'}</button></div>}
      {!setup.pageId && <p className="hw-muted wa-small">Choose the Page first.</p>}
    </section>
  );
}
