import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { Bold, Italic, List, ListOrdered, Quote, Link2, ImagePlus, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '../services/healthWikiService';
import { IMAGE_ACCEPT, ImageProblem, prepareImage } from './prepareImage';

interface Props {
  /** Initial markdown. Read once on mount; mount the editor again (key) to load a different article. */
  initialMarkdown: string;
  disabled?: boolean;
  onChange: (markdown: string, html: string) => void;
  /** Uploads a picked file and returns its public URL. */
  uploadImage: (file: File) => Promise<string>;
}

export default function TiptapEditor({ initialMarkdown, disabled, onChange, uploadImage }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  // The picture just added: where it sits in the text, and the description being typed for it (optional).
  const [added, setAdded] = useState<{ pos: number; src: string } | null>(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  // The editor's own paste and drop handling is set up before the editor exists, so it calls this.
  const addPicture = useRef<(file: File) => void>(() => undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }),
      Image,
      Markdown,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown(), e.getHTML()),
    editorProps: {
      // A picture pasted or dropped into the text is added there, like one chosen with the button.
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        addPicture.current(file);
        return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from((event as DragEvent).dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        addPicture.current(file);
        return true;
      },
      attributes: { class: 'hw-editor-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Article content' },
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Report the starting HTML so the page preview has content before the first keystroke.
  useEffect(() => {
    if (editor) onChange(editor.getMarkdown(), editor.getHTML());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
      link: e?.isActive('link') ?? false,
      block: e?.isActive('heading', { level: 2 }) ? 'h2' : e?.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  if (!editor || !s) return <div className="hw-editor-loading">Loading editor…</div>;

  const setBlock = (v: string) => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().run();
    else c.setHeading({ level: v === 'h2' ? 2 : 3 }).run();
  };

  const openLink = () => {
    setLinkUrl((editor.getAttributes('link').href as string) || '');
    setLinkError('');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else if (!/^https?:\/\//i.test(url)) {
      setLinkError('Start the address with https://');
      return;
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  // Make the picture small enough, upload it, and put it in the text at once. Describing it for screen readers can follow, or be skipped.
  const onPickImage = async (file: File | undefined) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const src = await uploadImage(await prepareImage(file));
      editor.chain().focus().setImage({ src, alt: '' }).run();
      // Where it landed (an image can take the place of an empty paragraph, so the cursor position is not it).
      let pos = -1;
      editor.state.doc.descendants((node, at) => { if (pos < 0 && node.type.name === 'image' && node.attrs.src === src) pos = at; });
      if (pos >= 0) { setAdded({ pos, src }); setAlt(''); }
    } catch (e) {
      toast.error(e instanceof ImageProblem ? e.message : errorMessage(e, 'Could not upload the picture. Try again.'));
    } finally {
      setUploading(false);
    }
  };
  addPicture.current = (file) => { void onPickImage(file); };
  const saveAlt = () => {
    if (added) {
      const node = editor.state.doc.nodeAt(added.pos);
      if (node?.type.name === 'image' && node.attrs.src === added.src) editor.view.dispatch(editor.state.tr.setNodeMarkup(added.pos, undefined, { ...node.attrs, alt: alt.trim() }));
    }
    setAdded(null);
  };

  const tb = (active: boolean) => `hw-tb${active ? ' on' : ''}`;
  const off = !!disabled;

  return (
    <div className="hw-editor">
      <div className="hw-toolbar" role="toolbar" aria-label="Formatting">
        <select aria-label="Text style" value={s.block} disabled={off} onChange={(e) => setBlock(e.target.value)}>
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="hw-sep" />
        <button type="button" className={tb(s.bold)} title="Bold (Ctrl+B)" aria-pressed={s.bold} disabled={off} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></button>
        <button type="button" className={tb(s.italic)} title="Italic (Ctrl+I)" aria-pressed={s.italic} disabled={off} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></button>
        <button type="button" className={tb(s.bullet)} title="Bullet list" aria-pressed={s.bullet} disabled={off} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></button>
        <button type="button" className={tb(s.ordered)} title="Numbered list" aria-pressed={s.ordered} disabled={off} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></button>
        <button type="button" className={tb(s.quote)} title="Quote" aria-pressed={s.quote} disabled={off} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></button>
        <button type="button" className={tb(s.link)} title="Link" aria-pressed={s.link} disabled={off} onClick={openLink}><Link2 size={15} /></button>
        <label className={`hw-tb${off || uploading ? ' disabled' : ''}`} title="Insert image">
          <ImagePlus size={15} />
          <input type="file" accept={IMAGE_ACCEPT} hidden disabled={off || uploading}
            onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <span className="hw-sep" />
        <button type="button" className="hw-tb" title="Undo" disabled={off || !s.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></button>
        <button type="button" className="hw-tb" title="Redo" disabled={off || !s.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></button>
      </div>

      {linkOpen && (
        <div className="hw-inline-box">
          <div className="hw-grow">
            <label htmlFor="hw-link-url">Link address</label>
            <input id="hw-link-url" type="text" value={linkUrl} placeholder="https://" autoFocus
              onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyLink()} />
            {linkError && <span className="hw-err">{linkError}</span>}
          </div>
          <button type="button" className="hw-btn hw-btn-primary hw-sm" onClick={applyLink}>Apply</button>
          <button type="button" className="hw-btn hw-sm" onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}

      {uploading && <div className="hw-inline-box" role="status">Getting your picture ready…</div>}
      {added && (
        <div className="hw-inline-box">
          <img src={added.src} alt="" className="hw-inline-thumb" />
          <div className="hw-grow">
            <label htmlFor="hw-img-alt">Picture added. Describe it for screen readers <span className="hw-opt">(optional)</span></label>
            <input id="hw-img-alt" type="text" value={alt} maxLength={200} placeholder="What the picture shows"
              onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveAlt()} />
          </div>
          <button type="button" className="hw-btn hw-btn-primary hw-sm" onClick={saveAlt}>{alt.trim() ? 'Save' : 'Done'}</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
