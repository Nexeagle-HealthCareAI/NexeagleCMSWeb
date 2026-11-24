import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { FilePlus2, Lock, UploadCloud, X } from 'lucide-react';
import { Dialog } from '../components/parts';
import { errorMessage } from '../services/workService';
import { docsService } from './docsService';
import { ACCEPT, buildFolderTree, formatSize, uploadProblem } from './docsMeta';
import type { Doc, DocFolder } from './types';

export type AddMode = 'upload' | 'page';

interface Props {
  workItemId: string;
  /** For the new page's name. */
  itemKey: string;
  itemTitle: string;
  mode: AddMode;
  /** Files dropped on the item before the dialog opened. */
  files?: File[];
  onClose: () => void;
  /** Each document as soon as it is saved and linked to the item. */
  onAdded: (doc: Doc) => void;
  /** A new page was made and should open to be written. */
  onOpenPage: (documentId: string) => void;
}

/** The folder new documents went into last time, so the next one goes there too. */
const FOLDER_KEY = 'wk.addDocFolder';
const readFolder = () => { try { return localStorage.getItem(FOLDER_KEY) || ''; } catch { return ''; } };
const keepFolder = (id: string) => { try { localStorage.setItem(FOLDER_KEY, id); } catch { /* private window */ } };

/**
 * Add a document to a work item without leaving it: upload files or start a new page, put it in a
 * Docs folder, and link it to the item. Everyone who can open the item sees it under Linked documents,
 * and it stays in the Docs tab with every other document.
 */
export default function DocAdder({ workItemId, itemKey, itemTitle, mode: startMode, files: dropped, onClose, onAdded, onOpenPage }: Props) {
  const [mode, setMode] = useState<AddMode>(startMode);
  const [folders, setFolders] = useState<DocFolder[] | null>(null);
  const [folderId, setFolderId] = useState(readFolder);
  const [files, setFiles] = useState<File[]>(dropped ?? []);
  const [name, setName] = useState(`${itemKey} ${itemTitle}`.slice(0, 200));
  const [openAfter, setOpenAfter] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    docsService.folders()
      .then(list => {
        if (!alive) return;
        setFolders(list);
        // A remembered folder that was deleted or locked since: back to the top level.
        setFolderId(id => (id && list.some(f => f.folderId === id) ? id : ''));
      })
      .catch(() => { if (alive) setFolders([]); });
    return () => { alive = false; };
  }, []);

  const tree = useMemo(() => buildFolderTree(folders ?? [], new Set()), [folders]);
  const problems = files.map(uploadProblem).filter((p): p is string => !!p);
  const good = files.filter(f => !uploadProblem(f));
  const where = folderId || null;

  const addFiles = (more: File[]) => {
    setErrors([]);
    setFiles(prev => [...prev, ...more.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const upload = async () => {
    keepFolder(folderId);
    const failed: string[] = [];
    let left = [...good];
    for (const [i, file] of good.entries()) {
      setBusy(`Uploading ${i + 1} of ${good.length}: ${file.name}`);
      try {
        const doc = await docsService.upload(file, where);
        await docsService.link(workItemId, doc.documentId);
        onAdded(doc);
        left = left.filter(f => f !== file);
      } catch (e) {
        failed.push(errorMessage(e, `Could not upload ${file.name}.`));
      }
    }
    setBusy(null);
    if (failed.length === 0) { onClose(); return; }
    // Keep only what did not go up, so "Try again" does not upload anything twice.
    setFiles(left);
    setErrors(failed);
  };

  const createPage = async () => {
    keepFolder(folderId);
    setBusy('Making the page…');
    try {
      const page = await docsService.createPage(name.trim() || `${itemKey} notes`, where);
      await docsService.link(workItemId, page.documentId);
      onAdded(page);
      if (openAfter) onOpenPage(page.documentId); else onClose();
    } catch (e) {
      setErrors([errorMessage(e, 'Could not make the page.')]);
      setBusy(null);
    }
  };

  return (
    <Dialog title="Add a document" onClose={() => { if (!busy) onClose(); }} wide>
      <div className="wk-seg" role="tablist" aria-label="What to add">
        <button type="button" role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'is-on' : ''} onClick={() => setMode('upload')} disabled={!!busy}>
          <UploadCloud size={16} aria-hidden="true" /> Upload files
        </button>
        <button type="button" role="tab" aria-selected={mode === 'page'} className={mode === 'page' ? 'is-on' : ''} onClick={() => setMode('page')} disabled={!!busy}>
          <FilePlus2 size={16} aria-hidden="true" /> New page
        </button>
      </div>

      {mode === 'upload' ? (
        <>
          <div
            className={`dc-adddrop ${dropping ? 'is-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDropping(true); }}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
          >
            <UploadCloud size={26} aria-hidden="true" />
            <p>Drop files here, or</p>
            <button type="button" className="wk-btn" onClick={() => input.current?.click()} disabled={!!busy}>Choose files</button>
            <small>PDF, Word, Excel, PowerPoint, text, CSV, images or zip, up to 25 MB each.</small>
            <input ref={input} type="file" hidden multiple accept={ACCEPT} aria-label="Choose files to upload"
              onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
          </div>
          {files.length > 0 && (
            <ul className="dc-addfiles" aria-label="Files to upload">
              {files.map(f => {
                const problem = uploadProblem(f);
                return (
                  <li key={`${f.name}-${f.size}`} className={problem ? 'is-bad' : ''}>
                    <span className="dc-addfile-name">{f.name}</span>
                    <span className="wk-muted">{problem ? problem.replace(`${f.name}`, '').replace(/^[:\s]+/, '') : formatSize(f.size)}</span>
                    <button type="button" className="wk-iconbtn" aria-label={`Leave out ${f.name}`} onClick={() => setFiles(prev => prev.filter(p => p !== f))} disabled={!!busy}><X size={14} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <label className="wk-field">
            <span>Page name</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={200} data-autofocus />
          </label>
          <label className="wk-check">
            <input type="checkbox" checked={openAfter} onChange={e => setOpenAfter(e.target.checked)} />
            <span>Open it to write now</span>
          </label>
        </>
      )}

      <label className="wk-field">
        <span>Save in</span>
        <select value={folderId} onChange={e => setFolderId(e.target.value)} disabled={!folders || !!busy}>
          <option value="">All documents (top level)</option>
          {tree.map(({ folder, depth }) => (
            <option key={folder.folderId} value={folder.folderId}>
              {`${'   '.repeat(depth)}${folder.name}${folder.isRestricted ? ' (restricted)' : ''}`}
            </option>
          ))}
        </select>
        {tree.find(n => n.folder.folderId === folderId)?.folder.isRestricted && (
          <small className="wk-muted"><Lock size={12} aria-hidden="true" /> Only the people on this folder's list can open it, even from the item.</small>
        )}
      </label>

      {busy && <p className="wk-muted" role="status">{busy}</p>}
      {errors.length > 0 && <div className="wk-error" role="alert">{errors.map(e => <p key={e}>{e}</p>)}</div>}
      {mode === 'upload' && problems.length > 0 && !busy && <p className="wk-muted">Files marked in red will be left out.</p>}

      <div className="wk-form-actions">
        <button type="button" className="wk-btn" onClick={onClose} disabled={!!busy}>Cancel</button>
        {mode === 'upload' ? (
          <button type="button" className="wk-btn is-primary" onClick={() => void upload()} disabled={!!busy || good.length === 0}>
            {errors.length > 0 ? 'Try again' : good.length > 1 ? `Upload and link ${good.length} files` : 'Upload and link'}
          </button>
        ) : (
          <button type="button" className="wk-btn is-primary" onClick={() => void createPage()} disabled={!!busy}>Make the page and link it</button>
        )}
      </div>
    </Dialog>
  );
}
