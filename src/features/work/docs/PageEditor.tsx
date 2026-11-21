import { useEffect, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold, Code, Heading1, Heading2, Heading3, Highlighter, Italic, Link2, List, ListChecks, ListOrdered, Minus, Quote, Redo2, SquareCode,
  Strikethrough, Table as TableIcon, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';

interface Props {
  /** The page as saved: the editor's JSON as text, or null for an empty page. Read once per mount. */
  initialContent: string | null;
  editable: boolean;
  /** Called on every change with the JSON (as text) and the same page as plain text, for search. */
  onChange: (content: string, text: string) => void;
}

function parse(content: string | null): object | string {
  if (!content) return '';
  try { return JSON.parse(content) as object; } catch { return content; }
}

/**
 * The page editor: headings, lists, checklists, tables, quotes, code, links and highlights.
 * Pages are kept as the editor's own JSON, never as HTML, so nothing a person types can run as code.
 */
export default function PageEditor({ initialContent, editable, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable, autolink: true } }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: 'Start writing. Type # for a heading, - for a list, [ ] for a checklist.' }),
    ],
    content: parse(initialContent),
    editable,
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON()), e.getText({ blockSeparator: '\n' })),
    editorProps: { attributes: { class: 'dc-editor-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Page text' } },
  });

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false, italic: e?.isActive('italic') ?? false, underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false, code: e?.isActive('code') ?? false, highlight: e?.isActive('highlight') ?? false,
      h1: e?.isActive('heading', { level: 1 }) ?? false, h2: e?.isActive('heading', { level: 2 }) ?? false, h3: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false, ordered: e?.isActive('orderedList') ?? false, task: e?.isActive('taskList') ?? false,
      quote: e?.isActive('blockquote') ?? false, block: e?.isActive('codeBlock') ?? false, link: e?.isActive('link') ?? false,
      table: e?.isActive('table') ?? false, canUndo: e?.can().undo() ?? false, canRedo: e?.can().redo() ?? false,
    }),
  });

  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    if (editor.isActive('link')) { chain().unsetLink().run(); return; }
    setLinkUrl('');
    setLinkError('');
    setLinking(true);
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    // Only ordinary web and mail links: a "javascript:" address must never get into a page.
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { setLinkError('Start the address with https://, http:// or mailto:'); return; }
    chain().extendMarkRange('link').setLink({ href: url }).run();
    setLinking(false);
  };

  type Tool = { key: string; label: string; Icon: typeof Bold; active?: boolean; disabled?: boolean; run: () => void } | 'gap';
  const tools: Tool[] = [
    { key: 'undo', label: 'Undo', Icon: Undo2, disabled: !on?.canUndo, run: () => chain().undo().run() },
    { key: 'redo', label: 'Redo', Icon: Redo2, disabled: !on?.canRedo, run: () => chain().redo().run() },
    'gap',
    { key: 'h1', label: 'Large heading', Icon: Heading1, active: on?.h1, run: () => chain().toggleHeading({ level: 1 }).run() },
    { key: 'h2', label: 'Heading', Icon: Heading2, active: on?.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: 'Small heading', Icon: Heading3, active: on?.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    'gap',
    { key: 'bold', label: 'Bold', Icon: Bold, active: on?.bold, run: () => chain().toggleBold().run() },
    { key: 'italic', label: 'Italic', Icon: Italic, active: on?.italic, run: () => chain().toggleItalic().run() },
    { key: 'underline', label: 'Underline', Icon: UnderlineIcon, active: on?.underline, run: () => chain().toggleUnderline().run() },
    { key: 'strike', label: 'Strike through', Icon: Strikethrough, active: on?.strike, run: () => chain().toggleStrike().run() },
    { key: 'highlight', label: 'Highlight', Icon: Highlighter, active: on?.highlight, run: () => chain().toggleHighlight().run() },
    { key: 'link', label: on?.link ? 'Remove link' : 'Link', Icon: Link2, active: on?.link, run: setLink },
    'gap',
    { key: 'bullet', label: 'Bulleted list', Icon: List, active: on?.bullet, run: () => chain().toggleBulletList().run() },
    { key: 'ordered', label: 'Numbered list', Icon: ListOrdered, active: on?.ordered, run: () => chain().toggleOrderedList().run() },
    { key: 'task', label: 'Checklist', Icon: ListChecks, active: on?.task, run: () => chain().toggleTaskList().run() },
    'gap',
    { key: 'quote', label: 'Quote', Icon: Quote, active: on?.quote, run: () => chain().toggleBlockquote().run() },
    { key: 'code', label: 'Code', Icon: Code, active: on?.code, run: () => chain().toggleCode().run() },
    { key: 'block', label: 'Code block', Icon: SquareCode, active: on?.block, run: () => chain().toggleCodeBlock().run() },
    { key: 'rule', label: 'Dividing line', Icon: Minus, run: () => chain().setHorizontalRule().run() },
    { key: 'table', label: 'Table', Icon: TableIcon, active: on?.table, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ];

  return (
    <div className={`dc-editor ${editable ? '' : 'is-readonly'}`}>
      {editable && (
        <div className="dc-editor-bar" role="toolbar" aria-label="Formatting">
          {tools.map((t, i) => t === 'gap' ? <span key={`gap-${i}`} className="dc-editor-gap" aria-hidden="true" /> : (
            <button key={t.key} type="button" className={t.active ? 'is-on' : ''} aria-pressed={t.active === undefined ? undefined : !!t.active} aria-label={t.label} title={t.label} disabled={t.disabled}
              onMouseDown={e => e.preventDefault()} onClick={t.run}>
              <t.Icon size={17} aria-hidden="true" />
            </button>
          ))}
          {on?.table && (
            <span className="dc-editor-tablebar">
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => chain().addRowAfter().run()}>+ Row</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => chain().addColumnAfter().run()}>+ Column</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => chain().deleteRow().run()}>− Row</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => chain().deleteColumn().run()}>− Column</button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => chain().deleteTable().run()}>Remove table</button>
            </span>
          )}
        </div>
      )}
      {editable && linking && (
        <div className="dc-editor-link">
          <label>
            <span>Link address</span>
            <input autoFocus value={linkUrl} placeholder="https://" onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinking(false); }} />
          </label>
          <button type="button" className="wk-btn is-primary" onClick={applyLink}>Add link</button>
          <button type="button" className="wk-btn" onClick={() => setLinking(false)}>Cancel</button>
          {linkError && <p className="wk-error" role="alert">{linkError}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
