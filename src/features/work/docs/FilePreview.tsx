import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { errorMessage } from '../services/workService';
import { docsService } from './docsService';
import { formatSize, kindOf, saveBlob } from './docsMeta';
import type { DocDetail } from './types';

type View =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'image' | 'pdf'; url: string; blob: Blob }
  | { state: 'text'; text: string; blob: Blob }
  | { state: 'word'; html: string; blob: Blob }
  | { state: 'none'; blob: Blob };

const TEXT_PREVIEW_LIMIT = 300_000;

/**
 * Shows a file inside the CMS where the browser can do it safely: images and PDFs as they are, text
 * as text, and Word (.docx) files as a readable copy. Everything else offers a download.
 *
 * The file is fetched with the reader's login and shown from memory, so no address to the file ever
 * exists outside this page. A Word file's copy is put in a frame that may not run scripts.
 */
export default function FilePreview({ doc }: { doc: DocDetail }) {
  const [view, setView] = useState<View>({ state: 'loading' });
  const kind = kindOf(doc);

  useEffect(() => {
    let alive = true;
    let url = '';
    setView({ state: 'loading' });
    (async () => {
      try {
        const blob = await docsService.file(doc.documentId);
        if (!alive) return;
        if (kind === 'image' || kind === 'pdf') {
          // Type the bytes ourselves: what the server said the file is must not decide how it is shown.
          const typed = new Blob([blob], { type: kind === 'pdf' ? 'application/pdf' : blob.type.startsWith('image/') ? blob.type : 'image/png' });
          url = URL.createObjectURL(typed);
          setView({ state: kind, url, blob });
        } else if (kind === 'text' || doc.name.toLowerCase().endsWith('.csv')) {
          const text = await blob.slice(0, TEXT_PREVIEW_LIMIT).text();
          if (alive) setView({ state: 'text', text, blob });
        } else if (doc.name.toLowerCase().endsWith('.docx')) {
          const mammoth = await import('mammoth/mammoth.browser');
          const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          if (alive) setView({ state: 'word', html: result.value, blob });
        } else {
          setView({ state: 'none', blob });
        }
      } catch (e) {
        if (alive) setView({ state: 'error', message: errorMessage(e, 'Could not open this file.') });
      }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [doc.documentId, doc.versionNumber, doc.name, kind]);

  if (view.state === 'loading') return <p className="wk-muted dc-preview-note">Opening {doc.name}…</p>;
  if (view.state === 'error') return <p className="wk-error" role="alert">{view.message}</p>;

  const download = <button type="button" className="wk-btn" onClick={() => saveBlob(view.blob, doc.name)}><Download size={16} aria-hidden="true" /> Download ({formatSize(doc.sizeBytes)})</button>;

  if (view.state === 'image') return <div className="dc-preview"><img src={view.url} alt={doc.name} /></div>;
  if (view.state === 'pdf') return <div className="dc-preview is-frame"><iframe src={view.url} title={doc.name} /></div>;
  if (view.state === 'text') return <div className="dc-preview is-text"><pre>{view.text}</pre></div>;
  if (view.state === 'word') {
    const page = `<!doctype html><meta charset="utf-8"><style>body{font:16px/1.6 system-ui,sans-serif;color:#101828;max-width:760px;margin:24px auto;padding:0 20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #D0D5DD;padding:6px 10px}</style>${view.html}`;
    return (
      <div className="dc-preview is-frame">
        {/* sandbox with no allowances: the copy cannot run scripts, open windows or reach the CMS. */}
        <iframe srcDoc={page} sandbox="" title={`${doc.name} (readable copy)`} />
        <p className="wk-muted dc-preview-note">This is a readable copy. Download the file to see its exact layout. {download}</p>
      </div>
    );
  }
  return (
    <div className="dc-preview is-none">
      <p>This type of file cannot be shown here.</p>
      {download}
    </div>
  );
}
