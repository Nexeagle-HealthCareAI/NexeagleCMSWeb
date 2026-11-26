import { ExternalLink, FileText, Image as ImageIcon, Phone, Reply, Copy, Video } from 'lucide-react';
import type { HeaderFormat, WaButton } from '../types';
import { buttonLabel } from '../waUtils';

// How a template looks on the phone: a WhatsApp-style bubble.
export default function TemplatePreview(p: {
  headerFormat: HeaderFormat;
  headerText?: string | null;
  sampleUrl?: string | null;
  body: string;
  footer?: string | null;
  buttons: WaButton[];
}) {
  const icon = (b: WaButton) =>
    b.type === 'URL' ? <ExternalLink size={13} /> : b.type === 'PHONE_NUMBER' ? <Phone size={13} /> : b.type === 'COPY_CODE' ? <Copy size={13} /> : <Reply size={13} />;
  return (
    <div className="wa-phone" aria-label="Preview">
      <div className="wa-bubble wa-out">
        {p.headerFormat === 'TEXT' && p.headerText && <div className="wa-b-head">{p.headerText}</div>}
        {(p.headerFormat === 'IMAGE' || p.headerFormat === 'VIDEO' || p.headerFormat === 'DOCUMENT') && (
          p.sampleUrl && p.headerFormat === 'IMAGE'
            ? <img className="wa-b-media" src={p.sampleUrl} alt="Header" />
            : <div className="wa-b-media wa-b-ph">{p.headerFormat === 'IMAGE' ? <ImageIcon size={22} /> : p.headerFormat === 'VIDEO' ? <Video size={22} /> : <FileText size={22} />}</div>
        )}
        <div className="wa-b-text">{p.body || <span className="hw-muted">Your message…</span>}</div>
        {p.footer && <div className="wa-b-foot">{p.footer}</div>}
      </div>
      {p.buttons.length > 0 && (
        <div className="wa-b-btns">
          {p.buttons.map((b, i) => <div key={i} className="wa-b-btn">{icon(b)} {buttonLabel(b)}</div>)}
        </div>
      )}
    </div>
  );
}
