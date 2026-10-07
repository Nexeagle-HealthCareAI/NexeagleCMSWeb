import { useState } from 'react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import type { Contributor } from '../types';

interface Props {
  contributor: Contributor;
  /** Slug of the saved article. Without one the link is only for joining. */
  articleSlug?: string;
  onSent: (c: Contributor) => void;
}

/** Shown under a reviewer or author who is an independent doctor, so the team can send them the link. */
export default function SendLinkRow({ contributor: c, articleSlug, onSent }: Props) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      onSent(await healthWikiService.sendLink(c.contributorId, articleSlug));
      toast.success(`WhatsApp link sent to ${c.fullName}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send the link. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="hw-linkrow">
      <b>{c.fullName}</b> is an independent doctor.
      <div className="hw-muted">{c.linkSentAt ? `Link sent ${c.linkSentAt}.` : 'No link sent yet.'}</div>
      <button type="button" className="hw-btn hw-sm" disabled={busy || !articleSlug} onClick={send}>
        {c.linkSentAt ? 'Resend on WhatsApp' : 'Send on WhatsApp'}
      </button>
      {!articleSlug && <div className="hw-hint">Save the draft first so the link opens this article.</div>}
    </div>
  );
}
