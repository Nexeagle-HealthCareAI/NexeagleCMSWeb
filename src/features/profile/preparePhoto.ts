import { encodeCanvas, ImageProblem } from '../healthWiki/components/prepareImage';

/** Profile photos are stored square, this many pixels on each side. */
export const PHOTO_EDGE = 512;

export interface Framing { zoom: number; x: number; y: number }

/**
 * Where the picture sits in the square: at zoom 1 its shorter side fills the square, and x, y
 * (0 to 1) say which part of the longer side shows (0.5 is the middle).
 */
export function placement(width: number, height: number, framing: Framing, edge = PHOTO_EDGE) {
    const scale = (edge / Math.min(width, height)) * framing.zoom;
    const w = width * scale;
    const h = height * scale;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { left: (edge - w) * clamp(framing.x), top: (edge - h) * clamp(framing.y), width: w, height: h };
}

export function drawFramed(canvas: HTMLCanvasElement, source: CanvasImageSource, width: number, height: number, framing: Framing) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageProblem('This browser cannot get the picture ready. Try another browser.');
    const p = placement(width, height, framing, canvas.width);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, p.left, p.top, p.width, p.height);
}

/** The square photo to upload (WebP, or JPEG where the browser can't write WebP). */
export async function framedPhoto(source: CanvasImageSource, width: number, height: number, framing: Framing): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_EDGE;
    canvas.height = PHOTO_EDGE;
    drawFramed(canvas, source, width, height, framing);
    const file = await encodeCanvas(canvas, 'photo');
    if (!file) throw new ImageProblem('That picture could not be made small enough. Try another one.');
    return file;
}
