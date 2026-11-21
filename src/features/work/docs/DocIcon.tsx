import { Archive, File, FileSpreadsheet, FileText, FileType, Image as ImageIcon, NotebookText, Presentation } from 'lucide-react';
import { kindOf, KIND_LABEL, type FileKind } from './docsMeta';
import type { Doc } from './types';

const ICON: Record<FileKind, typeof File> = {
  page: NotebookText, image: ImageIcon, pdf: FileType, word: FileText, sheet: FileSpreadsheet, slides: Presentation, text: FileText, zip: Archive, other: File,
};

/** A small coloured icon for what a document is: a page, a PDF, a Word file and so on. */
export function DocIcon({ doc }: { doc: Pick<Doc, 'kind' | 'name'> }) {
  const kind = kindOf(doc);
  const Icon = ICON[kind];
  return <span className={`dc-icon dc-icon-${kind}`} title={KIND_LABEL[kind]}><Icon size={16} aria-hidden="true" /><span className="wk-sr">{KIND_LABEL[kind]}</span></span>;
}
