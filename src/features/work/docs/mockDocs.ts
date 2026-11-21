import type { Doc, DocBin, DocDetail, DocFolder, DocLogEntry, DocVersion, SaveFolderPayload } from './types';

// In-memory stand-in used when VITE_WORK_MOCK=true. Example data only; resets on reload.
// The reader is treated as an administrator, so restricted folders are all visible here.

interface StoredDoc extends Doc { content: string | null; text: string; blob: Blob | null }
interface StoredVersion extends DocVersion { documentId: string; blob: Blob | null }

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;
const ME = 'Local reviewer';
const now = () => new Date().toISOString();
const wait = <T,>(value: T): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), 60));
const fail = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { success: false, message } } });

const folders: (DocFolder & { deleted?: boolean })[] = [];
const docs: StoredDoc[] = [];
const versions: StoredVersion[] = [];
const access: Record<string, string[]> = {};
const links: { workItemId: string; documentId: string }[] = [];
const log: Record<string, DocLogEntry[]> = {};

const note = (documentId: string, action: string, detail: string | null = null) =>
  (log[documentId] ||= []).unshift({ action, detail, userName: ME, createdAt: now() });

function addFolder(name: string, parentId: string | null, extra: Partial<DocFolder> = {}): DocFolder {
  const folder: DocFolder = { folderId: id('f'), parentId, name, color: null, isRestricted: false, canManageAccess: true, documentCount: 0, updatedAt: now(), ...extra };
  folders.push(folder);
  return folder;
}

function addDoc(kind: Doc['kind'], name: string, folderId: string | null, extra: Partial<StoredDoc> = {}): StoredDoc {
  const doc: StoredDoc = {
    documentId: id('d'), folderId, kind, name, contentType: null, sizeBytes: 0, versionNumber: 1, tags: [],
    createdByName: ME, updatedByName: ME, createdAt: now(), updatedAt: now(), linkedItemCount: 0, path: [],
    isDeleted: false, deletedAt: null, deletedByName: null, content: null, text: '', blob: null, ...extra,
  };
  docs.push(doc);
  note(doc.documentId, kind === 'Page' ? 'create' : 'upload', name);
  return doc;
}

const pageJson = (...paragraphs: string[]) => JSON.stringify({
  type: 'doc',
  content: paragraphs.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

// Example data.
(() => {
  const product = addFolder('Product', null, { color: 'blue' });
  const specs = addFolder('Specs', product.folderId);
  addFolder('Meeting notes', null, { color: 'green' });
  const hr = addFolder('HR and contracts', null, { color: 'red', isRestricted: true });
  access[hr.folderId] = ['u-1'];
  addDoc('Page', 'Billing redesign: what we agreed', specs.folderId, {
    content: pageJson('The cashier adds lab tests without leaving the bill.', 'Prices and tax show before the test is added.'),
    text: 'The cashier adds lab tests without leaving the bill. Prices and tax show before the test is added.', tags: ['billing'], sizeBytes: 240,
  });
  addDoc('File', 'release-checklist.txt', product.folderId, {
    contentType: 'text/plain', blob: new Blob(['1. Run the tests\n2. Back up the database\n3. Deploy to dev\n4. Check billing\n'], { type: 'text/plain' }), sizeBytes: 76, tags: ['release'],
  });
  addDoc('Page', 'How we work', null, { content: pageJson('Sprints are 11 days. Stand-up is at 10:00.'), text: 'Sprints are 11 days. Stand-up is at 10:00.', sizeBytes: 90 });
  addDoc('File', 'offer-letter-template.txt', hr.folderId, { contentType: 'text/plain', blob: new Blob(['Dear ...'], { type: 'text/plain' }), sizeBytes: 8 });
})();

const liveFolder = (folderId: string | null): boolean => {
  let at = folderId;
  for (let depth = 0; at && depth < 50; depth++) {
    const folder = folders.find(f => f.folderId === at);
    if (!folder || folder.deleted) return false;
    at = folder.parentId;
  }
  return true;
};
const pathOf = (folderId: string | null): string[] => {
  const names: string[] = [];
  let at = folderId;
  for (let depth = 0; at && depth < 50; depth++) {
    const folder = folders.find(f => f.folderId === at);
    if (!folder) break;
    names.unshift(folder.name);
    at = folder.parentId;
  }
  return names;
};
const viewFolder = (f: DocFolder & { deleted?: boolean }): DocFolder => {
  const { deleted: _deleted, ...rest } = f;
  void _deleted;
  return { ...rest, documentCount: docs.filter(d => d.folderId === f.folderId && !d.isDeleted).length };
};
const view = (d: StoredDoc): Doc => {
  const { content: _content, text: _text, blob: _blob, ...rest } = d;
  void _content; void _text; void _blob;
  return { ...rest, path: pathOf(d.folderId), linkedItemCount: links.filter(l => l.documentId === d.documentId).length };
};
const detail = (d: StoredDoc): DocDetail => ({
  ...view(d),
  content: d.kind === 'Page' ? d.content : null,
  versions: versions.filter(v => v.documentId === d.documentId).sort((a, b) => b.versionNumber - a.versionNumber)
    .map(({ documentId: _documentId, blob: _blob, ...v }) => { void _documentId; void _blob; return v; }),
  // The mock has no access to the work items, so linked items are listed by id only.
  linkedItems: links.filter(l => l.documentId === d.documentId).map(l => ({ workItemId: l.workItemId, projectId: '', key: 'Item', title: 'Linked work item', itemType: 'Task' as const })),
});
const find = (documentId: string): StoredDoc => {
  const doc = docs.find(d => d.documentId === documentId && !d.isDeleted);
  if (!doc || !liveFolder(doc.folderId)) throw fail(404, 'Document not found.');
  return doc;
};
const ALLOWED = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip'];
const ending = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '');

export const mockDocs = {
  folders: async () => wait(folders.filter(f => liveFolder(f.folderId)).map(viewFolder)),
  createFolder: async (p: SaveFolderPayload) => {
    if (!p.name.trim()) throw fail(400, 'Give the folder a name.');
    const folder = addFolder(p.name.trim(), p.parentId, { color: p.color, isRestricted: p.isRestricted });
    if (p.isRestricted) access[folder.folderId] = ['u-1'];
    return wait(viewFolder(folder));
  },
  updateFolder: async (folderId: string, p: SaveFolderPayload) => {
    const folder = folders.find(f => f.folderId === folderId);
    if (!folder) throw fail(404, 'Folder not found.');
    if (!p.name.trim()) throw fail(400, 'Give the folder a name.');
    let at: string | null = p.parentId;
    for (let depth = 0; at && depth < 50; depth++) {
      if (at === folderId) throw fail(400, 'A folder cannot be moved into itself.');
      at = folders.find(f => f.folderId === at)?.parentId ?? null;
    }
    Object.assign(folder, { name: p.name.trim(), parentId: p.parentId, color: p.color, isRestricted: p.isRestricted, updatedAt: now() });
    return wait(viewFolder(folder));
  },
  folderAccess: async (folderId: string) => wait([...(access[folderId] || [])]),
  setFolderAccess: async (folderId: string, userIds: string[]) => { access[folderId] = [...userIds]; return wait([...userIds]); },
  deleteFolder: async (folderId: string) => { const f = folders.find(x => x.folderId === folderId); if (f) f.deleted = true; await wait(undefined); },
  restoreFolder: async (folderId: string) => { const f = folders.find(x => x.folderId === folderId); if (f) f.deleted = false; await wait(undefined); },

  list: async (folderId: string | null, search?: string) => {
    const q = (search || '').trim().toLowerCase();
    const visible = docs.filter(d => !d.isDeleted && liveFolder(d.folderId));
    const found = q
      ? visible.filter(d => `${d.name} ${d.tags.join(' ')} ${d.text}`.toLowerCase().includes(q))
      : visible.filter(d => d.folderId === folderId);
    return wait(found.sort((a, b) => a.name.localeCompare(b.name)).map(view));
  },
  get: async (documentId: string) => { const d = find(documentId); note(documentId, 'open'); return wait(detail(d)); },
  createPage: async (name: string, folderId: string | null) => wait(detail(addDoc('Page', name.trim() || 'Untitled page', folderId))),
  savePage: async (documentId: string, content: string, contentText: string) => {
    const d = find(documentId);
    if (d.content && d.content !== content && !versions.some(v => v.documentId === documentId && Date.now() - new Date(v.createdAt).getTime() < 600_000)) {
      versions.push({ versionId: id('v'), documentId, versionNumber: d.versionNumber, name: d.name, sizeBytes: d.sizeBytes, createdByName: d.updatedByName, createdAt: d.updatedAt, blob: null });
      d.versionNumber += 1;
    }
    Object.assign(d, { content, text: contentText, sizeBytes: content.length, updatedAt: now(), updatedByName: ME });
    return wait(detail(d));
  },
  update: async (documentId: string, p: { name: string; folderId: string | null; tags: string[] }) => {
    const d = find(documentId);
    if (!p.name.trim()) throw fail(400, 'Give the document a name.');
    if (d.kind === 'File' && ending(p.name) !== ending(d.name)) throw fail(400, `Keep the file's ending (${ending(d.name)}) when you rename it.`);
    if (d.name !== p.name.trim()) note(documentId, 'rename', `${d.name} -> ${p.name.trim()}`);
    if (d.folderId !== p.folderId) note(documentId, 'move', d.name);
    Object.assign(d, { name: p.name.trim(), folderId: p.folderId, tags: Array.from(new Set(p.tags.map(t => t.trim().toLowerCase()).filter(Boolean))), updatedAt: now(), updatedByName: ME });
    return wait(detail(d));
  },
  upload: async (file: File, folderId: string | null) => {
    if (!ALLOWED.includes(ending(file.name))) throw fail(400, 'This type of file cannot be uploaded. Use PDF, Word, Excel, PowerPoint, text, CSV, an image or a zip.');
    if (file.size > 25 * 1024 * 1024) throw fail(413, 'The file is larger than 25 MB.');
    const existing = docs.find(d => !d.isDeleted && d.kind === 'File' && d.folderId === folderId && d.name === file.name);
    if (existing) {
      versions.push({ versionId: id('v'), documentId: existing.documentId, versionNumber: existing.versionNumber, name: existing.name, sizeBytes: existing.sizeBytes, createdByName: existing.updatedByName, createdAt: existing.updatedAt, blob: existing.blob });
      Object.assign(existing, { blob: file, sizeBytes: file.size, contentType: file.type || 'application/octet-stream', versionNumber: existing.versionNumber + 1, updatedAt: now(), updatedByName: ME });
      note(existing.documentId, 'upload', `${file.name} (version ${existing.versionNumber})`);
      return wait(detail(existing));
    }
    return wait(detail(addDoc('File', file.name, folderId, { blob: file, sizeBytes: file.size, contentType: file.type || 'application/octet-stream' })));
  },
  file: async (documentId: string, versionId?: string) => {
    const d = find(documentId);
    const blob = versionId ? versions.find(v => v.versionId === versionId)?.blob : d.blob;
    if (!blob) throw fail(404, 'The file is missing from storage.');
    note(documentId, 'download', versionId ? 'An earlier version' : null);
    return wait(blob);
  },
  remove: async (documentId: string) => { const d = find(documentId); Object.assign(d, { isDeleted: true, deletedAt: now(), deletedByName: ME }); note(documentId, 'bin', d.name); await wait(undefined); },
  restore: async (documentId: string) => {
    const d = docs.find(x => x.documentId === documentId);
    if (!d) throw fail(404, 'Document not found in the bin.');
    Object.assign(d, { isDeleted: false, deletedAt: null, deletedByName: null, folderId: liveFolder(d.folderId) ? d.folderId : null });
    await wait(undefined);
  },
  bin: async (): Promise<DocBin> => wait({ folders: folders.filter(f => f.deleted).map(viewFolder), documents: docs.filter(d => d.isDeleted).map(view) }),
  log: async (documentId: string) => wait([...(log[documentId] || [])]),

  itemDocuments: async (workItemId: string) =>
    wait(links.filter(l => l.workItemId === workItemId).map(l => docs.find(d => d.documentId === l.documentId)).filter((d): d is StoredDoc => !!d && !d.isDeleted && liveFolder(d.folderId)).map(view)),
  link: async (workItemId: string, documentId: string) => { find(documentId); if (!links.some(l => l.workItemId === workItemId && l.documentId === documentId)) links.push({ workItemId, documentId }); await wait(undefined); },
  unlink: async (workItemId: string, documentId: string) => { const at = links.findIndex(l => l.workItemId === workItemId && l.documentId === documentId); if (at >= 0) links.splice(at, 1); await wait(undefined); },
};
