import React from 'react';
import type { VitaRepoOverview } from '../types';
import { AerieScene, type FrameInfo } from './aerieScene';
import { EAGLES, captionOf, moodOf, phaseText, useAerieJobs } from './aerieJobs';
import { POSES } from './vitaPoses';
import './vitaAerie3d.css';

/**
 * The aerie in 3D: the three.js scene (aerieScene.ts) plus crisp HTML labels that follow it — a card under each
 * work station, a thought bubble or verdict badge over each eagle, the deck title, a waiting count and a legend.
 * Loaded on demand (three.js is its own chunk); the flat aerie is used if WebGL is not available.
 */

export const AERIE_3D_HEIGHT = 300;

const LEGEND: [string, string][] = [
    ['queued', 'Queued'], ['running', 'Testing'], ['green', 'Passed'], ['red', 'Failed'],
];

const VitaAerie3D: React.FC<{ repos: VitaRepoOverview[]; connected: boolean; onFail: () => void }> = ({ repos, connected, onFail }) => {
    const box = React.useRef<HTMLDivElement>(null);
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const scene = React.useRef<AerieScene | null>(null);
    const stationEls = React.useRef<(HTMLDivElement | null)[]>([]);
    const eagleEls = React.useRef<(HTMLDivElement | null)[]>([]);
    const deckTitle = React.useRef<HTMLDivElement>(null);
    const waitingEl = React.useRef<HTMLDivElement>(null);
    const captionMain = React.useRef<HTMLSpanElement>(null);
    const captionHome = React.useRef<HTMLSpanElement>(null);
    const captionText = React.useRef('');
    const [slots, setSlots] = React.useState(3);
    const jobs = useAerieJobs(repos, slots);

    React.useEffect(() => {
        const el = box.current, cv = canvas.current;
        if (!el || !cv) return;
        const onFrame = (f: FrameInfo) => {
            f.stations.forEach((p, i) => {
                const s = stationEls.current[i];
                if (s) s.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, 0)`;
            });
            f.eagles.forEach((p, i) => {
                const s = eagleEls.current[i];
                if (!s) return;
                s.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
                s.dataset.flying = p.flying ? '1' : '0';
            });
            if (deckTitle.current) deckTitle.current.style.transform = `translate(${f.deck.left.x}px, ${f.deck.left.y}px) translate(0, -50%)`;
            // eagles still in the air with no job left: they are on their way home
            const homeward = f.eagles.some((x) => x.flying) && captionText.current.startsWith('All eagles are home');
            // React owns both texts; only their visibility is switched here
            if (captionMain.current) captionMain.current.hidden = homeward;
            if (captionHome.current) captionHome.current.hidden = !homeward;
            if (waitingEl.current) waitingEl.current.style.transform = `translate(${f.deck.right.x}px, ${f.deck.right.y}px) translate(-100%, -100%)`;
        };
        let s: AerieScene;
        try {
            s = new AerieScene(cv, POSES, onFrame, setSlots);
        } catch {
            onFail();
            return;
        }
        scene.current = s;
        const size = () => s.setSize(el.clientWidth, el.clientHeight);
        size();
        const ro = new ResizeObserver(size);
        ro.observe(el);
        // only animate while the banner is on screen and the tab is visible
        let onScreen = true;
        const sync = () => (onScreen && document.visibilityState === 'visible' ? s.start() : s.stop());
        const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
        io.observe(el);
        document.addEventListener('visibilitychange', sync);
        const lost = (e: Event) => { e.preventDefault(); onFail(); };
        cv.addEventListener('webglcontextlost', lost);
        sync();
        return () => {
            ro.disconnect();
            io.disconnect();
            document.removeEventListener('visibilitychange', sync);
            cv.removeEventListener('webglcontextlost', lost);
            s.dispose();
            scene.current = null;
        };
    }, [onFail]);

    const stations = Array.from({ length: slots }, (_, s) => jobs.find((j) => j.slot === s));
    const eagleJobs = Array.from({ length: EAGLES }, (_, e) => jobs.find((j) => j.eagle === e));

    React.useEffect(() => {
        scene.current?.setAwake(connected);
        scene.current?.update(
            eagleJobs.map((j) => ({ station: j?.slot ?? null, mood: moodOf(j) })),
            stations.map((j) => (j ? { phase: j.phase, verdict: j.verdict ?? null } : null)),
        );
    });

    const waiting = jobs.filter((j) => j.phase !== 'done' && j.eagle === undefined).length;
    const caption = captionOf(jobs, connected);
    React.useEffect(() => { captionText.current = caption; }, [caption]);

    return (
        <div className="vita-aerie3d" ref={box} style={{ height: AERIE_3D_HEIGHT }}>
            <canvas ref={canvas} className="vita-aerie3d__canvas" aria-hidden="true" />

            <div className="vita-aerie3d__deck-title" ref={deckTitle}>Work deck</div>
            <div className={`vita-aerie3d__waiting ${waiting ? '' : 'is-hidden'}`} ref={waitingEl}>
                {waiting} waiting for an eagle
            </div>

            {stations.map((j, i) => (
                <div key={i} ref={(el) => { stationEls.current[i] = el; }}
                    className={`vita-aerie3d__card ${j ? `is-${j.phase} ${j.verdict ? `is-${j.verdict}` : ''}` : 'is-free'}`}>
                    {j ? (
                        <>
                            <strong title={j.repo}>{j.repo}</strong>
                            <span className="vita-aerie3d__pill">{phaseText(j)}</span>
                        </>
                    ) : (
                        <span className="vita-aerie3d__free">Station {i + 1} · free</span>
                    )}
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

            <ul className="vita-aerie3d__legend" aria-hidden="true">
                {LEGEND.map(([k, label]) => <li key={k}><i className={`is-${k}`} />{label}</li>)}
            </ul>
            <span className="vita-aerie3d__caption" aria-live="polite">
                <span ref={captionMain}>{caption}</span>
                <span ref={captionHome} hidden>The eagles are flying home…</span>
            </span>
        </div>
    );
};

export default VitaAerie3D;
