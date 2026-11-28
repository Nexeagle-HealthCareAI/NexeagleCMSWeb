import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { canExportWork } from '../access';
import { errorMessage } from '../services/workService';
import { docsService } from './docsService';
import { formatSize, kindOf, saveBlob } from './docsMeta';
import type { DocDetail } from './types';
import { MAX_COLUMNS, MAX_ROWS, columnName, readCsv, type Sheet } from './sheetReader';

type View =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'image' | 'pdf'; url: string; blob: Blob }
  | { state: 'text'; text: string; blob: Blob }
  | { state: 'word'; html: string; blob: Blob }
  | { state: 'sheet'; sheets: Sheet[]; blob: Blob }
  | { state: 'oldExcel'; blob: Blob }
  | { state: 'unreadable'; blob: Blob }
  | { state: 'none'; blob: Blob };

const TEXT_PREVIEW_LIMIT = 300_000;

/**
 * Shows a file inside the CMS where the browser can do it safely: images and PDFs as they are, text
 * as text, Word (.docx) files as a readable copy, and spreadsheets (.xlsx, .csv) as a table of their
 * values. Everything else offers a download.
 *
 * The file is fetched with the reader's login and shown from memory, so no address to the file ever
 * exists outside this page. A Word file's copy is put in a frame that may not run scripts.
 */
export default function FilePreview({ doc }: { doc: DocDetail }) {
  const [view, setView] = useState<View>({ state: 'loading' });
  /** Without work.export there is no download, and the PDF viewer's own save and print bar is hidden. */
  const mayExport = canExportWork(useAuthStore(s => s.permissions) || []);
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
        } else if (/\.(xlsx|xlsm)$/i.test(doc.name)) {
          // Values only, read in the browser (sheetReader.ts); the reader is loaded when first needed.
          try {
            const { readXlsx } = await import('./xlsxReader');
            const sheets = await readXlsx(await blob.arrayBuffer());
            if (alive) setView({ state: 'sheet', sheets, blob });
          } catch (e) {
            console.warn('Spreadsheet preview failed', e);
            if (alive) setView({ state: 'unreadable', blob });
          }
        } else if (doc.name.toLowerCase().endsWith('.csv')) {
          const text = await blob.text();
          if (alive) setView({ state: 'sheet', sheets: [readCsv(text)], blob });
        } else if (doc.name.toLowerCase().endsWith('.xls')) {
          setView({ state: 'oldExcel', blob });
        } else if (kind === 'text') {
          const text = await blob.slice(0, TEXT_PREVIEW_LIMIT).text();
          if (alive) setView({ state: 'text', text, blob });
        } else if (doc.name.toLowerCase().endsWith('.docx')) {
          // The file arrived; only the readable copy can fail here (an unusual or damaged .docx).
          try {
            const mammoth = await import('mammoth/mammoth.browser');
            const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
            if (alive) setView({ state: 'word', html: result.value, blob });
          } catch (e) {
            console.warn('Word preview failed', e);
            if (alive) setView({ state: 'unreadable', blob });
          }
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

  const download = !mayExport ? null : <button type="button" className="wk-btn" onClick={() => saveBlob(view.blob, doc.name)}><Download size={16} aria-hidden="true" /> Download ({formatSize(doc.sizeBytes)})</button>;

  if (view.state === 'image') return <div className="dc-preview"><img src={view.url} alt={doc.name} /></div>;
  if (view.state === 'pdf') return <div className="dc-preview is-frame"><iframe src={mayExport ? view.url : `${view.url}#toolbar=0&navpanes=0`} title={doc.name} /></div>;
  if (view.state === 'text') return <div className="dc-preview is-text"><pre>{view.text}</pre></div>;
  if (view.state === 'word') {
    const page = `<!doctype html><meta charset="utf-8"><style>body{font:16px/1.6 system-ui,sans-serif;color:#101828;max-width:760px;margin:24px auto;padding:0 20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #D0D5DD;padding:6px 10px}</style>${view.html}`;
    return (
      <div className="dc-preview is-frame">
        {/* sandbox with no allowances: the copy cannot run scripts, open windows or reach the CMS. */}
        <iframe srcDoc={page} sandbox="" title={`${doc.name} (readable copy)`} />
        <p className="wk-muted dc-preview-note">This is a readable copy{mayExport ? '. Download the file to see its exact layout.' : ' of the Word file.'} {download}</p>
      </div>
    );
  }
  if (view.state === 'sheet') return <SheetPreview sheets={view.sheets} note={download} />;
  if (view.state === 'oldExcel') {
    return (
      <div className="dc-preview is-none">
        <p>This is the older Excel format (.xls), which cannot be shown here. Open it in Excel and save it as .xlsx, then upload that version to see it in the CMS.{!mayExport && ' Downloading is turned off for you on this screen.'}</p>
        {download}
      </div>
    );
  }
  if (view.state === 'unreadable') {
    const what = kind === 'sheet' ? 'spreadsheet' : 'Word file';
    return (
      <div className="dc-preview is-none">
        <p>The file is stored safely, but this {what} cannot be shown here.{mayExport ? ` Download it to open it in ${kind === 'sheet' ? 'Excel' : 'Word'}.` : ' Downloading is turned off for you on this screen.'}</p>
        {download}
      </div>
    );
  }
  return (
    <div className="dc-preview is-none">
      <p>This type of file cannot be shown here.{!mayExport && ' Downloading is turned off for you on this screen.'}</p>
      {download}
    </div>
  );
}

/** A spreadsheet's values as a table, one tab per sheet, with Excel's column letters and row numbers. */
function SheetPreview({ sheets, note }: { sheets: Sheet[]; note: React.ReactNode }) {
  const [at, setAt] = useState(0);
  const sheet = sheets[Math.min(at, sheets.length - 1)];
  return (
    <div className="dc-preview is-sheet">
      {sheets.length > 1 && (
        <div className="dc-sheet-tabs" role="tablist" aria-label="Sheets">
          {sheets.map((s, i) => (
            <button key={`${s.name}-${i}`} type="button" role="tab" aria-selected={i === at} className={i === at ? 'is-on' : ''} onClick={() => setAt(i)}>
              {s.name}{s.hidden && <span className="wk-muted"> (hidden)</span>}
            </button>
          ))}
        </div>
      )}
      {sheet.rows.length === 0 ? (
        <p className="wk-muted dc-preview-note">{sheet.truncated ? 'This sheet is too large to show here.' : 'This sheet is empty.'}</p>
      ) : (
        <div className="dc-sheet-scroll" tabIndex={0} role="region" aria-label={`Sheet ${sheet.name}`}>
          <table className="dc-sheet">
            <thead>
              <tr><th aria-label="Row" />{Array.from({ length: sheet.columns }, (_, c) => <th key={c} scope="col">{columnName(c)}</th>)}</tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">{r + 1}</th>
                  {row.map((v, c) => <td key={c} className={/^[-+]?[\d.,₹$%]+$/.test(v) ? 'is-num' : undefined}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="wk-muted dc-preview-note">
        Values only{sheet.truncated ? `; the first ${MAX_ROWS.toLocaleString('en-IN')} rows and ${MAX_COLUMNS} columns are shown` : ''}. Formulas, colours and charts are in the file itself. {note}
      </p>
    </div>
  );
}
