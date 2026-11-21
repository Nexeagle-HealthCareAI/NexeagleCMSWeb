import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, History, Link2, Lock, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, TypeIcon } from '../components/parts';
import { errorMessage } from '../services/workService';
import { formatWhen } from '../workMeta';
import { docsService } from './docsService';
import { ACCEPT, formatSize, kindOf, KIND_LABEL, saveBlob, trailOf, uploadProblem } from './docsMeta';
import { DocIcon } from './DocIcon';
import FilePreview from './FilePreview';
import PageEditor from './PageEditor';
import type { DocDetail, DocFolder, DocLogEntry } from './types';

interface Props {
  documentId: string;
  folders: DocFolder[];
  canEdit: boolean;
  canDelete: boolean;
  canSensitive: boolean;
  onBack: () => void;
  /** Something the list shows has changed (name, folder, version, bin). */
  onChanged: () => void;
  onOpenItem: (workItemId: string) => void;
}

const SAVE_PAUSE_MS = 1200;
const LOG_WORDS: Record<string, string> = {
  open: 'opened it', download: 'downloaded it', create: 'created it', upload: 'uploaded', edit: 'edited it', rename: 'renamed it',
  move: 'moved it', bin: 'moved it to the bin', restore: 'restored it', access: 'changed access',
};

/** One document, open: a page in the editor, or a file in the preview, with its details beside it. */
export default function DocView({ documentId, folders, canEdit, canDelete, canSensitive, onBack, onChanged, onOpenItem }: Props) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'waiting' | 'saving' | 'failed'>('saved');
  const [log, setLog] = useState<DocLogEntry[] | null>(null);
  const [confirmBin, setConfirmBin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The newest unsaved page text, and the timer waiting to send it.
  const pending = useRef<{ content: string; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((d: DocDetail) => {
    setDoc(d);
    setName(d.name);
    setTags(d.tags.join(', '));
  }, []);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setError('');
    setLog(null);
    docsService.get(documentId)
      .then(d => { if (alive) show(d); })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not open this document.')); });
    return () => { alive = false; };
  }, [documentId, show]);

  /** Send the page text that is waiting. Safe to call when nothing is. */
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState('saving');
    try {
      const saved = await docsService.savePage(documentId, next.content, next.text);
      setDoc(prev => (prev ? { ...prev, versions: saved.versions, versionNumber: saved.versionNumber, updatedAt: saved.updatedAt, updatedByName: saved.updatedByName, sizeBytes: saved.sizeBytes } : prev));
      // Typing may have continued while this was on its way.
      setSaveState(pending.current ? 'waiting' : 'saved');
    } catch (e) {
      pending.current = pending.current || next; // keep the text so "Try again" can send it
      setSaveState('failed');
      toast.error(errorMessage(e, 'Could not save the page.'));
    }
  }, [documentId]);

  const onType = useCallback((content: string, text: string) => {
    pending.current = { content, text };
    setSaveState('waiting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_PAUSE_MS);
  }, [flush]);

  // Leaving the page (back, another document, closing the tab) sends what is still waiting.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (pending.current) { void flush(); e.preventDefault(); } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); void flush(); };
  }, [flush]);

  if (error) {
    return (
      <div className="dc-view">
        <button type="button" className="wk-btn is-quiet" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to documents</button>
        <p className="wk-error" role="alert">{error}</p>
      </div>
    );
  }
  if (!doc) return <div className="dc-view" aria-busy="true"><p className="wk-muted">Opening…</p></div>;

  const kind = kindOf(doc);
  const trail = trailOf(folders, doc.folderId);
  const locked = trail.some(f => f.isRestricted);

  const saveDetails = async (patch: { name?: string; folderId?: string | null; tags?: string[] }) => {
    try {
      const saved = await docsService.update(doc.documentId, { name: patch.name ?? doc.name, folderId: patch.folderId === undefined ? doc.folderId : patch.folderId, tags: patch.tags ?? doc.tags });
      show({ ...saved, content: doc.content });
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save. Try again.'));
      show(doc);
    }
  };
  const commitName = () => {
    const next = name.trim();
    if (!next) { setName(doc.name); return; }
    if (next !== doc.name) void saveDetails({ name: next });
  };
  const commitTags = () => {
    const next = Array.from(new Set(tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)));
    if (next.join(',') !== doc.tags.join(',')) void saveDetails({ tags: next });
    else setTags(doc.tags.join(', '));
  };
  const download = async (versionId?: string, versionName?: string) => {
    try {
      saveBlob(await docsService.file(doc.documentId, versionId), versionName || doc.name);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not download the file.'));
    }
  };
  const uploadVersion = async (file: File | undefined) => {
    if (!file) return;
    if (file.name !== doc.name) { toast.error(`To add a version, choose a file named ${doc.name}. A different name makes a separate document.`); return; }
    const problem = uploadProblem(file);
    if (problem) { toast.error(problem); return; }
    setUploading(true);
    try {
      const saved = await docsService.upload(file, doc.folderId);
      show(saved);
      onChanged();
      toast.success(`Version ${saved.versionNumber} uploaded`);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not upload the file.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const bin = async () => {
    try {
      await flush();
      await docsService.remove(doc.documentId);
      toast.success(`“${doc.name}” moved to the bin`);
      onChanged();
      onBack();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not move it to the bin.'));
      setConfirmBin(false);
    }
  };
  const loadLog = async () => {
    try { setLog(await docsService.log(doc.documentId)); } catch (e) { toast.error(errorMessage(e, 'Could not load the access log.')); }
  };

  return (
    <div className="dc-view">
      <div className="dc-view-head">
        <button type="button" className="wk-btn is-quiet" onClick={() => { void flush().then(onBack); }}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
        <div className="dc-view-tools">
          {doc.kind === 'Page' && canEdit && (
            <span className={`dc-save is-${saveState}`} role="status">
              {saveState === 'saved' && 'All changes saved'}
              {saveState === 'waiting' && 'Unsaved changes…'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'failed' && <>Not saved. <button type="button" className="wk-link" onClick={() => void flush()}>Try again</button></>}
            </span>
          )}
          {doc.kind === 'File' && <button type="button" className="wk-btn" onClick={() => void download()}><Download size={16} aria-hidden="true" /> Download</button>}
          {doc.kind === 'File' && canEdit && (
            <>
              <button type="button" className="wk-btn" disabled={uploading} onClick={() => fileInput.current?.click()}><UploadCloud size={16} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Upload new version'}</button>
              <input ref={fileInput} type="file" hidden accept={ACCEPT} onChange={e => void uploadVersion(e.target.files?.[0])} />
            </>
          )}
          {canDelete && <button type="button" className="wk-iconbtn" aria-label="Move to the bin" title="Move to the bin" onClick={() => setConfirmBin(true)}><Trash2 size={17} /></button>}
        </div>
      </div>

      <div className="dc-view-body">
        <div className="dc-view-main">
          <div className="dc-title-row">
            <DocIcon doc={doc} />
            <input className="wk-title-input" aria-label="Name" value={name} maxLength={255} readOnly={!canEdit}
              onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          </div>
          {doc.kind === 'Page'
            ? <PageEditor key={doc.documentId} initialContent={doc.content} editable={canEdit} onChange={onType} />
            : <FilePreview doc={doc} />}
        </div>

        <aside className="dc-side" aria-label="Details">
          <section>
            <h3>Details</h3>
            <dl className="dc-facts">
              <dt>Type</dt><dd>{KIND_LABEL[kind]}{doc.kind === 'File' ? ` · ${formatSize(doc.sizeBytes)}` : ''}</dd>
              <dt>Folder</dt>
              <dd>
                {canEdit ? (
                  <select aria-label="Folder" value={doc.folderId || ''} onChange={e => void saveDetails({ folderId: e.target.value || null })}>
                    <option value="">Top level</option>
                    {folders.map(f => <option key={f.folderId} value={f.folderId}>{trailOf(folders, f.folderId).map(x => x.name).join(' › ')}</option>)}
                  </select>
                ) : (trail.length > 0 ? trail.map(f => f.name).join(' › ') : 'Top level')}
              </dd>
              <dt>Version</dt><dd>{doc.versionNumber}</dd>
              <dt>Updated</dt><dd>{formatWhen(doc.updatedAt)}{doc.updatedByName ? ` by ${doc.updatedByName}` : ''}</dd>
              <dt>Created</dt><dd>{formatWhen(doc.createdAt)}{doc.createdByName ? ` by ${doc.createdByName}` : ''}</dd>
            </dl>
            {locked && <p className="dc-locked"><Lock size={14} aria-hidden="true" /> In a sensitive folder. Only the people let in can see this.</p>}
            <label className="wk-field">
              <span>Tags</span>
              <input value={tags} readOnly={!canEdit} onChange={e => setTags(e.target.value)} onBlur={commitTags} placeholder="Separate with commas" />
            </label>
          </section>

          <section>
            <h3><Link2 size={15} aria-hidden="true" /> Linked work items<span className="wk-count">{doc.linkedItems.length}</span></h3>
            {doc.linkedItems.length === 0 ? <p className="wk-muted">None yet. Open a work item and choose “Link a document”.</p> : (
              <ul className="dc-links">
                {doc.linkedItems.map(i => (
                  <li key={i.workItemId}>
                    <button type="button" onClick={() => onOpenItem(i.workItemId)}><TypeIcon type={i.itemType} /><span className="wk-key">{i.key}</span><span className="dc-link-title">{i.title}</span></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3><History size={15} aria-hidden="true" /> Earlier versions<span className="wk-count">{doc.versions.length}</span></h3>
            {doc.versions.length === 0 ? <p className="wk-muted">{doc.kind === 'File' ? 'Upload a file with the same name to add a version.' : 'Earlier text is kept as you and others edit.'}</p> : (
              <ul className="dc-versions">
                {doc.versions.map(v => (
                  <li key={v.versionId}>
                    <span><strong>Version {v.versionNumber}</strong> · {formatWhen(v.createdAt)}{v.createdByName ? ` · ${v.createdByName}` : ''}</span>
                    {doc.kind === 'File' && <button type="button" className="wk-link" onClick={() => void download(v.versionId, v.name)}>Download</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canSensitive && (
            <section>
              <h3>Access log</h3>
              {log === null ? <button type="button" className="wk-link" onClick={() => void loadLog()}>Show who opened or changed this</button> : log.length === 0 ? <p className="wk-muted">Nothing recorded yet.</p> : (
                <ul className="dc-log">
                  {log.map((l, i) => <li key={i}><strong>{l.userName}</strong> {LOG_WORDS[l.action] || l.action}{l.detail ? `: ${l.detail}` : ''} <span>{formatWhen(l.createdAt)}</span></li>)}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>

      {confirmBin && (
        <Dialog title={`Move “${doc.name}” to the bin?`} onClose={() => setConfirmBin(false)}>
          <p className="wk-dialog-text">It disappears for everyone. Someone who can delete documents can bring it back from the bin.</p>
          <div className="wk-form-actions">
            <button type="button" className="wk-btn" onClick={() => setConfirmBin(false)}>Keep it</button>
            <button type="button" className="wk-btn is-danger" onClick={() => void bin()}>Move to the bin</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
