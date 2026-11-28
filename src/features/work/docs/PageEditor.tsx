import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Highlight from '@tiptap/extension-highlight';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, Code, Highlighter, Italic, Link2, List, ListChecks, ListOrdered,
  Minus, Plus, Quote, Redo2, RemoveFormatting, SquareCode, Strikethrough, Table as TableIcon, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import {
  CALLOUTS, Callout, HIGHLIGHTS, SlashCommands, TEXT_COLOURS, cleanPage, type CalloutTone, type SlashItem, type SlashView,
} from './pageExtensions';

interface Props {
  /** The page as saved: the editor's JSON as text, or null for an empty page. Read once per mount. */
  initialContent: string | null;
  editable: boolean;
  /** Called on every change with the JSON (as text) and the same page as plain text, for search. */
  onChange: (content: string, text: string) => void;
}

function parse(content: string | null): object | string {
  if (!content) return '';
  try { return cleanPage(JSON.parse(content) as object); } catch { return content; }
}

type Menu = 'style' | 'colour' | 'highlight' | 'align' | 'insert' | null;
const STYLES = [
  { key: 'p', label: 'Text' },
  { key: 'h1', label: 'Large heading' },
  { key: 'h2', label: 'Heading' },
  { key: 'h3', label: 'Small heading' },
] as const;
const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selected while clicking the toolbar

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`dc-tool${active ? ' is-on' : ''}`} aria-pressed={active === undefined ? undefined : !!active} aria-label={label} title={label}
      disabled={disabled} onMouseDown={keep} onClick={onClick}>{children}</button>
  );
}

function MenuBtn({ open, onToggle, label, wide, children }: { open: boolean; onToggle: () => void; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`dc-tool${wide ? ' is-wide' : ''}${open ? ' is-on' : ''}`} aria-label={label} title={label} aria-haspopup="true"
      aria-expanded={open} onMouseDown={keep} onClick={onToggle}>{children}<ChevronDown size={13} aria-hidden="true" className="dc-tool-caret" /></button>
  );
}

/**
 * The page editor: text styles, colours, highlights, alignment, callout boxes, lists, checklists, tables, quotes,
 * code and links, plus a "/" menu to insert blocks. Pages are kept as the editor's own JSON, never as HTML, so
 * nothing a person types can run as code; colours come from fixed palettes (pageExtensions.ts).
 */
export default function PageEditor({ initialContent, editable, onChange }: Props) {
  // The "/" menu: the extension reports what was typed; this component draws the list.
  const [slash, setSlash] = useState<{ items: SlashItem[]; index: number; pos: React.CSSProperties; pick: (i: SlashItem) => void } | null>(null);
  const slashRef = useRef(slash);
  useEffect(() => { slashRef.current = slash; }, [slash]);
  const view = useMemo<SlashView>(() => {
    const place = (p: SuggestionProps<SlashItem>) => {
      const r = p.clientRect?.();
      // Under the cursor; above it when there is no room below (writing near the bottom of the screen).
      const left = Math.max(8, Math.min(r?.left ?? 0, window.innerWidth - 296));
      const roomBelow = window.innerHeight - (r?.bottom ?? 0) - 12;
      const pos: React.CSSProperties = roomBelow >= 240 || (r?.top ?? 0) < roomBelow
        ? { left, top: (r?.bottom ?? 0) + 6, maxHeight: Math.min(340, roomBelow) }
        : { left, bottom: window.innerHeight - (r?.top ?? 0) + 6, maxHeight: Math.min(340, (r?.top ?? 0) - 80) };
      setSlash(s => ({ items: p.items, index: s && s.items === p.items ? s.index : 0, pos, pick: i => p.command(i) }));
    };
    return {
      open: place,
      update: place,
      close: () => setSlash(null),
      keyDown: ({ event }: SuggestionKeyDownProps) => {
        const s = slashRef.current;
        if (!s) return false;
        if (event.key === 'Escape') { setSlash(null); return true; }
        if (!s.items.length) return false;
        if (event.key === 'ArrowDown') { setSlash({ ...s, index: (s.index + 1) % s.items.length }); return true; }
        if (event.key === 'ArrowUp') { setSlash({ ...s, index: (s.index + s.items.length - 1) % s.items.length }); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { s.pick(s.items[s.index]); return true; }
        return false;
      },
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable, autolink: true } }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Callout,
      SlashCommands.configure({ view: () => view }),
      Placeholder.configure({ placeholder: 'Start writing, or type / to add a heading, list, coloured box or table.' }),
    ],
    content: parse(initialContent),
    editable,
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON()), e.getText({ blockSeparator: '\n' })),
    // Keep the cursor clear of the pinned toolbar when the page scrolls to follow it.
    editorProps: { scrollMargin: { top: 110, bottom: 40, left: 0, right: 0 }, scrollThreshold: { top: 110, bottom: 40, left: 0, right: 0 }, attributes: { class: 'dc-editor-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Page text' } },
  });

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false, italic: e?.isActive('italic') ?? false, underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false, code: e?.isActive('code') ?? false, highlight: e?.isActive('highlight') ?? false,
      colour: (e?.getAttributes('textStyle').color as string | undefined) ?? null,
      highlightColour: (e?.getAttributes('highlight').color as string | undefined) ?? null,
      style: e?.isActive('heading', { level: 1 }) ? 'h1' : e?.isActive('heading', { level: 2 }) ? 'h2' : e?.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      align: e?.isActive({ textAlign: 'center' }) ? 'center' : e?.isActive({ textAlign: 'right' }) ? 'right' : 'left',
      bullet: e?.isActive('bulletList') ?? false, ordered: e?.isActive('orderedList') ?? false, task: e?.isActive('taskList') ?? false,
      quote: e?.isActive('blockquote') ?? false, block: e?.isActive('codeBlock') ?? false, link: e?.isActive('link') ?? false,
      callout: e?.isActive('callout') ? ((e.getAttributes('callout').tone as CalloutTone | undefined) ?? 'note') : null,
      table: e?.isActive('table') ?? false, canUndo: e?.can().undo() ?? false, canRedo: e?.can().redo() ?? false,
    }),
  });

  const [menu, setMenu] = useState<Menu>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const done = (run: () => void) => () => { run(); setMenu(null); };
  const toggle = (m: Exclude<Menu, null>) => setMenu(cur => (cur === m ? null : m));

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
  const setStyle = (key: string) => {
    if (key === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(key[1]) as 1 | 2 | 3 }).run();
  };

  const gap = (k: string) => <span key={k} className="dc-editor-gap" aria-hidden="true" />;
  const AlignIcon = on?.align === 'center' ? AlignCenter : on?.align === 'right' ? AlignRight : AlignLeft;

  return (
    <div className={`dc-editor ${editable ? '' : 'is-readonly'}`}>
      {editable && (
        <div className="dc-editor-bar" role="toolbar" aria-label="Formatting" ref={barRef}>
          <Btn label="Undo" disabled={!on?.canUndo} onClick={() => chain().undo().run()}><Undo2 size={17} aria-hidden="true" /></Btn>
          <Btn label="Redo" disabled={!on?.canRedo} onClick={() => chain().redo().run()}><Redo2 size={17} aria-hidden="true" /></Btn>
          {gap('g1')}

          <span className="dc-menu-wrap">
            <MenuBtn open={menu === 'style'} onToggle={() => toggle('style')} label="Text style" wide><span className="dc-tool-text">{STYLES.find(s => s.key === on?.style)?.label ?? 'Text'}</span></MenuBtn>
            {menu === 'style' && (
              <div className="dc-pop dc-pop-list" role="menu" aria-label="Text style">
                {STYLES.map(s => (
                  <button key={s.key} type="button" role="menuitemradio" aria-checked={on?.style === s.key} className={`dc-style-${s.key}`} onMouseDown={keep}
                    onClick={done(() => setStyle(s.key))}>{s.label}</button>
                ))}
              </div>
            )}
          </span>
          {gap('g2')}

          <Btn label="Bold" active={on?.bold} onClick={() => chain().toggleBold().run()}><Bold size={17} aria-hidden="true" /></Btn>
          <Btn label="Italic" active={on?.italic} onClick={() => chain().toggleItalic().run()}><Italic size={17} aria-hidden="true" /></Btn>
          <Btn label="Underline" active={on?.underline} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon size={17} aria-hidden="true" /></Btn>
          <Btn label="Strike through" active={on?.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={17} aria-hidden="true" /></Btn>

          <span className="dc-menu-wrap">
            <MenuBtn open={menu === 'colour'} onToggle={() => toggle('colour')} label="Text colour">
              <span className="dc-swatch-icon"><Baseline size={17} aria-hidden="true" /><i style={{ background: on?.colour ?? 'var(--ink)' }} /></span>
            </MenuBtn>
            {menu === 'colour' && (
              <div className="dc-pop dc-pop-swatches" role="menu" aria-label="Text colour">
                <button type="button" role="menuitem" className="dc-swatch is-none" onMouseDown={keep} onClick={done(() => chain().unsetColor().run())} title="Default">
                  <span style={{ color: 'var(--ink)' }}>A</span><small>Default</small>
                </button>
                {TEXT_COLOURS.map(c => (
                  <button key={c.value} type="button" role="menuitemradio" aria-checked={on?.colour?.toLowerCase() === c.value.toLowerCase()} className="dc-swatch" title={c.name}
                    onMouseDown={keep} onClick={done(() => chain().setColor(c.value).run())}>
                    <span style={{ color: c.value }}>A</span><small>{c.name}</small>
                  </button>
                ))}
              </div>
            )}
          </span>
          <span className="dc-menu-wrap">
            <MenuBtn open={menu === 'highlight'} onToggle={() => toggle('highlight')} label="Highlight">
              <span className="dc-swatch-icon"><Highlighter size={17} aria-hidden="true" /><i style={{ background: on?.highlight ? on.highlightColour ?? HIGHLIGHTS[0].value : '#FEF08A' }} /></span>
            </MenuBtn>
            {menu === 'highlight' && (
              <div className="dc-pop dc-pop-swatches" role="menu" aria-label="Highlight">
                <button type="button" role="menuitem" className="dc-swatch is-none" onMouseDown={keep} onClick={done(() => chain().unsetHighlight().run())} title="No highlight">
                  <span className="dc-chip is-none" /><small>None</small>
                </button>
                {HIGHLIGHTS.map(h => (
                  <button key={h.value} type="button" role="menuitemradio" aria-checked={on?.highlight && (on.highlightColour ?? HIGHLIGHTS[0].value).toLowerCase() === h.value.toLowerCase()}
                    className="dc-swatch" title={h.name} onMouseDown={keep} onClick={done(() => chain().setHighlight({ color: h.value }).run())}>
                    <span className="dc-chip" style={{ background: h.value }} /><small>{h.name}</small>
                  </button>
                ))}
              </div>
            )}
          </span>
          <Btn label={on?.link ? 'Remove link' : 'Link'} active={on?.link} onClick={setLink}><Link2 size={17} aria-hidden="true" /></Btn>
          {gap('g3')}

          <span className="dc-menu-wrap">
            <MenuBtn open={menu === 'align'} onToggle={() => toggle('align')} label="Align"><AlignIcon size={17} aria-hidden="true" /></MenuBtn>
            {menu === 'align' && (
              <div className="dc-pop dc-pop-row" role="menu" aria-label="Align">
                {([['left', 'Align left', AlignLeft], ['center', 'Centre', AlignCenter], ['right', 'Align right', AlignRight]] as const).map(([v, label, I]) => (
                  <button key={v} type="button" role="menuitemradio" aria-checked={on?.align === v} aria-label={label} title={label} className={`dc-tool${on?.align === v ? ' is-on' : ''}`}
                    onMouseDown={keep} onClick={done(() => chain().setTextAlign(v).run())}><I size={17} aria-hidden="true" /></button>
                ))}
              </div>
            )}
          </span>
          <Btn label="Bulleted list" active={on?.bullet} onClick={() => chain().toggleBulletList().run()}><List size={17} aria-hidden="true" /></Btn>
          <Btn label="Numbered list" active={on?.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={17} aria-hidden="true" /></Btn>
          <Btn label="Checklist" active={on?.task} onClick={() => chain().toggleTaskList().run()}><ListChecks size={17} aria-hidden="true" /></Btn>
          {gap('g4')}

          <span className="dc-menu-wrap">
            <MenuBtn open={menu === 'insert'} onToggle={() => toggle('insert')} label="Insert" wide><Plus size={16} aria-hidden="true" /><span className="dc-tool-text">Insert</span></MenuBtn>
            {menu === 'insert' && (
              <div className="dc-pop dc-pop-list dc-pop-insert" role="menu" aria-label="Insert">
                <span className="dc-pop-head">Coloured box</span>
                {CALLOUTS.map(c => (
                  <button key={c.tone} type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().setCallout(c.tone).run())}>
                    <span className={`dc-callout-dot is-${c.tone}`} aria-hidden="true" />{c.name}
                  </button>
                ))}
                <span className="dc-pop-head">Blocks</span>
                <button type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().toggleBlockquote().run())}><Quote size={16} aria-hidden="true" />Quote</button>
                <button type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().setHorizontalRule().run())}><Minus size={16} aria-hidden="true" />Dividing line</button>
                <button type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}><TableIcon size={16} aria-hidden="true" />Table</button>
                <button type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().toggleCodeBlock().run())}><SquareCode size={16} aria-hidden="true" />Code block</button>
                <button type="button" role="menuitem" onMouseDown={keep} onClick={done(() => chain().toggleCode().run())}><Code size={16} aria-hidden="true" />Code in a line</button>
              </div>
            )}
          </span>
          <Btn label="Clear formatting" onClick={() => chain().unsetAllMarks().unsetTextAlign().run()}><RemoveFormatting size={17} aria-hidden="true" /></Btn>

          {on?.callout && (
            <span className="dc-editor-tablebar" role="group" aria-label="Coloured box">
              {CALLOUTS.map(c => (
                <button key={c.tone} type="button" className={`dc-tone is-${c.tone}${on.callout === c.tone ? ' is-on' : ''}`} aria-pressed={on.callout === c.tone}
                  onMouseDown={keep} onClick={() => chain().setCallout(c.tone).run()}>{c.name}</button>
              ))}
              <button type="button" onMouseDown={keep} onClick={() => chain().unsetCallout().run()}>Remove box</button>
            </span>
          )}
          {on?.table && (
            <span className="dc-editor-tablebar">
              <button type="button" onMouseDown={keep} onClick={() => chain().addRowAfter().run()}>+ Row</button>
              <button type="button" onMouseDown={keep} onClick={() => chain().addColumnAfter().run()}>+ Column</button>
              <button type="button" onMouseDown={keep} onClick={() => chain().deleteRow().run()}>− Row</button>
              <button type="button" onMouseDown={keep} onClick={() => chain().deleteColumn().run()}>− Column</button>
              <button type="button" onMouseDown={keep} onClick={() => chain().deleteTable().run()}>Remove table</button>
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
      {slash && (
        <div className="dc-slash" role="listbox" aria-label="Insert" style={slash.pos}>
          {slash.items.length === 0 ? <p className="dc-slash-none">Nothing matches</p> : slash.items.map((it, i) => (
            <button key={it.key} type="button" role="option" aria-selected={i === slash.index} className={i === slash.index ? 'is-on' : ''}
              onMouseDown={keep} onMouseEnter={() => setSlash(s => (s ? { ...s, index: i } : s))} onClick={() => slash.pick(it)}>
              <b>{it.label}</b><span>{it.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
