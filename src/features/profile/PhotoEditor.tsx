import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { X } from 'lucide-react';
import { ImageProblem, openImage } from '../healthWiki/components/prepareImage';
import { drawFramed, framedPhoto, placement, type Framing } from './preparePhoto';

interface Props {
    file: File;
    /** Whose photo, for the heading ("Your photo", "Asha Rao's photo"). */
    title: string;
    onCancel: () => void;
    onSave: (photo: File) => Promise<void>;
}

const VIEW = 240;
type Picture = Awaited<ReturnType<typeof openImage>>;

/** Crops a chosen picture to a square: drag to move it, the slider to zoom. */
export default function PhotoEditor({ file, title, onCancel, onSave }: Props) {
    const [picture, setPicture] = useState<Picture | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [framing, setFraming] = useState<Framing>({ zoom: 1, x: 0.5, y: 0.5 });
    const [saving, setSaving] = useState(false);
    const canvas = useRef<HTMLCanvasElement>(null);
    const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

    useEffect(() => {
        let live = true;
        let opened: Picture | null = null;
        openImage(file)
            .then(p => { opened = p; if (live) setPicture(p); else p.close(); })
            .catch(e => { if (live) setError(e instanceof ImageProblem ? e.message : 'That file could not be opened as a picture. Try another one.'); });
        return () => { live = false; opened?.close(); };
    }, [file]);

    useEffect(() => {
        if (!picture || !canvas.current) return;
        try { drawFramed(canvas.current, picture.source, picture.width, picture.height, framing); }
        catch { /* the browser can't draw: saving says so */ }
    }, [picture, framing]);

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, saving]);

    // Moving the picture by d pixels on screen: x, y run over the part that sticks out of the square.
    const move = (dx: number, dy: number, from: { x: number; y: number }) => {
        if (!picture) return;
        const p = placement(picture.width, picture.height, framing, VIEW);
        const spareX = p.width - VIEW;
        const spareY = p.height - VIEW;
        setFraming(f => ({
            ...f,
            x: spareX > 0 ? Math.min(1, Math.max(0, from.x - dx / spareX)) : 0.5,
            y: spareY > 0 ? Math.min(1, Math.max(0, from.y - dy / spareY)) : 0.5,
        }));
    };

    const down = (e: PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { px: e.clientX, py: e.clientY, x: framing.x, y: framing.y };
    };
    const moved = (e: PointerEvent<HTMLCanvasElement>) => {
        const d = drag.current;
        if (d) move(e.clientX - d.px, e.clientY - d.py, d);
    };
    const key = (e: KeyboardEvent<HTMLCanvasElement>) => {
        const step = e.shiftKey ? 40 : 10;
        const by: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        const d = by[e.key];
        if (!d) return;
        e.preventDefault();
        move(d[0], d[1], framing);
    };

    const save = async () => {
        if (!picture) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(await framedPhoto(picture.source, picture.width, picture.height, framing));
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : 'The photo could not be saved. Try again.');
            setSaving(false);
        }
    };

    return (
        <div className="pf-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onCancel(); }}>
            <div className="pf-dialog pf-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="pf-photo-title">
                <header className="pf-dialog-head">
                    <h2 id="pf-photo-title">{title}</h2>
                    <button type="button" className="pf-icon-btn" onClick={onCancel} disabled={saving} aria-label="Close"><X size={18} /></button>
                </header>
                {picture ? (
                    <>
                        <p className="pf-hint">Drag the picture to place your face in the circle.</p>
                        <div className="pf-crop">
                            <canvas
                                ref={canvas} width={VIEW} height={VIEW} tabIndex={0}
                                aria-label="Photo position. Use the arrow keys to move it."
                                onPointerDown={down} onPointerMove={moved} onPointerUp={() => { drag.current = null; }}
                                onKeyDown={key}
                            />
                            <span className="pf-crop-ring" aria-hidden="true" />
                        </div>
                        <label className="pf-zoom">
                            <span>Zoom</span>
                            <input type="range" min={1} max={3} step={0.05} value={framing.zoom}
                                onChange={e => setFraming(f => ({ ...f, zoom: Number(e.target.value) }))} />
                        </label>
                    </>
                ) : !error && <p className="pf-hint">Opening the picture…</p>}
                {error && <p className="pf-error" role="alert">{error}</p>}
                <footer className="pf-dialog-foot">
                    <button type="button" className="pf-btn" onClick={onCancel} disabled={saving}>Cancel</button>
                    <button type="button" className="pf-btn pf-btn-primary" onClick={save} disabled={!picture || saving}>{saving ? 'Saving…' : 'Save photo'}</button>
                </footer>
            </div>
        </div>
    );
}
