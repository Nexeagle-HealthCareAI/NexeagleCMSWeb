import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { guardCopy, guardPaste, watermarkImage } from '../guard';
import type { GuardEvent } from '../types';
import { GUARD_EVENT } from './PresenceBar';

const stamp = () => new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Protected mode for the Daily Work Board, on for everyone without the work.export permission.
 * See guard.ts for what is and is not possible. Mounted once by the page; it has no children
 * because drawers and dialogs live outside the page's own element, so it works on the document.
 */
export default function ScreenGuard() {
  const user = useAuthStore(s => s.user);
  const [veiled, setVeiled] = useState(false);
  const [now, setNow] = useState(stamp);
  const lastNotice = useRef(0);

  // Says what was stopped, and reports it for the activity log (PresenceBar sends it).
  const notice = (message: string, kind: GuardEvent) => {
    if (Date.now() - lastNotice.current < 4000) return;
    lastNotice.current = Date.now();
    toast.message(message);
    window.dispatchEvent(new CustomEvent(GUARD_EVENT, { detail: kind }));
  };

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => { if (guardCopy(e)) notice('Copied for use inside the work board only. It cannot be pasted elsewhere.', 'CopyBlocked'); };
    const onPaste = (e: ClipboardEvent) => { guardPaste(e); };
    const onDrag = (e: DragEvent) => { e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'p') notice('Printing the work board is turned off.', 'PrintBlocked');
        else notice('Saving this page is turned off.', 'SaveBlocked');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'PrintScreen') return;
      // The capture has been taken by now; replace it on the clipboard where the browser allows.
      void navigator.clipboard?.writeText('').catch(() => undefined);
      notice('Screenshots of the work board are not allowed. This screen is watermarked with your name.', 'ScreenshotKey');
    };
    const veil = () => setVeiled(true);
    const unveil = () => { if (!document.hidden) { setVeiled(false); setNow(stamp()); } };
    const onVisible = () => (document.hidden ? veil() : unveil());

    // Copy and cut are read after the editors have handled them; paste before.
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('dragstart', onDrag, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', veil);
    window.addEventListener('focus', unveil);
    document.addEventListener('visibilitychange', onVisible);
    document.documentElement.classList.add('wk-guarded');
    const tick = window.setInterval(() => setNow(stamp()), 60_000);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('dragstart', onDrag, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', veil);
      window.removeEventListener('focus', unveil);
      document.removeEventListener('visibilitychange', onVisible);
      document.documentElement.classList.remove('wk-guarded', 'wk-veiled');
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('wk-veiled', veiled);
  }, [veiled]);

  const who = [user?.name, user?.email].filter(Boolean).join(' · ') || 'NexEagle CMS';
  const image = useMemo(() => watermarkImage(`${who} · ${now}`), [who, now]);

  // On the body, not inside the page: the page is blurred while veiled, and these must stay sharp.
  return createPortal(
    <>
      <div className="wk-watermark" aria-hidden="true" style={{ backgroundImage: image }} />
      {veiled && (
        <div className="wk-veil" role="status">
          <EyeOff size={28} aria-hidden="true" />
          <strong>Hidden while you are in another window</strong>
          <span>Click here to carry on.</span>
        </div>
      )}
    </>,
    document.body,
  );
}

/** The small "Protected" mark in the page header. */
export function ProtectedBadge() {
  return (
    <span className="wk-protected" title="Copying out, printing and downloading are turned off for you on this screen, and it carries your name as a watermark.">
      <ShieldCheck size={15} aria-hidden="true" /> Protected
    </span>
  );
}
