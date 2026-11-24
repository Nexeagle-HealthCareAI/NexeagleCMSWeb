import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Mail, MessageCircle, Share2 } from 'lucide-react';
import { itemLink, shareText } from '../shareLink';

interface Props {
  itemId: string;
  itemKey: string;
  title: string;
  /** With work.export the title goes in the message; without it only the key and the link leave the CMS. */
  canExport: boolean;
}

/** Share: copy the link, or send it on WhatsApp, by email or with the phone's share sheet. */
export default function ShareItem({ itemId, itemKey, title, canExport }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const link = itemLink(itemId);
  const text = shareText(itemKey, title, canExport, link);
  const subject = canExport ? `${itemKey}: ${title}` : `${itemKey} on the Daily Work Board`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const done = () => setOpen(false);

  const copy = async () => {
    done();
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Link to ${itemKey} copied`);
    } catch {
      toast.error('This browser would not copy the link. Copy it from the address bar instead.');
    }
  };
  const openOut = (url: string) => { done(); window.open(url, '_blank', 'noopener,noreferrer'); };
  const nativeShare = async () => {
    done();
    try { await navigator.share({ title: subject, text: canExport ? `${itemKey}: ${title}` : `${itemKey} on the Daily Work Board`, url: link }); }
    catch { /* closed without sharing */ }
  };

  return (
    <div className="wk-menu" ref={box}>
      <button type="button" className="wk-iconbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} aria-label="Share" title="Share">
        <Share2 size={17} />
      </button>
      {open && (
        <div className="wk-menu-list wk-share" role="menu" aria-label={`Share ${itemKey}`}>
          <button type="button" role="menuitem" onClick={() => void copy()}><Link2 size={16} aria-hidden="true" /> Copy link</button>
          <button type="button" role="menuitem" onClick={() => openOut(`https://wa.me/?text=${encodeURIComponent(text)}`)}><MessageCircle size={16} aria-hidden="true" /> WhatsApp</button>
          <button type="button" role="menuitem" onClick={() => openOut(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`)}><Mail size={16} aria-hidden="true" /> Email</button>
          {canNativeShare && <button type="button" role="menuitem" onClick={() => void nativeShare()}><Share2 size={16} aria-hidden="true" /> More apps…</button>}
          <p className="wk-share-note">Only people who can open this board see the item. Others are asked to sign in.</p>
        </div>
      )}
    </div>
  );
}
