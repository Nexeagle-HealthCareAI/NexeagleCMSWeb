import React from 'react';
import mascot96 from '../assets/vita-mascot-96.webp';
import type { VitaRunVerdict } from '../types';
import { POSES, type VitaPose } from './vitaPoses';
import './vitaMascot.css';

/**
 * Vita, the Test Agent's mascot, in the pose that matches what Vita is doing (the brand artwork, see vitaPoses):
 *   idle      — relaxed (a welcome wave for the first moments after the page opens)
 *   thinking  — runs are queued / being planned
 *   working   — runs are executing
 *   success / alert — the last run passed (joyful) / failed (angry)
 *   sleeping  — Vita is not connected
 * A gentle CSS motion per state; prefers-reduced-motion turns the motion off, the pose still tells the state.
 */
export type VitaMascotState = 'idle' | 'thinking' | 'working' | 'success' | 'alert' | 'sleeping';

const LABEL: Record<VitaMascotState, string> = {
    idle: 'Vita is standing by',
    thinking: 'Vita is thinking',
    working: 'Vita is testing',
    success: 'All green',
    alert: 'Vita found a problem',
    sleeping: 'Vita is offline',
};

const POSE: Record<VitaMascotState, VitaPose> = {
    idle: 'relaxed', thinking: 'thinking', working: 'working', success: 'joyful', alert: 'angry', sleeping: 'sleeping',
};

export const VitaMascot: React.FC<{ state?: VitaMascotState; size?: number; title?: string; className?: string }> = ({
    state = 'idle', size = 56, title, className = '',
}) => {
    const [greeting, setGreeting] = React.useState(true);
    React.useEffect(() => {
        const t = window.setTimeout(() => setGreeting(false), 3200);
        return () => window.clearTimeout(t);
    }, []);
    const pose: VitaPose = state === 'idle' && greeting ? 'welcome' : POSE[state];
    return (
        <span
            className={`vita-mascot vita-mascot--${state} vita-mascot--pose-${pose} ${className}`}
            style={{ width: size, height: size }}
            role="img"
            aria-label={title ?? LABEL[state]}
            title={title ?? LABEL[state]}
        >
            <img key={pose} src={POSES[pose]} alt="" draggable={false} className="vita-mascot__img" />
        </span>
    );
};

/** Small sidebar icon: the mascot's head-and-shoulders, no animation. */
export const VitaMascotIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
    <img src={mascot96} alt="" width={size} height={size} className="vita-mascot-icon" draggable={false} />
);

export type FlyBy = { key: number; verdict?: VitaRunVerdict | null; caption: string };

/** A one-off flight across the board, from left to right along an arc, with a caption. */
export const VitaFlyBy: React.FC<{ flight: FlyBy | null; onDone: () => void }> = ({ flight, onDone }) => {
    if (!flight) return null;
    const mood = flight.verdict === 'red' ? 'alert' : flight.verdict === 'green' ? 'success' : 'working';
    return (
        <div key={flight.key} className="vita-flyby" aria-live="polite"
            onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDone(); }}>
            <div className="vita-flyby__bird">
                <VitaMascot state={mood} size={88} title={flight.caption} />
                <span className="vita-flyby__caption">{flight.caption}</span>
            </div>
        </div>
    );
};
