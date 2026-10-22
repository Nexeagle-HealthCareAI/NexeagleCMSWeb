import React from 'react';
import mascot256 from '../assets/vita-mascot-256.webp';
import mascot96 from '../assets/vita-mascot-96.webp';
import type { VitaRunVerdict } from '../types';
import './vitaMascot.css';

/**
 * Vita, the Test Agent's mascot. One image, animated by state:
 *   idle      — standing by, gentle breathing
 *   thinking  — runs are queued / being planned: head tilt + thought bubble
 *   working   — runs are executing: quick bob, wing flutter, orbiting sparks
 *   success / alert — the last run finished green / red: a short badge
 * plus a fly-by across the board when a run starts or finishes (VitaFlyBy).
 * Respects prefers-reduced-motion (no movement, states still shown by the badge and caption).
 */
export type VitaMascotState = 'idle' | 'thinking' | 'working' | 'success' | 'alert';

const LABEL: Record<VitaMascotState, string> = {
    idle: 'Vita is standing by',
    thinking: 'Vita is thinking',
    working: 'Vita is testing',
    success: 'All green',
    alert: 'Vita found a problem',
};

export const VitaMascot: React.FC<{ state?: VitaMascotState; size?: number; title?: string; className?: string }> = ({
    state = 'idle', size = 56, title, className = '',
}) => (
    <span
        className={`vita-mascot vita-mascot--${state} ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={title ?? LABEL[state]}
        title={title ?? LABEL[state]}
    >
        <img src={size > 64 ? mascot256 : mascot96} alt="" draggable={false} className="vita-mascot__img" />
        {state === 'thinking' && (
            <span className="vita-mascot__bubble" aria-hidden="true">
                <i /><i /><i />
            </span>
        )}
        {state === 'working' && (
            <span className="vita-mascot__orbit" aria-hidden="true">
                <i /><i /><i />
            </span>
        )}
        {(state === 'success' || state === 'alert') && (
            <span className={`vita-mascot__badge vita-mascot__badge--${state}`} aria-hidden="true">
                {state === 'success' ? '✓' : '!'}
            </span>
        )}
    </span>
);

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
