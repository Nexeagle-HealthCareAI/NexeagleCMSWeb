import { Extension, Node, mergeAttributes, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';

// Extra building blocks for Docs pages: coloured callout boxes, the fixed colour palettes, and the "/" menu.

// ── colours ──────────────────────────────────────────────────────────────
// Fixed palettes only: every text colour reads at 4.5:1 or better on white, and a saved page can only hold
// these values (cleanPage drops anything else), so a page never carries arbitrary CSS.

export const TEXT_COLOURS = [
  { name: 'Grey', value: '#475467' },
  { name: 'Red', value: '#D92D20' },
  { name: 'Orange', value: '#C4320A' },
  { name: 'Brown', value: '#B54708' },
  { name: 'Green', value: '#067647' },
  { name: 'Teal', value: '#107569' },
  { name: 'Blue', value: '#1570EF' },
  { name: 'Purple', value: '#6938EF' },
  { name: 'Pink', value: '#C11574' },
] as const;

export const HIGHLIGHTS = [
  { name: 'Yellow', value: '#FEF08A' },
  { name: 'Green', value: '#D1FADF' },
  { name: 'Blue', value: '#D1E9FF' },
  { name: 'Purple', value: '#EBE9FE' },
  { name: 'Pink', value: '#FCE7F6' },
  { name: 'Orange', value: '#FFE6D5' },
] as const;

// ── callouts ─────────────────────────────────────────────────────────────

export const CALLOUTS = [
  { tone: 'note', name: 'Note' },
  { tone: 'tip', name: 'Tip' },
  { tone: 'warning', name: 'Warning' },
  { tone: 'important', name: 'Important' },
] as const;
export type CalloutTone = (typeof CALLOUTS)[number]['tone'];
const TONES = new Set<string>(CALLOUTS.map(c => c.tone));

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Put the selected blocks in a callout box, or change the tone of the one the cursor is in. */
      setCallout: (tone: CalloutTone) => ReturnType;
      /** Take the blocks back out of the callout box. */
      unsetCallout: () => ReturnType;
    };
  }
}

/** A coloured box (Note, Tip, Warning, Important) holding any paragraphs, lists or headings. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'note',
        parseHTML: el => (TONES.has(el.getAttribute('data-callout') ?? '') ? el.getAttribute('data-callout') : 'note'),
        renderHTML: attrs => ({ 'data-callout': TONES.has(attrs.tone) ? attrs.tone : 'note' }),
      },
    };
  },
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { class: 'dc-callout' }), 0],
  addCommands() {
    return {
      setCallout: tone => ({ editor, commands }) =>
        editor.isActive('callout') ? commands.updateAttributes('callout', { tone }) : commands.wrapIn('callout', { tone }),
      unsetCallout: () => ({ commands }) => commands.lift('callout'),
    };
  },
});

// ── keeping saved pages to the palettes ──────────────────────────────────

interface Json { type?: string; attrs?: Record<string, unknown>; marks?: Json[]; content?: Json[]; [k: string]: unknown }
const TEXT_SET = new Set<string>(TEXT_COLOURS.map(c => c.value.toLowerCase()));
const HIGHLIGHT_SET = new Set<string>(HIGHLIGHTS.map(c => c.value.toLowerCase()));
const ALIGN_SET = new Set(['left', 'center', 'right', 'justify']);

/** A page as saved, with any colour, alignment or callout tone outside the palettes removed. */
export function cleanPage<T>(doc: T): T {
  const walk = (n: Json): Json => {
    const out: Json = { ...n };
    if (n.attrs) {
      const a: Record<string, unknown> = { ...n.attrs };
      if ('textAlign' in a && !(typeof a.textAlign === 'string' && ALIGN_SET.has(a.textAlign))) a.textAlign = null;
      if (n.type === 'callout' && !(typeof a.tone === 'string' && TONES.has(a.tone))) a.tone = 'note';
      out.attrs = a;
    }
    if (n.marks) {
      out.marks = n.marks.flatMap(m => {
        const colour = typeof m.attrs?.color === 'string' ? m.attrs.color.toLowerCase() : null;
        if (m.type === 'textStyle') return colour && TEXT_SET.has(colour) ? [{ type: 'textStyle', attrs: { color: m.attrs!.color } }] : [];
        if (m.type === 'highlight') return [{ type: 'highlight', attrs: { color: colour && HIGHLIGHT_SET.has(colour) ? m.attrs!.color : null } }];
        return [m];
      });
    }
    if (n.content) out.content = n.content.map(walk);
    return out;
  };
  return doc && typeof doc === 'object' ? (walk(doc as Json) as T) : doc;
}

// ── the "/" menu ─────────────────────────────────────────────────────────

export interface SlashItem { key: string; label: string; hint: string; words: string; run: (editor: Editor) => void }

export const SLASH_ITEMS: SlashItem[] = [
  { key: 'h1', label: 'Large heading', hint: 'A big section title', words: 'heading title h1', run: e => e.chain().focus().setHeading({ level: 1 }).run() },
  { key: 'h2', label: 'Heading', hint: 'A section title', words: 'heading h2', run: e => e.chain().focus().setHeading({ level: 2 }).run() },
  { key: 'h3', label: 'Small heading', hint: 'A sub-section title', words: 'heading h3 subheading', run: e => e.chain().focus().setHeading({ level: 3 }).run() },
  { key: 'bullet', label: 'Bulleted list', hint: 'Points', words: 'bullet list points ul', run: e => e.chain().focus().toggleBulletList().run() },
  { key: 'ordered', label: 'Numbered list', hint: 'Steps in order', words: 'numbered ordered list steps ol', run: e => e.chain().focus().toggleOrderedList().run() },
  { key: 'task', label: 'Checklist', hint: 'Things to tick off', words: 'checklist todo task checkbox', run: e => e.chain().focus().toggleTaskList().run() },
  ...CALLOUTS.map(c => ({
    key: `callout-${c.tone}`, label: `${c.name} box`, hint: { note: 'Blue box for context', tip: 'Green box for advice', warning: 'Amber box for a caution', important: 'Red box for must-knows' }[c.tone],
    words: `callout box ${c.tone} ${c.name.toLowerCase()} alert`, run: (e: Editor) => { e.chain().focus().setCallout(c.tone).run(); },
  })),
  { key: 'quote', label: 'Quote', hint: 'Someone\'s words', words: 'quote blockquote', run: e => e.chain().focus().toggleBlockquote().run() },
  { key: 'rule', label: 'Dividing line', hint: 'Separate sections', words: 'divider line rule hr separator', run: e => e.chain().focus().setHorizontalRule().run() },
  { key: 'table', label: 'Table', hint: '3 × 3 with a header row', words: 'table grid', run: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: 'block', label: 'Code block', hint: 'Code or commands', words: 'code block pre', run: e => e.chain().focus().toggleCodeBlock().run() },
];

export const filterSlash = (query: string): SlashItem[] => {
  const q = query.trim().toLowerCase();
  return q ? SLASH_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.words.includes(q)) : SLASH_ITEMS;
};

/** What the page editor shows for the "/" menu; it renders the list and hands keys back. */
export interface SlashView {
  open: (p: SuggestionProps<SlashItem>) => void;
  update: (p: SuggestionProps<SlashItem>) => void;
  close: () => void;
  keyDown: (p: SuggestionKeyDownProps) => boolean;
}

/** Typing "/" at the start of a line, or after a space, opens a menu of blocks to insert. */
export const SlashCommands = Extension.create<{ view: () => SlashView | null }>({
  name: 'slashCommands',
  addOptions: () => ({ view: () => null }),
  addProseMirrorPlugins() {
    const view = this.options.view;
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        // Not inside code, where "/" is ordinary text.
        allow: ({ editor }) => !editor.isActive('codeBlock') && !editor.isActive('code'),
        items: ({ query }) => filterSlash(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: () => ({
          onStart: p => view()?.open(p),
          onUpdate: p => view()?.update(p),
          onExit: () => view()?.close(),
          onKeyDown: p => view()?.keyDown(p) ?? false,
        }),
      }),
    ];
  },
});
