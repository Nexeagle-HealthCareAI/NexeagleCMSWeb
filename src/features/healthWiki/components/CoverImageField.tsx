import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../services/healthWikiService';
import { IMAGE_ACCEPT, ImageProblem, prepareImage } from './prepareImage';

interface Props {
  url: string | null;
  alt: string;
  disabled?: boolean;
  error?: string;
  onChange: (url: string | null, alt: string) => void;
  uploadImage: (file: File) => Promise<string>;
}

export default function CoverImageField({ url, alt, disabled, error, onChange, uploadImage }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    try {
      // A big photo is made small first, so a phone picture just works.
      onChange(await uploadImage(await prepareImage(file)), alt);
    } catch (e) {
      // Say what went wrong: a picture that cannot be used, or the server's own message (daily limit, storage not available).
      toast.error(e instanceof ImageProblem ? e.message : errorMessage(e, 'Could not upload the picture. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  // Paste a picture (a screenshot, or one copied from another page) while the cover area is in focus.
  const onPaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); void take(file); }
  };

  return (
    <div className="hw-field" onPaste={onPaste}>
      <span className="hw-label">Cover image</span>
      <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      {!url ? (
        <div
          className={`hw-drop${over ? ' over' : ''}${disabled ? ' off' : ''}`}
          role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
          onClick={() => !disabled && input.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        >
          <b>{busy ? 'Getting your picture ready…' : 'Add a cover image'}</b>
          Drop, paste or click to choose a picture. Big photos are made smaller for you. 16:9 works best.
        </div>
      ) : (
        <div className="hw-cover">
          <img src={url} alt="" />
          <div className="hw-cover-meta">
            <label htmlFor="hw-cover-alt">Alt text <span className="hw-opt">(optional)</span></label>
            <input id="hw-cover-alt" type="text" value={alt} maxLength={200} disabled={disabled}
              placeholder="Describe the image for screen readers (helps accessibility)" onChange={(e) => onChange(url, e.target.value)} />
            <div className="hw-row">
              <button type="button" className="hw-btn hw-sm" disabled={disabled || busy} onClick={() => input.current?.click()}>Replace</button>
              <button type="button" className="hw-btn hw-sm" disabled={disabled} onClick={() => onChange(null, '')}>Remove</button>
            </div>
          </div>
        </div>
      )}
      <div className="hw-hint">
        <span className="hw-err">{error}</span>
        <span>Shown on the article page on Doctor Dekho. Without alt text the article title describes it.</span>
      </div>
    </div>
  );
}
