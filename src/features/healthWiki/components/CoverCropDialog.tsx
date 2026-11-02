import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, ChevronsUpDown, ZoomIn, ZoomOut } from 'lucide-react';
import { ImageProblem, openImage } from './prepareImage';
import { MAX_ZOOM, MIN_ZOOM, alignCrop, clampCrop, coverScale, initialCrop, paintCrop, renderCover, zoomCrop, type Crop, type Size } from './coverCrop';

// The crop window, in its own units. The canvas is drawn at this size and shown smaller on a narrow screen.
const FRAME: Size = { width: 960, height: 540 };

interface Props {
  file: File;
  /** The cropped cover, ready to upload. */
  onApply: (cover: File) => void;
  /** Use the whole picture, made small but not cropped. */
  onSkip: () => void;
  onCancel: () => void;
  /** The picture could not be opened. */
  onError: (message: string) => void;
}

/** Choose which part of a picture is the 16:9 cover: drag it, zoom, or put it against a side. What the window shows is what is saved. */
export default function CoverCropDialog({ file, onApply, onSkip, onCancel, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [picture, setPicture] = useState<{ source: CanvasImageSource; size: Size } | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Open the picture once.
  useEffect(() => {
    let alive = true;
    let opened: { close: () => void } | null = null;
    openImage(file)
      .then((p) => {
        opened = p;
        if (!alive) return p.close();
        const size = { width: p.width, height: p.height };
        setPicture({ source: p.source, size });
        setCrop(initialCrop(size, FRAME));
      })
      .catch((e: unknown) => alive && onError(e instanceof ImageProblem ? e.message : 'That file could not be opened as a picture. Try another one.'));
    return () => { alive = false; opened?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Draw what the window shows.
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx && picture) paintCrop(ctx, picture.source, crop, picture.size, FRAME, FRAME);
  }, [picture, crop]);

  const size = picture?.size;
  const zoomTo = (zoom: number, anchor = { x: FRAME.width / 2, y: FRAME.height / 2 }) => size && setCrop((c) => zoomCrop(c, zoom, anchor, size, FRAME));

  // Scrolling zooms where the pointer is. It has to be a real listener: a React wheel handler cannot stop the page from scrolling.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !size) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const anchor = { x: ((e.clientX - r.left) / r.width) * FRAME.width, y: ((e.clientY - r.top) / r.height) * FRAME.height };
      setCrop((c) => zoomCrop(c, c.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), anchor, size, FRAME));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [size]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCancel]);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const k = FRAME.width / e.currentTarget.getBoundingClientRect().width;
    const dx = (e.clientX - drag.current.x) * k;
    const dy = (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => (size ? clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, size, FRAME) : c));
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    if (!size) return;
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); setCrop((c) => clampCrop({ ...c, x: c.x + moves[e.key][0], y: c.y + moves[e.key][1] }, size, FRAME)); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(crop.zoom * 1.1); }
    else if (e.key === '-') { e.preventDefault(); zoomTo(crop.zoom / 1.1); }
  };

  const align = (axis: 'x' | 'y', where: 'start' | 'center' | 'end') => size && setCrop((c) => alignCrop(c, axis, where, size, FRAME));
  // Whether the picture is larger than the window along a direction. If not, there is nothing to align.
  const shown = size ? { width: size.width * coverScale(size, FRAME) * crop.zoom, height: size.height * coverScale(size, FRAME) * crop.zoom } : FRAME;
  const slackX = shown.width - FRAME.width > 0.5;
  const slackY = shown.height - FRAME.height > 0.5;

  const apply = async () => {
    if (!picture) return;
    setBusy(true);
    try {
      onApply(await renderCover(picture.source, crop, picture.size, FRAME, file.name));
    } catch (e) {
      onError(e instanceof ImageProblem ? e.message : 'The picture could not be cropped. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hw-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="hw-modal-box hw-crop" role="dialog" aria-modal="true" aria-labelledby="hw-crop-title">
        <h2 id="hw-crop-title">Crop and position your cover</h2>
        <p className="hw-crop-note">The cover is shown wide (16:9). Drag the picture to choose what shows, and zoom to get closer.</p>

        <div className="hw-crop-frame">
          {!picture && <span role="status">Opening your picture…</span>}
          <canvas
            ref={canvas} width={FRAME.width} height={FRAME.height} tabIndex={0} role="img" hidden={!picture}
            aria-label="Cover preview. Use the arrow keys to move the picture, plus and minus to zoom."
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
          />
        </div>

        <div className="hw-crop-row">
          <button type="button" className="hw-btn hw-sm" aria-label="Zoom out" disabled={!picture} onClick={() => zoomTo(crop.zoom / 1.2)}><ZoomOut size={14} /></button>
          <input
            className="hw-crop-zoom" type="range" aria-label="Zoom" min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} step={5}
            value={Math.round(crop.zoom * 100)} disabled={!picture} onChange={(e) => zoomTo(Number(e.target.value) / 100)}
          />
          <button type="button" className="hw-btn hw-sm" aria-label="Zoom in" disabled={!picture} onClick={() => zoomTo(crop.zoom * 1.2)}><ZoomIn size={14} /></button>
        </div>

        <div role="group" aria-label="Align the picture">
          <div className="hw-crop-row">
            <span className="hw-crop-label">Across</span>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackX} onClick={() => align('x', 'start')}><AlignLeft size={14} /> Left</button>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackX} onClick={() => align('x', 'center')}><AlignCenter size={14} /> Centre</button>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackX} onClick={() => align('x', 'end')}><AlignRight size={14} /> Right</button>
          </div>
          <div className="hw-crop-row" style={{ marginTop: 6 }}>
            <span className="hw-crop-label">Up / down</span>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackY} onClick={() => align('y', 'start')}><ArrowUpToLine size={14} /> Top</button>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackY} onClick={() => align('y', 'center')}><ChevronsUpDown size={14} /> Middle</button>
            <button type="button" className="hw-btn hw-sm" disabled={!picture || !slackY} onClick={() => align('y', 'end')}><ArrowDownToLine size={14} /> Bottom</button>
          </div>
        </div>

        <div className="hw-crop-foot">
          <button type="button" className="hw-linkbtn" disabled={!picture || busy} onClick={onSkip}>Use the whole picture, no crop</button>
          <div className="hw-modal-actions">
            <button type="button" className="hw-btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className="hw-btn hw-btn-primary" onClick={() => void apply()} disabled={!picture || busy}>{busy ? 'Getting it ready…' : 'Use this crop'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
