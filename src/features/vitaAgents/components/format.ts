import React from 'react';

/** What each route means, in plain words (keep in sync with Vita agents/train.py). */
export const ROUTES: Record<string, { label: string; group: 'answered' | 'jev' | 'unanswered' | 'failed' | 'other'; hint: string }> = {
    crew_ask: { label: 'AI answer', group: 'answered', hint: 'LLM wrote the answer from guide passages' },
    extractive: { label: 'Guide passage', group: 'answered', hint: 'Best matching passage, no LLM configured' },
    extractive_fallback: { label: 'LLM fallback', group: 'answered', hint: 'LLM failed or was ungrounded; passage shown instead' },
    cache: { label: 'Cached answer', group: 'answered', hint: 'Same question answered before' },
    'jev:greeting': { label: 'Greeting', group: 'jev', hint: 'Fast path, no AI' },
    'jev:thanks': { label: 'Thanks', group: 'jev', hint: 'Fast path, no AI' },
    'jev:clinical': { label: 'Clinical decline', group: 'jev', hint: 'Medical question declined' },
    'jev:off_topic': { label: 'Off-topic', group: 'jev', hint: 'Not about 1HMS' },
    'jev:navigate': { label: 'Navigation', group: 'jev', hint: 'Opened a screen for the user' },
    'jev:nav_denied': { label: 'Navigation denied', group: 'jev', hint: 'User lacks permission for that screen' },
    unknown: { label: 'No answer', group: 'unanswered', hint: 'Nothing relevant in the guides' },
    not_sure: { label: 'Not sure', group: 'unanswered', hint: 'Answer could not be grounded' },
    no_kb: { label: 'No knowledge base', group: 'unanswered', hint: 'No active knowledge build' },
    failed: { label: 'Failed', group: 'failed', hint: 'Timeout, agent error or lost worker' },
};

export const routeLabel = (r: string | null) => (r ? ROUTES[r]?.label ?? r : '—');

export const ERROR_HINTS: Record<string, string> = {
    timeout: 'Turn took longer than VITA_TURN_TIMEOUT_S. Check LLM latency.',
    agent_error: 'Exception inside the agent. See worker logs.',
    worker_lost: 'Worker died mid-reply. Check worker memory / restarts.',
    conversation_busy: 'Previous turn held the chat too long.',
    session_expired: 'User session ended before the turn ran (queue too slow?).',
};

export const pct = (v: number | null | undefined, digits = 0) =>
    v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;

export const ms = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '—';
    return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} s` : `${Math.round(v)} ms`;
};

export const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('en-IN'));

export const dur = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
};

export const when = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : '—');

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/** Thresholds for colouring tiles. Lower is better unless `higherIsBetter`. */
export const toneFor = (v: number | null | undefined, warn: number, bad: number, higherIsBetter = false): Tone => {
    if (v === null || v === undefined) return 'neutral';
    if (higherIsBetter) return v >= warn ? 'good' : v >= bad ? 'warn' : 'bad';
    return v <= warn ? 'good' : v <= bad ? 'warn' : 'bad';
};

/** Simple data hook: load(), keep last good data, expose error and loading. */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList) {
    const [data, setData] = React.useState<T | null>(null);
    const [error, setError] = React.useState<unknown>(null);
    const [loading, setLoading] = React.useState(true);
    const seq = React.useRef(0);
    const load = React.useCallback(() => {
        const my = ++seq.current;
        setLoading(true);
        fn()
            .then((d) => {
                if (my === seq.current) {
                    setData(d);
                    setError(null);
                }
            })
            .catch((e) => my === seq.current && setError(e))
            .finally(() => my === seq.current && setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    React.useEffect(() => {
        load();
    }, [load]);
    return { data, error, loading, reload: load };
}
