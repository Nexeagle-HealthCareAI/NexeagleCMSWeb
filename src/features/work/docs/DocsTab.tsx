import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, FilePlus2, Folder, FolderPlus, Home, Lock, RotateCcw, Search, Settings2, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { canDeleteDocs, canEditDocs, canSeeSensitiveDocs } from '../access';
import { Dialog } from '../components/parts';
import { errorMessage, workService } from '../services/workService';
import type { WorkUser } from '../types';
import { formatWhen } from '../workMeta';
import { docsService } from './docsService';
import { ACCEPT, buildFolderTree, formatSize, isInside, trailOf, uploadProblem } from './docsMeta';
import { DocIcon } from './DocIcon';
import DocView from './DocView';
import FolderDialog from './FolderDialog';
import type { Doc, DocBin, DocFolder } from './types';

const ROOT = 'root';
type Dragged = { kind: 'doc'; doc: Doc } | { kind: 'folder'; folder: DocFolder };

/**
 * Tab 2 of the Daily Work Board: the team's documents. Folders on the left, the open folder's
 * contents on the right. Files are added with the Upload button or by dropping them on the page;
 * documents and folders are moved by dragging them onto a folder.
 */
export default function DocsTab() {
  const permissions = useAuthStore(s => s.permissions) || [];
  const canEdit = canEditDocs(permissions);
  const canDelete = canDeleteDocs(permissions);
  const canSensitive = canSeeSensitiveDocs(permissions);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const docId = params.get('doc');
  const inBin = params.get('view') === 'bin';

  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [users, setUsers] = useState<WorkUser[]>([]);
  const [bin, setBin] = useState<DocBin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [folderForm, setFolderForm] = useState<{ folder: DocFolder | null } | null>(null);
  const [binning, setBinning] = useState<DocFolder | null>(null);
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reload = useCallback(() => setVersion(v => v + 1), []);

  const go = useCallback((next: { folder?: string | null; doc?: string | null; view?: 'bin' | null }) => {
    setParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', 'docs');
      const set = (key: string, value: string | null | undefined) => { if (value === undefined) return; if (value) p.set(key, value); else p.delete(key); };
      set('folder', next.folder);
      set('doc', next.doc);
      set('view', next.view);
      return p;
    });
  }, [setParams]);

  // A short pause before searching, so a request is not sent for every letter.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(prev => {
      const next = query.trim();
      // Show "Loading" while the new results are on their way, never the old list under a new heading.
      if (next !== prev) setLoading(true);
      return next;
    }), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    workService.users().then(u => { if (alive) setUsers(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  // Folders, and the documents of the open folder (or the search, or the bin).
  useEffect(() => {
    let alive = true;
    const work = inBin
      ? Promise.all([docsService.folders(), docsService.bin()]).then(([f, b]) => { if (alive) { setFolders(f); setBin(b); } })
      : Promise.all([docsService.folders(), docsService.list(folderId, search || undefined)]).then(([f, d]) => { if (alive) { setFolders(f); setDocs(d); } });
    work
      .then(() => { if (alive) setError(''); })
      .catch(e => { if (alive) setError(errorMessage(e, 'Could not load the documents.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [folderId, search, inBin, version]);

  const tree = useMemo(() => buildFolderTree(folders, closed), [folders, closed]);
  const trail = useMemo(() => trailOf(folders, folderId), [folders, folderId]);
  const current = folders.find(f => f.folderId === folderId) || null;
  const children = useMemo(
    () => (search ? [] : folders.filter(f => (f.parentId || null) === (folderId || null)).sort((a, b) => a.name.localeCompare(b.name))),
    [folders, folderId, search],
  );

  const openFolder = (id: string | null) => { setQuery(''); setSearch(''); setLoading(true); go({ folder: id, doc: null, view: null }); };
  const toggle = (id: string) => setClosed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const newPage = async () => {
    try {
      const page = await docsService.createPage('Untitled page', folderId);
      reload();
      go({ doc: page.documentId });
    } catch (e) {
      toast.error(errorMessage(e, 'Could not create the page.'));
    }
  };

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    const good: File[] = [];
    for (const file of files) {
      const problem = uploadProblem(file);
      if (problem) toast.error(problem); else good.push(file);
    }
    if (good.length === 0) return;
    setUploading(good.length);
    let done = 0;
    for (const file of good) {
      try {
        await docsService.upload(file, folderId);
        done++;
      } catch (e) {
        toast.error(errorMessage(e, `Could not upload ${file.name}.`));
      }
      setUploading(n => n - 1);
    }
    if (done > 0) toast.success(done === 1 ? `${good[0].name} uploaded` : `${done} files uploaded`);
    reload();
  };

  // Files dragged in from the computer.
  const hasFiles = (e: ReactDragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const onDragOver = (e: ReactDragEvent) => { if (canEdit && !inBin && hasFiles(e)) { e.preventDefault(); setDropping(true); } };
  const onDrop = (e: ReactDragEvent) => {
    if (!canEdit || inBin || !hasFiles(e)) return;
    e.preventDefault();
    setDropping(false);
    void upload(Array.from(e.dataTransfer.files));
  };

  // A document or folder dragged onto a folder.
  const onDragStart = (e: DragStartEvent) => setDragged((e.active.data.current as Dragged) || null);
  const onDragEnd = async (e: DragEndEvent) => {
    const item = e.active.data.current as Dragged | undefined;
    setDragged(null);
    if (!item || !e.over) return;
    const target = String(e.over.id).replace(/^(tree|row):/, '');
    const to = target === ROOT ? null : target;
    try {
      if (item.kind === 'doc') {
        if ((item.doc.folderId || null) === to) return;
        await docsService.update(item.doc.documentId, { name: item.doc.name, folderId: to, tags: item.doc.tags });
        toast.success(`“${item.doc.name}” moved`);
      } else {
        const f = item.folder;
        if ((f.parentId || null) === to || f.folderId === to) return;
        if (to && isInside(folders, to, f.folderId)) { toast.error('A folder cannot be moved into itself.'); return; }
        await docsService.updateFolder(f.folderId, { name: f.name, parentId: to, color: f.color, isRestricted: f.isRestricted });
        toast.success(`Folder “${f.name}” moved`);
      }
      reload();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not move it.'));
    }
  };

  const binFolder = async (folder: DocFolder) => {
    try {
      await docsService.deleteFolder(folder.folderId);
      toast.success(`Folder “${folder.name}” moved to the bin`);
      setBinning(null);
      if (isInside(folders, folderId, folder.folderId)) go({ folder: folder.parentId, doc: null });
      reload();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not move the folder to the bin.'));
    }
  };
  const restore = async (what: { doc?: Doc; folder?: DocFolder }) => {
    try {
      if (what.doc) await docsService.restore(what.doc.documentId);
      if (what.folder) await docsService.restoreFolder(what.folder.folderId);
      toast.success('Restored');
      reload();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not restore it.'));
    }
  };

  if (docId) {
    return (
      <DocView
        documentId={docId} folders={folders} canEdit={canEdit} canDelete={canDelete} canSensitive={canSensitive}
        onBack={() => go({ doc: null })} onChanged={reload}
        onOpenItem={workItemId => navigate(`/work?item=${encodeURIComponent(workItemId)}`)}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={e => void onDragEnd(e)} onDragCancel={() => setDragged(null)}>
      <div className="dc-layout">
        <nav className="dc-tree" aria-label="Folders">
          <TreeDrop id={ROOT} active={!!dragged}>
            <button type="button" className={`dc-tree-item ${!folderId && !inBin ? 'is-on' : ''}`} onClick={() => openFolder(null)}>
              <span className="dc-tree-caret" aria-hidden="true" /><Home size={16} aria-hidden="true" /><span className="dc-tree-name">All documents</span>
            </button>
          </TreeDrop>
          {tree.map(({ folder, depth, hasChildren }) => (
            <TreeDrop key={folder.folderId} id={folder.folderId} active={!!dragged && !(dragged.kind === 'folder' && isInside(folders, folder.folderId, dragged.folder.folderId))}>
              <div className={`dc-tree-item ${folderId === folder.folderId && !inBin ? 'is-on' : ''}`} style={{ paddingLeft: 6 + depth * 16 }}>
                {hasChildren ? (
                  <button type="button" className="dc-tree-caret" onClick={() => toggle(folder.folderId)} aria-expanded={!closed.has(folder.folderId)} aria-label={`${closed.has(folder.folderId) ? 'Show' : 'Hide'} folders in ${folder.name}`}>
                    {closed.has(folder.folderId) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : <span className="dc-tree-caret" aria-hidden="true" />}
                <button type="button" className="dc-tree-open" onClick={() => openFolder(folder.folderId)}>
                  <FolderMark folder={folder} /><span className="dc-tree-name">{folder.name}</span>
                </button>
              </div>
            </TreeDrop>
          ))}
          {canDelete && (
            <button type="button" className={`dc-tree-item dc-tree-bin ${inBin ? 'is-on' : ''}`} onClick={() => { setLoading(true); go({ view: 'bin', folder: null, doc: null }); }}>
              <span className="dc-tree-caret" aria-hidden="true" /><Trash2 size={16} aria-hidden="true" /><span className="dc-tree-name">Bin</span>
            </button>
          )}
        </nav>

        <div className={`dc-main ${dropping ? 'is-dropping' : ''}`} onDragOver={onDragOver} onDragLeave={() => setDropping(false)} onDrop={onDrop}>
          {inBin ? (
            <BinView bin={bin} loading={loading} onRestore={what => void restore(what)} />
          ) : (
            <>
              <div className="dc-bar">
                <nav className="dc-crumbs" aria-label="Where you are">
                  <button type="button" className="wk-link" onClick={() => openFolder(null)}>All documents</button>
                  {trail.map(f => (
                    <span key={f.folderId}><ChevronRight size={14} aria-hidden="true" /><button type="button" className="wk-link" onClick={() => openFolder(f.folderId)}>{f.name}</button></span>
                  ))}
                </nav>
                {canEdit && (
                  <div className="dc-actions">
                    <button type="button" className="wk-btn is-primary" onClick={() => void newPage()}><FilePlus2 size={16} aria-hidden="true" /> New page</button>
                    <button type="button" className="wk-btn" disabled={uploading > 0} onClick={() => fileInput.current?.click()}>
                      <UploadCloud size={16} aria-hidden="true" /> {uploading > 0 ? `Uploading ${uploading}…` : 'Upload'}
                    </button>
                    <input ref={fileInput} type="file" hidden multiple accept={ACCEPT} onChange={e => { void upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
                    <button type="button" className="wk-btn" onClick={() => setFolderForm({ folder: null })}><FolderPlus size={16} aria-hidden="true" /> New folder</button>
                  </div>
                )}
              </div>

              <div className="dc-bar">
                <label className="wk-search">
                  <Search size={16} aria-hidden="true" />
                  <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search every folder by name, tag or text" aria-label="Search documents" />
                </label>
                {current && canEdit && (
                  <button type="button" className="wk-btn" onClick={() => setFolderForm({ folder: current })}><Settings2 size={16} aria-hidden="true" /> Folder settings</button>
                )}
                {current && canDelete && (
                  <button type="button" className="wk-iconbtn" aria-label={`Move folder ${current.name} to the bin`} title="Move this folder to the bin" onClick={() => setBinning(current)}><Trash2 size={17} /></button>
                )}
              </div>

              {current?.isRestricted && <p className="dc-locked"><Lock size={14} aria-hidden="true" /> Sensitive folder. Only the people let in can see it and what is inside.</p>}
              {error && <div className="wk-error" role="alert">{error} <button type="button" className="wk-link" onClick={() => { setLoading(true); reload(); }}>Try again</button></div>}

              <div className="wk-card">
                {loading ? <p className="wk-muted wk-pad">Loading…</p> : children.length === 0 && docs.length === 0 ? (
                  <div className="wk-empty is-inline">
                    {search ? (
                      <><h2>No documents match “{search}”</h2><p>Search looks at names, tags and the text of pages.</p></>
                    ) : (
                      <>
                        <h2>{current ? `“${current.name}” is empty` : 'No documents yet'}</h2>
                        <p>{canEdit ? 'Write a page, or drop files anywhere on this panel to upload them.' : 'Nothing has been added here yet.'}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="wk-table-wrap">
                    <table className="wk-table dc-table" aria-label={search ? 'Search results' : 'Documents'}>
                      <thead>
                        <tr><th scope="col">Name</th><th scope="col">Tags</th><th scope="col">Updated</th><th scope="col">By</th><th scope="col" className="dc-num">Size</th></tr>
                      </thead>
                      <tbody>
                        {children.map(f => (
                          <FolderRow key={f.folderId} folder={f} canEdit={canEdit} dragging={dragged} folders={folders} onOpen={() => openFolder(f.folderId)} />
                        ))}
                        {docs.map(d => (
                          <DocRow key={d.documentId} doc={d} canEdit={canEdit} showPath={!!search} onOpen={() => go({ doc: d.documentId })} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loading && (children.length > 0 || docs.length > 0) && (
                  <div className="wk-foot">
                    {search ? `${docs.length} found` : `${children.length} folders · ${docs.length} documents`}{canEdit && !search ? ' · drag onto a folder to move' : ''}
                  </div>
                )}
              </div>
              {dropping && <div className="dc-dropnote" aria-hidden="true"><UploadCloud size={28} /> Drop to upload to {current ? `“${current.name}”` : 'All documents'}</div>}
            </>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragged ? <div className="dc-dragging">{dragged.kind === 'doc' ? <><DocIcon doc={dragged.doc} /> {dragged.doc.name}</> : <><Folder size={16} aria-hidden="true" /> {dragged.folder.name}</>}</div> : null}
      </DragOverlay>

      {folderForm && (
        <FolderDialog
          folder={folderForm.folder} parentId={folderId} users={users} canLockAny={canSensitive}
          onClose={() => setFolderForm(null)} onSaved={() => { setFolderForm(null); reload(); }}
        />
      )}
      {binning && (
        <Dialog title={`Move folder “${binning.name}” to the bin?`} onClose={() => setBinning(null)}>
          <p className="wk-dialog-text">The folder and everything in it disappears for everyone. It can be brought back from the bin.</p>
          <div className="wk-form-actions">
            <button type="button" className="wk-btn" onClick={() => setBinning(null)}>Keep it</button>
            <button type="button" className="wk-btn is-danger" onClick={() => void binFolder(binning)}>Move to the bin</button>
          </div>
        </Dialog>
      )}
    </DndContext>
  );
}

function FolderMark({ folder }: { folder: DocFolder }) {
  return (
    <span className={`dc-folder dc-folder-${folder.color || 'none'}`}>
      {folder.isRestricted ? <Lock size={15} aria-hidden="true" /> : <Folder size={16} aria-hidden="true" />}
      {folder.isRestricted && <span className="wk-sr">Sensitive folder</span>}
    </span>
  );
}

/** A folder in the tree that documents and folders can be dropped on. */
function TreeDrop({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tree:${id}`, disabled: !active });
  return <div ref={setNodeRef} className={`dc-tree-drop ${isOver && active ? 'is-over' : ''}`}>{children}</div>;
}

function FolderRow({ folder, canEdit, dragging, folders, onOpen }: { folder: DocFolder; canEdit: boolean; dragging: Dragged | null; folders: DocFolder[]; onOpen: () => void }) {
  const accepts = !!dragging && !(dragging.kind === 'folder' && isInside(folders, folder.folderId, dragging.folder.folderId));
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `row:${folder.folderId}`, disabled: !accepts });
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `folder:${folder.folderId}`, data: { kind: 'folder', folder } satisfies Dragged, disabled: !canEdit });
  return (
    <tr ref={setDropRef} className={isOver && accepts ? 'is-over' : ''}>
      <th scope="row">
        <span className="dc-name" ref={setNodeRef} {...attributes} {...listeners}>
          <FolderMark folder={folder} />
          <button type="button" className="dc-open" onClick={onOpen}>{folder.name}</button>
        </span>
      </th>
      <td><span className="wk-none">–</span></td>
      <td>{formatWhen(folder.updatedAt)}</td>
      <td><span className="wk-none">–</span></td>
      <td className="dc-num">{folder.documentCount === 1 ? '1 item' : `${folder.documentCount} items`}</td>
    </tr>
  );
}

function DocRow({ doc, canEdit, showPath, onOpen }: { doc: Doc; canEdit: boolean; showPath: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `doc:${doc.documentId}`, data: { kind: 'doc', doc } satisfies Dragged, disabled: !canEdit });
  return (
    <tr>
      <th scope="row">
        <span className="dc-name" ref={setNodeRef} {...attributes} {...listeners}>
          <DocIcon doc={doc} />
          <button type="button" className="dc-open" onClick={onOpen}>{doc.name}</button>
          {doc.versionNumber > 1 && <span className="wk-tag" title="Version">v{doc.versionNumber}</span>}
          {doc.linkedItemCount > 0 && <span className="wk-tag" title="Linked work items">{doc.linkedItemCount} linked</span>}
        </span>
        {showPath && <span className="dc-path">{doc.path.length > 0 ? doc.path.join(' › ') : 'Top level'}</span>}
      </th>
      <td>{doc.tags.length > 0 ? <span className="wk-labels">{doc.tags.map(t => <span key={t} className="wk-tag">{t}</span>)}</span> : <span className="wk-none">–</span>}</td>
      <td>{formatWhen(doc.updatedAt)}</td>
      <td>{doc.updatedByName || <span className="wk-none">–</span>}</td>
      <td className="dc-num">{doc.kind === 'File' ? formatSize(doc.sizeBytes) : <span className="wk-none">–</span>}</td>
    </tr>
  );
}

function BinView({ bin, loading, onRestore }: { bin: DocBin | null; loading: boolean; onRestore: (what: { doc?: Doc; folder?: DocFolder }) => void }) {
  const empty = !!bin && bin.folders.length === 0 && bin.documents.length === 0;
  return (
    <>
      <div className="dc-bar"><h2 className="dc-h2">Bin</h2></div>
      <p className="wk-muted">Folders and documents moved here are hidden from everyone. Restoring puts them back where they were.</p>
      <div className="wk-card">
        {loading || !bin ? <p className="wk-muted wk-pad">Loading…</p> : empty ? (
          <div className="wk-empty is-inline"><h2>The bin is empty</h2></div>
        ) : (
          <div className="wk-table-wrap">
            <table className="wk-table dc-table" aria-label="Bin">
              <thead><tr><th scope="col">Name</th><th scope="col">Was in</th><th scope="col">Binned</th><th scope="col">By</th><th scope="col" /></tr></thead>
              <tbody>
                {bin.folders.map(f => (
                  <tr key={f.folderId}>
                    <th scope="row"><span className="dc-name"><FolderMark folder={f} /> {f.name}</span></th>
                    <td><span className="wk-none">–</span></td><td><span className="wk-none">–</span></td><td><span className="wk-none">–</span></td>
                    <td className="dc-num"><button type="button" className="wk-link" onClick={() => onRestore({ folder: f })}><RotateCcw size={14} aria-hidden="true" /> Restore</button></td>
                  </tr>
                ))}
                {bin.documents.map(d => (
                  <tr key={d.documentId}>
                    <th scope="row"><span className="dc-name"><DocIcon doc={d} /> {d.name}</span></th>
                    <td>{d.path.length > 0 ? d.path.join(' › ') : 'Top level'}</td>
                    <td>{d.deletedAt ? formatWhen(d.deletedAt) : ''}</td>
                    <td>{d.deletedByName || ''}</td>
                    <td className="dc-num"><button type="button" className="wk-link" onClick={() => onRestore({ doc: d })}><RotateCcw size={14} aria-hidden="true" /> Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
