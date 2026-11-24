import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Bold, Code, Heading2, Italic, List, ListOrdered, Quote } from 'lucide-react';
import type { WorkUser } from '../types';
import { mentionQuery } from '../chatMeta';
import { Avatar } from './parts';

interface Props {
  /** Starting markdown. Read once; give the editor a new `key` to load other text. */
  initialMarkdown: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  label: string;
  /** People who can be tagged: typing @ offers them. Leave out for no tagging. */
  mentionUsers?: WorkUser[];
  /** Names shown as tags ("@Full Name") in the text. */
  mentionNames?: string[];
}

const tagsKey = new PluginKey<{ names: string[]; marks: DecorationSet }>('wk-tags');

/** Marks every "@Full Name" of the given people, longest names first, so tags stand out in the text. */
function findTags(doc: PmNode, names: string[]): DecorationSet {
  const list = names.filter(Boolean).sort((a, b) => b.length - a.length);
  if (list.length === 0) return DecorationSet.empty;
  const marks: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const taken: [number, number][] = [];
    for (const name of list) {
      const tag = `@${name}`;
      for (let at = text.indexOf(tag); at >= 0; at = text.indexOf(tag, at + tag.length)) {
        if (taken.some(([a, b]) => at < b && at + tag.length > a)) continue;
        taken.push([at, at + tag.length]);
        marks.push(Decoration.inline(pos + at, pos + at + tag.length, { class: 'wk-tag' }));
      }
    }
  });
  return DecorationSet.create(doc, marks);
}

/** The names arrive in a transaction (setMeta(tagsKey, names)); the marks follow every change. */
const WorkTags = Extension.create({
  name: 'workTags',
  addProseMirrorPlugins: () => [new Plugin({
    key: tagsKey,
    state: {
      init: () => ({ names: [] as string[], marks: DecorationSet.empty }),
      apply: (tr, old) => {
        const names = tr.getMeta(tagsKey) as string[] | undefined;
        if (names) return { names, marks: findTags(tr.doc, names) };
        return tr.docChanged ? { names: old.names, marks: findTags(tr.doc, old.names) } : old;
      },
    },
    props: { decorations: state => tagsKey.getState(state)?.marks },
  })],
});

interface Suggest { from: number; to: number; query: string; left: number; top: number; above: number }

/** The "@name" being typed just before the cursor, with where it starts in the document. */
function suggestAt(editor: Editor): Suggest | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const q = mentionQuery(before, before.length);
  if (!q) return null;
  const coords = editor.view.coordsAtPos($from.pos);
  return { from: $from.pos - (before.length - q.start), to: $from.pos, query: q.query, left: coords.left, top: coords.bottom, above: coords.top };
}

/** Rich text for descriptions, saved as markdown. With editable=false it only shows the text. */
export default function WorkEditor({ initialMarkdown, editable, onChange, label, mentionUsers, mentionNames }: Props) {
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const [index, setIndex] = useState(0);
  const names = useMemo(() => mentionNames ?? (mentionUsers ?? []).map(u => u.fullName), [mentionNames, mentionUsers]);
  // The editor is made once; these refs let its handlers see the latest values.
  const usersRef = useRef(mentionUsers ?? []);
  const live = useRef<{ suggest: Suggest | null; options: WorkUser[]; index: number }>({ suggest: null, options: [], index: 0 });
  useEffect(() => { usersRef.current = mentionUsers ?? []; }, [mentionUsers]);

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    return (mentionUsers ?? []).filter(u => u.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [suggest, mentionUsers]);
  useEffect(() => { live.current = { suggest, options, index }; }, [suggest, options, index]);

  const editorRef = useRef<Editor | null>(null);
  const pick = (user: WorkUser) => {
    const ed = editorRef.current;
    const s = live.current.suggest;
    if (!ed || !s) return;
    ed.chain().focus().insertContentAt({ from: s.from, to: s.to }, `@${user.fullName} `).run();
    setSuggest(null);
  };
  const pickRef = useRef(pick);
  useEffect(() => { pickRef.current = pick; });

  const look = (ed: Editor) => {
    if (usersRef.current.length === 0 || !ed.isEditable) { setSuggest(null); return; }
    const next = suggestAt(ed);
    setSuggest(prev => (next && prev && prev.from === next.from && prev.query === next.query ? prev : next));
    if (!next) setIndex(0);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Markdown,
      WorkTags,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editable,
    onUpdate: ({ editor: e }) => { onChange(e.getMarkdown()); look(e); },
    onSelectionUpdate: ({ editor: e }) => look(e),
    onBlur: () => setSuggest(null),
    editorProps: {
      attributes: { class: 'wk-editor-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
      handleKeyDown: (_view, event) => {
        const { suggest: s, options: list, index: i } = live.current;
        if (!s || list.length === 0) return false;
        if (event.key === 'ArrowDown') { setIndex((i + 1) % list.length); return true; }
        if (event.key === 'ArrowUp') { setIndex((i - 1 + list.length) % list.length); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { pickRef.current(list[i]); return true; }
        if (event.key === 'Escape') { setSuggest(null); event.stopPropagation(); return true; }
        return false;
      },
    },
  });
  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  // New names (the people list arrived later): mark them in the text.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(tagsKey, names).setMeta('addToHistory', false));
  }, [editor, names]);

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
          {(mentionUsers?.length ?? 0) > 0 && <span className="wk-editor-hint">Type @ to tag someone</span>}
        </div>
      )}
      <EditorContent editor={editor} />
      {editable && suggest && options.length > 0 && (
        <ul className="wk-chat-suggest wk-editor-suggest" role="listbox" aria-label="People to tag" style={suggest.top + 240 > window.innerHeight
          // Not enough room under the line: open upwards.
          ? { left: suggest.left, top: 'auto', bottom: window.innerHeight - suggest.above + 6 }
          : { left: suggest.left, top: suggest.top + 6 }}>
          {options.map((u, i) => (
            <li key={u.userId} role="option" aria-selected={i === index} className={i === index ? 'is-on' : ''} onMouseDown={e => { e.preventDefault(); pick(u); }}>
              <Avatar name={u.fullName} /> {u.fullName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
