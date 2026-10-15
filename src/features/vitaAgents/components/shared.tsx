import React from 'react';
import type { Tone } from './format';

export const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: Tone; title?: string }> = ({
    label,
    value,
    sub,
    tone = 'neutral',
    title,
}) => (
    <div className={`vita-tile vita-tone-${tone}`} title={title}>
        <div className="vita-tile-label">{label}</div>
        <div className="vita-tile-value">{value}</div>
        {sub && <div className="vita-tile-sub">{sub}</div>}
    </div>
);

export const Pill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
    <span className={`vita-pill vita-pill-${tone}`}>{children}</span>
);

export const Card: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
    title,
    right,
    children,
    className = '',
}) => (
    <section className={`vita-card ${className}`}>
        <header className="vita-card-head">
            <h3>{title}</h3>
            {right}
        </header>
        {children}
    </section>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="vita-empty">{children}</div>;

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="vita-error">
        <span>{message}</span>
        {onRetry && (
            <button className="vita-btn" onClick={onRetry}>
                Retry
            </button>
        )}
    </div>
);

