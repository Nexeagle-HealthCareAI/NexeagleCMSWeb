import { useEffect } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Bold, Code, Heading2, Italic, List, ListOrdered, Quote } from 'lucide-react';

interface Props {
  /** Starting markdown. Read once; give the editor a new `key` to load other text. */
  initialMarkdown: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  label: string;
}

/** Rich text for descriptions, saved as markdown. With editable=false it only shows the text. */
export default function WorkEditor({ initialMarkdown, editable, onChange, label }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Markdown],
    content: initialMarkdown,
    contentType: 'markdown',
    editable,
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
    editorProps: { attributes: { class: 'wk-editor-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label } },
  });

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      code: e?.isActive('code') ?? false,
      heading: e?.isActive('heading', { level: 2 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
    }),
  });

  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const tools = [
    { key: 'bold', label: 'Bold', Icon: Bold, active: on?.bold, run: () => chain().toggleBold().run() },
    { key: 'italic', label: 'Italic', Icon: Italic, active: on?.italic, run: () => chain().toggleItalic().run() },
    { key: 'heading', label: 'Heading', Icon: Heading2, active: on?.heading, run: () => chain().toggleHeading({ level: 2 }).run() },
    { key: 'bullet', label: 'Bulleted list', Icon: List, active: on?.bullet, run: () => chain().toggleBulletList().run() },
    { key: 'ordered', label: 'Numbered list', Icon: ListOrdered, active: on?.ordered, run: () => chain().toggleOrderedList().run() },
    { key: 'quote', label: 'Quote', Icon: Quote, active: on?.quote, run: () => chain().toggleBlockquote().run() },
    { key: 'code', label: 'Code', Icon: Code, active: on?.code, run: () => chain().toggleCode().run() },
  ];

  return (
    <div className={`wk-editor ${editable ? '' : 'is-readonly'}`}>
      {editable && (
        <div className="wk-editor-bar" role="toolbar" aria-label="Formatting">
          {tools.map(({ key, label: name, Icon, active, run }) => (
            <button key={key} type="button" className={active ? 'is-on' : ''} aria-pressed={!!active} aria-label={name} title={name} onMouseDown={e => e.preventDefault()} onClick={run}>
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
