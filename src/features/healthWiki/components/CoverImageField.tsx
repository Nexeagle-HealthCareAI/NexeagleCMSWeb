import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { validateImageFile } from './imageRules';

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
    if (!file || disabled) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadImage(file), alt);
    } catch {
      toast.error('Could not upload the image. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hw-field">
      <span className="hw-label">Cover image</span>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
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
          <b>{busy ? 'Uploading…' : 'Add a cover image'}</b>
          Drop a file here or click to choose. JPG, PNG or WebP, up to 2 MB. 16:9 works best.
        </div>
      ) : (
        <div className="hw-cover">
          <img src={url} alt="" />
          <div className="hw-cover-meta">
            <label htmlFor="hw-cover-alt">Alt text</label>
            <input id="hw-cover-alt" type="text" value={alt} maxLength={200} disabled={disabled}
              placeholder="Describe the image for screen readers" onChange={(e) => onChange(url, e.target.value)} />
            <div className="hw-row">
              <button type="button" className="hw-btn hw-sm" disabled={disabled || busy} onClick={() => input.current?.click()}>Replace</button>
              <button type="button" className="hw-btn hw-sm" disabled={disabled} onClick={() => onChange(null, '')}>Remove</button>
            </div>
          </div>
        </div>
      )}
      <div className="hw-hint">
        <span className="hw-err">{error}</span>
        <span>Shown on the article card on Doctor Dekho.</span>
      </div>
    </div>
  );
}
