import React from 'react';
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { VitaRepoOverview } from '../types';
import { AerieScene, SCENE_EAGLES, SCENE_STATIONS, type FrameInfo } from './aerieScene';
import { captionOf, moodOf, phaseText, useAerieJobs } from './aerieJobs';
import { POSES } from './vitaPoses';
import './vitaAerie3d.css';

/**
 * The Vita campus in 3D: the three.js scene (aerieScene.ts / aerieWorld.ts) plus crisp HTML that follows it — a
 * card at each busy desk, a verdict badge over each eagle, zone names, the caption, a legend and view controls
 * (drag to look around; zoom, reset and expand buttons). Loaded on demand; the flat aerie is used without WebGL.
 */

export const AERIE_3D_HEIGHT = 460;
const EXPANDED = 'min(780px, 82vh)';

const LEGEND: [string, string][] = [
    ['queued', 'Queued'], ['running', 'Testing'], ['green', 'Passed'], ['red', 'Failed'],
];

const VitaAerie3D: React.FC<{ repos: VitaRepoOverview[]; connected: boolean; onFail: () => void }> = ({ repos, connected, onFail }) => {
    const box = React.useRef<HTMLDivElement>(null);
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const scene = React.useRef<AerieScene | null>(null);
    const stationEls = React.useRef<(HTMLDivElement | null)[]>([]);
    const eagleEls = React.useRef<(HTMLDivElement | null)[]>([]);
    const zoneEls = React.useRef<(HTMLDivElement | null)[]>([]);
    const waitingEl = React.useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = React.useState(false);
    const [zones, setZones] = React.useState<string[]>([]);
    const [dragged, setDragged] = React.useState(false);
    const jobs = useAerieJobs(repos, SCENE_STATIONS, SCENE_EAGLES);

    React.useEffect(() => {
        const el = box.current, cv = canvas.current;
        if (!el || !cv) return;
        let zonesKnown = false;
        const onFrame = (f: FrameInfo) => {
            f.stations.forEach((p, i) => {
                const s = stationEls.current[i];
                if (s) s.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
            });
            f.eagles.forEach((p, i) => {
                const s = eagleEls.current[i];
                if (!s) return;
                s.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
                s.dataset.flying = p.flying ? '1' : '0';
            });
            if (!zonesKnown) {
                zonesKnown = true;
                setZones(f.zones.map((z) => z.label));
            }
            f.zones.forEach((p, i) => {
                const z = zoneEls.current[i];
                if (z) z.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
            });
            if (waitingEl.current) waitingEl.current.style.transform = `translate(${f.office.x}px, ${f.office.y}px) translate(0, 6px)`;
        };
        let s: AerieScene;
        try {
            s = new AerieScene(cv, POSES, onFrame);
        } catch {
            onFail();
            return;
        }
        scene.current = s;
        const size = () => s.setSize(el.clientWidth, el.clientHeight);
        size();
        const ro = new ResizeObserver(size);
        ro.observe(el);
        let onScreen = true;
        const sync = () => (onScreen && document.visibilityState === 'visible' ? s.start() : s.stop());
        const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
        io.observe(el);
        document.addEventListener('visibilitychange', sync);
        const lost = (e: Event) => { e.preventDefault(); onFail(); };
        cv.addEventListener('webglcontextlost', lost);
        const firstDrag = () => setDragged(true);
        cv.addEventListener('pointerdown', firstDrag, { once: true });
        sync();
        return () => {
            ro.disconnect();
            io.disconnect();
            document.removeEventListener('visibilitychange', sync);
            cv.removeEventListener('webglcontextlost', lost);
            cv.removeEventListener('pointerdown', firstDrag);
            s.dispose();
            scene.current = null;
        };
    }, [onFail]);

    const stations = Array.from({ length: SCENE_STATIONS }, (_, s) => jobs.find((j) => j.slot === s));
    const eagleJobs = Array.from({ length: SCENE_EAGLES }, (_, e) => jobs.find((j) => j.eagle === e));

    React.useEffect(() => {
        scene.current?.setAwake(connected);
        scene.current?.update(
            eagleJobs.map((j) => ({ station: j?.slot ?? null, mood: moodOf(j) })),
            stations.map((j) => (j ? { phase: j.phase, verdict: j.verdict ?? null } : null)),
        );
    });

    const waiting = jobs.filter((j) => j.phase !== 'done' && j.eagle === undefined).length;
    const busy = stations.flatMap((j, desk) => (j ? [{ j, desk }] : []));
    const caption = captionOf(jobs, connected);

    return (
        <div className={`vita-aerie3d ${expanded ? 'is-expanded' : ''}`} ref={box} style={{ height: expanded ? EXPANDED : AERIE_3D_HEIGHT }}>
            <canvas ref={canvas} className="vita-aerie3d__canvas" aria-label="Vita campus: eagles at home on the cliff, at work in the office, and at the pool, café and play area" />

            {zones.map((z, i) => (
                <div key={z} ref={(el) => { zoneEls.current[i] = el; }} className="vita-aerie3d__zone" aria-hidden="true">{z}</div>
            ))}

            <div className={`vita-aerie3d__waiting ${waiting ? '' : 'is-hidden'}`} ref={waitingEl}>
                {waiting} waiting for an eagle
            </div>

            {stations.map((j, i) => (
                <div key={i} ref={(el) => { stationEls.current[i] = el; }}
                    className={`vita-aerie3d__chip ${j ? `is-${j.phase} ${j.verdict ? `is-${j.verdict}` : ''}` : 'is-hidden'}`}
                    title={j ? `Desk ${i + 1}: ${j.repo} — ${phaseText(j)}` : undefined}>
                    {i + 1}
                </div>
            ))}

            {eagleJobs.map((j, e) => {
                const mood = moodOf(j);
                return (
                    <div key={e} ref={(el) => { eagleEls.current[e] = el; }} className={`vita-aerie3d__over is-${mood}`} aria-hidden="true">
                        {mood === 'green' && <span className="vita-aerie3d__badge is-green">✓</span>}
                        {mood === 'red' && <span className="vita-aerie3d__badge is-red">!</span>}
                        {mood === 'neutral' && <span className="vita-aerie3d__badge is-neutral">–</span>}
                    </div>
                );
            })}

            <span className="vita-aerie3d__caption" aria-live="polite">{caption}</span>

            <div className="vita-aerie3d__tools">
                <button type="button" onClick={() => scene.current?.zoomBy(0.8)} title="Zoom in" aria-label="Zoom in"><ZoomIn size={15} /></button>
                <button type="button" onClick={() => scene.current?.zoomBy(1.25)} title="Zoom out" aria-label="Zoom out"><ZoomOut size={15} /></button>
                <button type="button" onClick={() => scene.current?.resetView()} title="Reset view" aria-label="Reset view"><RotateCcw size={15} /></button>
                <button type="button" onClick={() => setExpanded((x) => !x)} title={expanded ? 'Smaller' : 'Bigger'} aria-label={expanded ? 'Make the campus smaller' : 'Make the campus bigger'}>
                    {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
            </div>

            {busy.length > 0 && (
                <div className="vita-aerie3d__board" aria-label="Job board">
                    <div className="vita-aerie3d__board-title">Job board</div>
                    <ol>
                        {busy.map(({ j, desk }) => (
                            <li key={j.key} className={`is-${j.phase} ${j.verdict ? `is-${j.verdict}` : ''}`}>
                                <span className="vita-aerie3d__desk">{desk + 1}</span>
                                <strong title={j.repo}>{j.repo}</strong>
                                <span className="vita-aerie3d__pill">{phaseText(j)}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            <ul className="vita-aerie3d__legend" aria-hidden="true">
                {LEGEND.map(([k, label]) => <li key={k}><i className={`is-${k}`} />{label}</li>)}
            </ul>
            <span className={`vita-aerie3d__hint ${dragged ? 'is-hidden' : ''}`} aria-hidden="true">Drag to look around</span>
        </div>
    );
};

export default VitaAerie3D;
