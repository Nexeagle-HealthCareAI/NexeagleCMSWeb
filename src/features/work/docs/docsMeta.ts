import type { Doc, DocFolder } from './types';

// Small helpers shared by the Docs screens.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_ENDINGS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip'];
/** For the file chooser. */
export const ACCEPT = ALLOWED_ENDINGS.join(',');

export const endingOf = (name: string): string => (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '');

export type FileKind = 'page' | 'image' | 'pdf' | 'word' | 'sheet' | 'slides' | 'text' | 'zip' | 'other';

export function kindOf(doc: Pick<Doc, 'kind' | 'name'>): FileKind {
  if (doc.kind === 'Page') return 'page';
  const e = endingOf(doc.name);
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(e)) return 'image';
  if (e === '.pdf') return 'pdf';
  if (['.doc', '.docx'].includes(e)) return 'word';
  if (['.xls', '.xlsx', '.csv'].includes(e)) return 'sheet';
  if (['.ppt', '.pptx'].includes(e)) return 'slides';
  if (['.txt', '.md', '.json'].includes(e)) return 'text';
  if (e === '.zip') return 'zip';
  return 'other';
}

export const KIND_LABEL: Record<FileKind, string> = {
  page: 'Page', image: 'Image', pdf: 'PDF', word: 'Word', sheet: 'Spreadsheet', slides: 'Slides', text: 'Text', zip: 'Zip', other: 'File',
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why a chosen file cannot be uploaded, or null when it can. The API checks the same things. */
export function uploadProblem(file: File): string | null {
  if (!ALLOWED_ENDINGS.includes(endingOf(file.name))) return `${file.name}: this type of file cannot be uploaded.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 25 MB.`;
  return null;
}

export interface FolderNode {
  folder: DocFolder;
  depth: number;
  hasChildren: boolean;
}

/** Folders in tree order. Children of a closed folder are left out. */
export function buildFolderTree(folders: DocFolder[], closed: Set<string>): FolderNode[] {
  const ids = new Set(folders.map(f => f.folderId));
  const byParent = new Map<string | null, DocFolder[]>();
  for (const f of folders) {
    // A parent the reader cannot see leaves the folder at the top.
    const parent = f.parentId && ids.has(f.parentId) ? f.parentId : null;
    const list = byParent.get(parent);
    if (list) list.push(f); else byParent.set(parent, [f]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const nodes: FolderNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of byParent.get(parent) || []) {
      const children = byParent.get(folder.folderId) || [];
      nodes.push({ folder, depth, hasChildren: children.length > 0 });
      if (children.length > 0 && !closed.has(folder.folderId)) walk(folder.folderId, depth + 1);
    }
  };
  walk(null, 0);
  return nodes;
}

/** The folders from the top down to this one. */
export function trailOf(folders: DocFolder[], folderId: string | null): DocFolder[] {
  const trail: DocFolder[] = [];
  let at = folderId;
  for (let depth = 0; at && depth < 50; depth++) {
    const folder = folders.find(f => f.folderId === at);
    if (!folder) break;
    trail.unshift(folder);
    at = folder.parentId;
  }
  return trail;
}

/** Is `folderId` the same as, or somewhere under, `ancestorId`? */
export function isInside(folders: DocFolder[], folderId: string | null, ancestorId: string): boolean {
  return trailOf(folders, folderId).some(f => f.folderId === ancestorId);
}

/** Give the browser a file to save. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
