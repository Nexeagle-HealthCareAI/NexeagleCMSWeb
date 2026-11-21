import type { ItemType } from '../types';

// Docs tab. These mirror the CMS API's Doc* DTOs (CMSAPI.Application/Models/DocsModels.cs).

export type FolderColor = 'grey' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
export const FOLDER_COLORS: FolderColor[] = ['grey', 'blue', 'green', 'amber', 'red', 'purple'];

export interface DocFolder {
  folderId: string;
  parentId: string | null;
  name: string;
  color: FolderColor | null;
  /** Locked to the people on its access list. Folders the reader may not open never arrive at all. */
  isRestricted: boolean;
  /** The reader may change who can open this folder. */
  canManageAccess: boolean;
  documentCount: number;
  updatedAt: string;
}

export type DocKind = 'Page' | 'File';

export interface Doc {
  documentId: string;
  /** null: the top level. */
  folderId: string | null;
  kind: DocKind;
  name: string;
  contentType: string | null;
  sizeBytes: number;
  versionNumber: number;
  tags: string[];
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  linkedItemCount: number;
  /** Folder names from the top down. */
  path: string[];
  isDeleted: boolean;
  deletedAt: string | null;
  deletedByName: string | null;
}

export interface DocVersion {
  versionId: string;
  versionNumber: number;
  name: string;
  sizeBytes: number;
  createdByName: string | null;
  createdAt: string;
}

export interface DocLinkedItem {
  workItemId: string;
  projectId: string;
  key: string;
  title: string;
  itemType: ItemType;
}

export interface DocDetail extends Doc {
  /** Page: the editor's JSON, as text. null for a file. */
  content: string | null;
  versions: DocVersion[];
  linkedItems: DocLinkedItem[];
}

export interface DocLogEntry {
  action: string;
  detail: string | null;
  userName: string;
  createdAt: string;
}

export interface DocBin {
  folders: DocFolder[];
  documents: Doc[];
}

export interface SaveFolderPayload {
  name: string;
  parentId: string | null;
  color: FolderColor | null;
  isRestricted: boolean;
}
