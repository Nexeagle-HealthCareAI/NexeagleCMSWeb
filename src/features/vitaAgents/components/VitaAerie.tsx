import React from 'react';
import mascot96 from '../assets/vita-mascot-96.webp';
import type { VitaRepoOverview, VitaRunVerdict } from '../types';
import './vitaMascot.css';
import './vitaAerie.css';

/**
 * The aerie: Vita's eagles live in nests on the cliff (left). When a run is called (queued or running), an eagle
 * flies from its nest to that job on the work board (right), thinks while the run is queued, works while it runs,
 * shows the verdict when it finishes, then flies home. Positions are measured from the banner, so it fits any width.
 */

type Job = { key: string; repo: string; phase: 'queued' | 'running' | 'done'; verdict?: VitaRunVerdict | null; doneAt?: number; eagle?: number };
type Pos = { x: number; y: number };

const EAGLES = 3;
const EAGLE = 54;                 // px
const HEIGHT = 232;               // banner height, px
const DONE_SHOW_MS = 9000;        // a finished job's verdict stays on the board this long
const FLIGHT_MS = 2600;
// nests on the cliff (px from the banner's left/top): where each eagle lives
const LIFT = 36;                  // headroom above the cliff so the top eagle is never clipped
const NESTS: Pos[] = [{ x: 64, y: 34 + LIFT }, { x: 150, y: 76 + LIFT }, { x: 92, y: 120 + LIFT }];

const latestVerdict = (r: VitaRepoOverview): VitaRunVerdict | null => {
    const runs = Object.values(r.last_runs ?? {}).filter(Boolean) as { verdict: VitaRunVerdict | null; started_at: string }[];
    runs.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return runs[0]?.verdict ?? null;
};

/** Drop finished jobs whose verdict has been shown long enough, then give free eagles to jobs without one. An eagle
 * keeps its job until the job leaves the board, so nobody swaps mid-flight. */
const settle = (jobs: Job[], now: number): Job[] => {
    const kept = jobs.filter((j) => j.phase !== 'done' || now - (j.doneAt ?? 0) < DONE_SHOW_MS);
    const busy = new Set(kept.map((j) => j.eagle).filter((e): e is number => e !== undefined));
    return kept.map((j) => {
        if (j.eagle !== undefined || j.phase === 'done') return j;
        const free = Array.from({ length: EAGLES }, (_, e) => e).find((e) => !busy.has(e));
        if (free === undefined) return j;
        busy.add(free);
        return { ...j, eagle: free };
    });
};

/** Jobs from the overview counts: one entry per queued/running run, keyed by repo + slot, plus recently finished ones. */
const useJobs = (repos: VitaRepoOverview[]) => {
    const [jobs, setJobs] = React.useState<Job[]>([]);
    React.useEffect(() => {
        const t = window.setInterval(() => setJobs((prev) => {
            const next = settle(prev, Date.now());
            return next.length === prev.length && next.every((j, i) => j === prev[i]) ? prev : next;
        }), 1000);
        return () => window.clearInterval(t);
    }, []);
    React.useEffect(() => {
        setJobs((prev) => {
            const byKey = new Map(prev.map((j) => [j.key, j]));
            const active: Job[] = [];
            for (const r of repos) {
                const n = (r.running ?? 0) + (r.queued ?? 0);
                for (let i = 0; i < n; i++) {
                    const key = `${r.repo}#${i}`;
                    const phase = i < (r.running ?? 0) ? 'running' : 'queued';
                    const old = byKey.get(key);
                    active.push(old && old.phase !== 'done' ? { ...old, phase } : { key, repo: r.repo, phase });
                }
            }
            const keys = new Set(active.map((j) => j.key));
            const at = Date.now();
            // jobs that just disappeared finished: keep them on the board (with their eagle) and the repo's latest verdict
            const finished = prev
                .filter((j) => !keys.has(j.key) && j.phase !== 'done')
                .map((j) => {
                    const r = repos.find((x) => x.repo === j.repo);
                    return { ...j, phase: 'done' as const, doneAt: at, verdict: r ? latestVerdict(r) : null };
                });
            const stillShown = prev.filter((j) => j.phase === 'done' && !keys.has(j.key));
            return settle([...active, ...stillShown, ...finished], at);
        });
    }, [repos]);
    return jobs;
};

const Eagle: React.FC<{ at: Pos; home: boolean; mood: 'home' | 'queued' | 'running' | 'green' | 'red' | 'neutral'; label: string }> = ({
    at, home, mood, label,
}) => {
    const [from, setFrom] = React.useState<Pos>(at);
    const [flying, setFlying] = React.useState(false);
    const [facingLeft, setFacingLeft] = React.useState(false);
    const prev = React.useRef<Pos>(at);

    React.useEffect(() => {
        const p = prev.current;
        if (Math.abs(p.x - at.x) + Math.abs(p.y - at.y) < 2) return;
        setFrom(p);
        setFacingLeft(at.x < p.x);
        setFlying(true);
        prev.current = at;
        const t = window.setTimeout(() => setFlying(false), FLIGHT_MS);
        return () => window.clearTimeout(t);
    }, [at]);

    const style = {
        '--fx': `${from.x - EAGLE / 2}px`, '--fy': `${from.y - EAGLE}px`,
        '--tx': `${at.x - EAGLE / 2}px`, '--ty': `${at.y - EAGLE}px`,
        '--mx': `${(from.x + at.x) / 2 - EAGLE / 2}px`, '--my': `${Math.max(2, Math.min(from.y, at.y) - EAGLE - 46)}px`,
        width: EAGLE, height: EAGLE,
    } as React.CSSProperties;

    return (
        <div className={`vita-eagle ${flying ? 'vita-eagle--flying' : ''} vita-eagle--${mood} ${home ? 'vita-eagle--home' : ''}`}
            style={style} title={label} aria-label={label} role="img">
            <img src={mascot96} alt="" draggable={false} className={facingLeft && flying ? 'vita-eagle__img vita-eagle__img--left' : 'vita-eagle__img'} />
            {!flying && mood === 'queued' && <span className="vita-eagle__bubble" aria-hidden="true"><i /><i /><i /></span>}
            {!flying && mood === 'running' && <span className="vita-eagle__orbit" aria-hidden="true"><i /><i /><i /></span>}
            {!flying && (mood === 'green' || mood === 'red') && (
                <span className={`vita-eagle__badge vita-eagle__badge--${mood}`} aria-hidden="true">{mood === 'green' ? '✓' : '!'}</span>
            )}
        </div>
    );
};

const VitaAerie: React.FC<{ repos: VitaRepoOverview[]; connected: boolean }> = ({ repos, connected }) => {
    const box = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(900);
    React.useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const jobs = useJobs(repos);
    // the work board: job slots spread across the right part of the banner
    const boardLeft = Math.max(260, width * 0.3);
    const slots = Math.max(1, Math.min(6, Math.floor((width - boardLeft - 24) / 150)));
    const slotW = (width - boardLeft - 24) / slots;
    const shown = jobs.slice(0, slots);
    const slotPos = (i: number): Pos => ({ x: boardLeft + slotW * i + slotW / 2, y: 104 + LIFT });

    const slotOf = new Map(shown.map((j, i) => [j.key, i]));
    const jobOf: (Job | undefined)[] = Array.from({ length: EAGLES }, (_, e) => shown.find((j) => j.eagle === e));
    const away = jobOf.filter(Boolean).length;
    const busy = jobOf.filter((j) => j && j.phase !== 'done').length;
    const waiting = jobs.filter((j) => j.phase !== 'done').length - busy;
    const caption = !connected ? 'The eagles are resting on the cliff — Vita is not connected yet.'
        : away === 0 ? 'All eagles are home. Run a repo to call one to work.'
            : busy === 0 ? 'Work done — the eagles are reporting back, then flying home.'
                : `${busy} eagle${busy === 1 ? '' : 's'} at work${waiting > 0 ? ` · ${waiting} more job${waiting === 1 ? '' : 's'} waiting` : ''}.`;

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
            {shown.map((j, i) => {
                const p = slotPos(i);
                return (
                    <div key={j.key} className={`vita-aerie__job vita-aerie__job--${j.phase} ${j.verdict ? `vita-aerie__job--${j.verdict}` : ''}`}
                        style={{ left: p.x - slotW / 2 + 8, width: slotW - 16, top: p.y + 8 }}>
                        <strong>{j.repo}</strong>
                        <span>{j.phase === 'queued' ? 'queued' : j.phase === 'running' ? 'testing…' : (j.verdict ?? 'finished')}</span>
                    </div>
                );
            })}

            {Array.from({ length: EAGLES }, (_, e) => {
                const job = jobOf[e];
                const home = !job;
                const at = home ? NESTS[e] : slotPos(slotOf.get(job.key) ?? 0);
                const mood = home ? 'home' : job.phase === 'done' ? (job.verdict === 'green' ? 'green' : job.verdict === 'red' ? 'red' : 'neutral') : job.phase;
                const label = home ? 'Resting in the nest' : `${job.repo}: ${job.phase === 'done' ? job.verdict ?? 'finished' : job.phase}`;
                return <Eagle key={e} at={at} home={home} mood={mood} label={label} />;
            })}

            <span className="vita-aerie__caption" aria-live="polite">{caption}</span>
        </div>
    );
};

export default VitaAerie;
