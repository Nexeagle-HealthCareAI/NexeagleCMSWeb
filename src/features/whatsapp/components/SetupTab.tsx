import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Circle, Copy, Eye, EyeOff, RefreshCw, XCircle } from 'lucide-react';
import type { WaCan } from '../access';
import { waService, waError } from '../services/waService';
import type { WaSetup, WaSetupCheck, WaSetupChecks } from '../types';
import { when } from '../waUtils';

// WhatsApp → Setup: connect the marketing number to Meta without touching servers or GitHub.
// Keys are typed in here and stored encrypted; the checks show what is still missing, and the buttons do the
// Meta calls (subscribe the app, point this number's webhook at the CMS, send a test).

const ICON = {
  ok: <CheckCircle2 size={17} className="wa-ck-ok" aria-label="Done" />,
  warn: <AlertTriangle size={17} className="wa-ck-warn" aria-label="Check" />,
  fail: <XCircle size={17} className="wa-ck-fail" aria-label="Problem" />,
  todo: <Circle size={17} className="wa-ck-todo" aria-label="To do" />,
};

const copy = async (text: string) => {
  try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Could not copy'); }
};

export default function SetupTab({ can, onConnected }: { can: WaCan; onConnected?: () => void }) {
  const [setup, setSetup] = useState<WaSetup | null>(null);
  const [checks, setChecks] = useState<WaSetupChecks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    waService.setup().then(s => { if (live) { setSetup(s); setError(null); } }).catch(e => { if (live) setError(waError(e)); });
    waService.setupChecks().then(c => { if (live) setChecks(c); }).catch(e => { if (live) setChecks({ ready: false, items: [{ key: 'x', label: 'Checks', state: 'fail', detail: waError(e) }] }); });
    return () => { live = false; };
  }, [version]);

  const reload = () => { setChecks(null); setVersion(v => v + 1); onConnected?.(); };
  const recheck = async () => {
    setChecking(true);
    try { setChecks(await waService.setupChecks()); } catch (e) { toast.error(waError(e)); } finally { setChecking(false); }
  };

  if (error) return <p className="hw-err wa-pad">{error}</p>;
  if (!setup) return <p className="hw-muted wa-pad">Loading…</p>;
  const edit = can.connect && setup.canEdit;
  const step = (key: string) => checks?.items.find(i => i.key === key)?.state;

  return (
    <div className="wa-pad wa-settings">
      <section className={`wa-chart-card wa-status${checks?.ready ? ' ready' : ''}`}>
        <div className="wa-row wa-between">
          <h3 className="wa-h3">{checks == null ? 'Checking with Meta…' : checks.ready ? 'Connected: sending and receiving work' : 'Not fully connected yet'}</h3>
          <button type="button" className="hw-btn" onClick={recheck} disabled={checking || checks == null}><RefreshCw size={13} /> {checking ? 'Checking…' : 'Check again'}</button>
        </div>
        <ul className="wa-checklist">
          {(checks?.items ?? []).map((c: WaSetupCheck) => (
            <li key={c.key}>{ICON[c.state]}<div><b>{c.label}</b>{c.detail && <div className="hw-muted wa-small">{c.detail}</div>}</div></li>
          ))}
        </ul>
        {!edit && !checks?.ready && <p className="hw-muted wa-small">An administrator with “Connect the WhatsApp number” finishes this.</p>}
      </section>

      <KeysCard setup={setup} edit={edit} onSaved={s => { setSetup(s); reload(); }} />

      <section className="wa-chart-card">
        <h3 className="wa-h3">2 · Let the app receive this account's webhooks</h3>
        <p className="wa-small hw-muted">Usually done already for the Doctor Dekho bot. Needed once per WhatsApp Business Account.</p>
        {edit && (
          <ActionButton label="Subscribe the app" done={step('subscribed') === 'ok'} run={async () => { setChecks(await waService.subscribeApp()); toast.success('Subscribed'); }} />
        )}
      </section>

      <WebhookCard setup={setup} edit={edit} connected={step('webhook') === 'ok'} onDone={c => { setChecks(c); reload(); }} onNewToken={s => setSetup(s)} />

      <TestCard edit={edit} />
    </div>
  );
}

function ActionButton({ label, run, done }: { label: string; run: () => Promise<void>; done?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`hw-btn${done ? '' : ' hw-btn-primary'}`} disabled={busy}
      onClick={async () => { setBusy(true); try { await run(); } catch (e) { toast.error(waError(e)); } finally { setBusy(false); } }}>
      {busy ? 'Working…' : done ? `${label} again` : label}
    </button>
  );
}

function KeysCard({ setup, edit, onSaved }: { setup: WaSetup; edit: boolean; onSaved: (s: WaSetup) => void }) {
  const [phone, setPhone] = useState(setup.phoneNumberId ?? '');
  const [waba, setWaba] = useState(setup.wabaId ?? '');
  const [app, setApp] = useState(setup.appId ?? '');
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const s = await waService.saveSetup({ phoneNumberId: phone.trim(), wabaId: waba.trim(), appId: app.trim(), accessToken: token.trim() || undefined, appSecret: secret.trim() || undefined });
      setToken('');
      setSecret('');
      toast.success('Saved. Checking with Meta…');
      onSaved(s);
    } catch (e) { toast.error(waError(e)); } finally { setBusy(false); }
  };
  const clearToken = async () => {
    if (!window.confirm('Remove the stored access token? Sending stops until a new one is entered.')) return;
    try { onSaved(await waService.saveSetup({ phoneNumberId: phone.trim(), wabaId: waba.trim(), appId: app.trim(), clearAccessToken: true })); } catch (e) { toast.error(waError(e)); }
  };

  const kept = (has: boolean, hint?: string | null) =>
    has ? `Saved${hint ? ` (ends …${hint})` : ''}${setup.tokenSource === 'server' ? ', from the server settings' : ''}. Leave empty to keep it.` : 'Not entered yet.';

  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">1 · Meta keys</h3>
      <p className="wa-small hw-muted">
        From Meta: the number's and account's IDs are in WhatsApp Manager (or the app's WhatsApp → API setup); the app ID and app secret are in
        the app's settings → Basic; the token is a system user's permanent token (Business settings → System users) with
        whatsapp_business_messaging and whatsapp_business_management. Secrets are stored encrypted and never shown again.
      </p>
      {setup.unreadable && <p className="wa-problem">The saved token or secret cannot be read any more (the server's key changed). Enter them again.</p>}
      {!setup.canEncrypt && <p className="wa-problem">The server has no key to encrypt secrets with, so they cannot be saved here.</p>}
      <fieldset className="wa-plain" disabled={!edit}>
        <div className="wa-grid2">
          <label className="wa-field"><span>Phone number ID</span><input type="text" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)} placeholder="digits, not the phone number" /></label>
          <label className="wa-field"><span>WhatsApp Business Account ID</span><input type="text" inputMode="numeric" value={waba} onChange={e => setWaba(e.target.value)} /></label>
          <label className="wa-field"><span>Meta app ID</span><input type="text" inputMode="numeric" value={app} onChange={e => setApp(e.target.value)} /></label>
          <label className="wa-field">
            <span>App secret</span>
            <input type={show ? 'text' : 'password'} autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder={setup.hasAppSecret ? '••••••••' : ''} />
            <small className="hw-muted">{kept(setup.hasAppSecret)}</small>
          </label>
        </div>
        <label className="wa-field">
          <span>Access token</span>
          <div className="wa-row wa-flushrow">
            <input type={show ? 'text' : 'password'} autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={setup.hasAccessToken ? '••••••••' : 'EAA…'} />
            <button type="button" className="hw-btn" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide' : 'Show'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <small className="hw-muted">{kept(setup.hasAccessToken, setup.accessTokenHint)}</small>
        </label>
        {edit && (
          <div className="wa-row">
            <button type="button" className="hw-btn hw-btn-primary" disabled={busy || !setup.canEncrypt} onClick={save}>{busy ? 'Saving…' : 'Save keys'}</button>
            {setup.hasAccessToken && setup.tokenSource === 'cms' && <button type="button" className="hw-btn" onClick={clearToken}>Remove token</button>}
            {setup.updatedBy && <small className="hw-muted">Last changed by {setup.updatedBy}, {when(setup.updatedAt)}</small>}
          </div>
        )}
      </fieldset>
    </section>
  );
}

function WebhookCard({ setup, edit, connected, onDone, onNewToken }: {
  setup: WaSetup; edit: boolean; connected: boolean; onDone: (c: WaSetupChecks) => void; onNewToken: (s: WaSetup) => void;
}) {
  const [url, setUrl] = useState(setup.webhookUrl || setup.suggestedWebhookUrl);
  const https = url.trim().startsWith('https://');
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">3 · Send this number's messages to the CMS</h3>
      <p className="wa-small hw-muted">
        Points only this number's webhook at the CMS (Meta's per-number override). The Doctor Dekho bot's number keeps going to the bot.
        Meta checks the address once, so it must be this API's https address, reachable from the internet.
      </p>
      <label className="wa-field">
        <span>Webhook address</span>
        <div className="wa-row wa-flushrow">
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} disabled={!edit} />
          <button type="button" className="hw-btn" onClick={() => copy(url)} aria-label="Copy the address"><Copy size={14} /></button>
        </div>
        {!https && <small className="wa-ck-fail">Meta only calls https addresses.</small>}
      </label>
      {edit && setup.verifyToken && (
        <label className="wa-field">
          <span>Verify token <small className="hw-muted">(only needed if connecting by hand in Meta)</small></span>
          <div className="wa-row wa-flushrow">
            <input type="text" readOnly value={setup.verifyToken} className="wa-mono" />
            <button type="button" className="hw-btn" onClick={() => copy(setup.verifyToken!)} aria-label="Copy the verify token"><Copy size={14} /></button>
            <button type="button" className="hw-btn" onClick={async () => {
              if (!window.confirm('Make a new verify token? Connect the webhook again afterwards.')) return;
              try { onNewToken(await waService.newVerifyToken()); } catch (e) { toast.error(waError(e)); }
            }}>New</button>
          </div>
        </label>
      )}
      {setup.webhookConnectedAt && <p className="wa-small hw-muted">Connected {when(setup.webhookConnectedAt)}{setup.lastWebhookAt ? ` · last call from Meta ${when(setup.lastWebhookAt)}` : ''}</p>}
      {edit && (
        <div className="wa-row">
          <ActionButton label="Connect webhook" done={connected} run={async () => {
            if (!https) throw new Error('Meta only calls https addresses.');
            onDone(await waService.connectWebhook(url.trim()));
            toast.success("Connected: this number's messages now come to the CMS");
          }} />
        </div>
      )}
    </section>
  );
}

function TestCard({ edit }: { edit: boolean }) {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<string | null>(null);
  if (!edit) return null;
  return (
    <section className="wa-chart-card">
      <h3 className="wa-h3">4 · Test</h3>
      <p className="wa-small hw-muted">Sends Meta's sample message “Hello World” to your phone. Reply to it: the reply should appear in the Inbox within seconds.</p>
      <div className="wa-row">
        <input type="text" value={phone} placeholder="Your WhatsApp number" onChange={e => setPhone(e.target.value)} aria-label="Test phone number" className="wa-test-phone" />
        <ActionButton label="Send test message" run={async () => {
          const r = await waService.testMessage(phone);
          setResult(r.message ?? 'Sent.');
        }} />
      </div>
      {result && <p className="wa-small" role="status">{result}</p>}
    </section>
  );
}
