import React from 'react';
import type { VitaRepoOverview } from '../types';
import { EAGLES, captionOf, moodOf, phaseText, useAerieJobs, type EagleMood } from './aerieJobs';
import { HOME_POSES, POSES, poseForMood, type VitaPose } from './vitaPoses';
import './vitaMascot.css';
import './vitaAerie.css';

/**
 * The flat aerie (used when WebGL is not available or the user prefers reduced motion): Vita's eagles live in nests on the cliff (left). When a run is called (queued or running), an eagle
 * flies from its nest to that job on the work board (right), thinks while the run is queued, works while it runs,
 * shows the verdict when it finishes, then flies home. Positions are measured from the banner, so it fits any width.
 */

type Pos = { x: number; y: number };

const EAGLE = 62;                 // px
export const AERIE_FLAT_HEIGHT = 232;
const HEIGHT = AERIE_FLAT_HEIGHT;
const FLIGHT_MS = 2600;
// nests on the cliff (px from the banner's left/top): where each eagle lives
const LIFT = 36;                  // headroom above the cliff so the top eagle is never clipped
const NESTS: Pos[] = [{ x: 64, y: 34 + LIFT }, { x: 150, y: 76 + LIFT }, { x: 92, y: 120 + LIFT }];

const Eagle: React.FC<{ at: Pos; home: boolean; mood: EagleMood; label: string; homePose: VitaPose }> = ({
    at, home, mood, label, homePose,
}) => {
    const [from, setFrom] = React.useState<Pos>(at);
    const [flying, setFlying] = React.useState(false);
    const [facingLeft, setFacingLeft] = React.useState(false);
    const prev = React.useRef<Pos>(at);

    // depend on the coordinates, not the object: a re-render must not cancel the landing timer
    const { x, y } = at;
    React.useEffect(() => {
        const p = prev.current;
        if (Math.abs(p.x - x) + Math.abs(p.y - y) < 2) return;
        setFrom(p);
        setFacingLeft(x < p.x);
        setFlying(true);
        prev.current = { x, y };
        const t = window.setTimeout(() => setFlying(false), FLIGHT_MS);
        return () => window.clearTimeout(t);
    }, [x, y]);

    const style = {
        '--fx': `${from.x - EAGLE / 2}px`, '--fy': `${from.y - EAGLE}px`,
        '--tx': `${at.x - EAGLE / 2}px`, '--ty': `${at.y - EAGLE}px`,
        '--mx': `${(from.x + at.x) / 2 - EAGLE / 2}px`, '--my': `${Math.max(2, Math.min(from.y, at.y) - EAGLE - 46)}px`,
        width: EAGLE, height: EAGLE,
    } as React.CSSProperties;

    return (
        <div className={`vita-eagle ${flying ? 'vita-eagle--flying' : ''} vita-eagle--${mood} ${home ? 'vita-eagle--home' : ''}`}
            style={style} title={label} aria-label={label} role="img">
            <img src={POSES[flying ? 'flying' : home ? homePose : poseForMood(mood)]} alt="" draggable={false}
                className={facingLeft && flying ? 'vita-eagle__img vita-eagle__img--left' : 'vita-eagle__img'} />
        </div>
    );
};

const VitaAerieFlat: React.FC<{ repos: VitaRepoOverview[]; connected: boolean }> = ({ repos, connected }) => {
    const box = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(900);
    React.useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // the work board: job slots spread across the right part of the banner
    const boardLeft = Math.max(260, width * 0.3);
    const slots = Math.max(1, Math.min(6, Math.floor((width - boardLeft - 24) / 150)));
    const slotW = (width - boardLeft - 24) / slots;
    const jobs = useAerieJobs(repos, slots);
    const shown = jobs.filter((j) => j.slot !== undefined);
    const slotPos = (i: number): Pos => ({ x: boardLeft + slotW * i + slotW / 2, y: 104 + LIFT });
    const jobOf = Array.from({ length: EAGLES }, (_, e) => jobs.find((j) => j.eagle === e));
    const caption = captionOf(jobs, connected);

    return (
        <div className="vita-aerie" ref={box} style={{ height: HEIGHT }} aria-label="Vita's eagles: home on the cliff, at work on the board">
            <svg className="vita-aerie__sky" viewBox="0 0 1000 196" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="vitaSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#dbeafe" />
                        <stop offset="1" stopColor="#f8fafc" />
                    </linearGradient>
                </defs>
                <rect width="1000" height="196" fill="url(#vitaSky)" />
                <path d="M0 160 L120 110 L210 140 L330 96 L450 138 L560 104 L700 142 L820 100 L1000 150 L1000 196 L0 196 Z" fill="#e2e8f0" />
                <path d="M0 176 L160 150 L300 170 L470 146 L640 172 L820 150 L1000 168 L1000 196 L0 196 Z" fill="#cbd5e1" opacity="0.7" />
            </svg>
            <span className="vita-aerie__cloud vita-aerie__cloud--a" aria-hidden="true" />
            <span className="vita-aerie__cloud vita-aerie__cloud--b" aria-hidden="true" />

            <svg className="vita-aerie__cliff" width="250" height={HEIGHT} viewBox={`0 0 250 ${HEIGHT}`} aria-hidden="true">
                <g transform={`translate(0 ${LIFT})`}>
                <path d="M0 196 L0 18 Q22 6 46 14 L84 10 Q104 16 112 30 L120 58 L176 64 Q196 70 198 88 L186 104 L150 112 L140 136 L118 150 L112 172 L96 196 Z" fill="#475569" />
                <path d="M0 196 L0 40 Q18 30 34 38 L60 36 L72 60 L60 92 L80 110 L70 150 L54 196 Z" fill="#334155" opacity="0.75" />
                <path d="M46 14 L84 10 Q104 16 112 30 L100 26 Q80 18 60 22 Z" fill="#94a3b8" />
                <path d="M120 58 L176 64 Q196 70 198 88 L188 80 Q170 70 132 68 Z" fill="#94a3b8" />
                <path d="M74 122 L118 128 L118 150 L80 140 Z" fill="#64748b" />
                <path d="M2 18 Q10 8 22 12 L30 6 L36 14 Q44 6 50 14" stroke="#2dd4bf" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M126 62 L132 52 L138 62 M150 64 L156 54 L160 64" stroke="#2dd4bf" strokeWidth="3" fill="none" strokeLinecap="round" />
                </g>
                {NESTS.map((n, i) => (
                    <g key={i} transform={`translate(${n.x} ${n.y})`}>
                        <ellipse cx="0" cy="2" rx="26" ry="7" fill="#7c5a3a" />
                        <path d="M-24 0 Q0 -6 24 0 M-20 3 Q2 -2 22 4 M-16 -2 L18 4" stroke="#a47b52" strokeWidth="2" fill="none" />
                    </g>
                ))}
            </svg>

            <div className="vita-aerie__board" style={{ left: boardLeft - 8, right: 12 }}>
                <span className="vita-aerie__board-title">Work board</span>
                {shown.length === 0 && <span className="vita-aerie__board-empty">No jobs right now</span>}
            </div>
            {shown.map((j) => {
                const p = slotPos(j.slot ?? 0);
                return (
                    <div key={j.key} className={`vita-aerie__job vita-aerie__job--${j.phase} ${j.verdict ? `vita-aerie__job--${j.verdict}` : ''}`}
                        style={{ left: p.x - slotW / 2 + 8, width: slotW - 16, top: p.y + 8 }}>
                        <strong>{j.repo}</strong>
                        <span>{phaseText(j)}</span>
                    </div>
                );
            })}

            {Array.from({ length: EAGLES }, (_, e) => {
                const job = jobOf[e];
                const home = !job;
                const at = home ? NESTS[e] : slotPos(job.slot ?? 0);
                const mood = moodOf(job);
                const label = home ? 'Resting in the nest' : `${job.repo}: ${job.phase === 'done' ? job.verdict ?? 'finished' : job.phase}`;
                return <Eagle key={e} at={at} home={home} mood={mood} label={label} homePose={connected ? HOME_POSES[e % HOME_POSES.length] : 'sleeping'} />;
            })}

            <span className="vita-aerie__caption" aria-live="polite">{caption}</span>
        </div>
    );
};

export default VitaAerieFlat;
