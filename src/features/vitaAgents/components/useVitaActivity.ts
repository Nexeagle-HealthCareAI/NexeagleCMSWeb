import React from 'react';
import { vitaApi } from '../services/vitaApi';
import type { VitaOverview, VitaRepoOverview, VitaRunEvent, VitaRunVerdict } from '../types';
import { useVitaHub } from './testAgent';
import type { FlyBy, VitaMascotState } from './VitaMascot';

/**
 * The mascot's state from Vita's activity: overview counts (polled) plus live hub events.
 * Returns the state, a caption, and a fly-by to show when a run starts or finishes.
 */
export const useVitaActivity = (pollMs = 10000) => {
    const [running, setRunning] = React.useState(0);
    const [queued, setQueued] = React.useState(0);
    const [last, setLast] = React.useState<{ verdict: VitaRunVerdict | null; at: number } | null>(null);
    const [flight, setFlight] = React.useState<FlyBy | null>(null);
    const [repos, setRepos] = React.useState<VitaRepoOverview[]>([]);
    const [connected, setConnected] = React.useState<boolean | null>(null);   // null until the first poll answers
    const [now, setNow] = React.useState(() => Date.now());   // advances on each poll so a finished run's badge expires
    const seen = React.useRef<Set<string>>(new Set());

    const refresh = React.useCallback(async () => {
        try {
            const ov: VitaOverview = await vitaApi.overview();
            setRepos(ov.repos);
            setConnected(true);
            setRunning(ov.repos.reduce((n, r) => n + (r.running ?? 0), 0));
            setQueued(ov.repos.reduce((n, r) => n + (r.queued ?? 0), 0));
        } catch {
            setConnected(false);   /* Vita not connected: the mascot stays idle */
        }
    }, []);

    React.useEffect(() => {
        void refresh();
        const t = window.setInterval(() => {
            void refresh();
            setNow(Date.now());
        }, pollMs);
        return () => window.clearInterval(t);
    }, [refresh, pollMs]);

    useVitaHub(
        React.useCallback(
            (e: VitaRunEvent) => {
                const k = `${e.run_id}:${e.status}`;
                if (seen.current.has(k)) return;
                seen.current.add(k);
                if (e.status === 'running') {
                    setFlight({ key: Date.now(), caption: `Testing ${e.repo}…` });
                } else if (e.status === 'done' || e.status === 'failed') {
                    const verdict = e.status === 'failed' ? 'red' : (e.verdict ?? null);
                    const at = Date.now();
                    setLast({ verdict, at });
                    setNow(at);
                    const word = verdict === 'green' ? 'green' : verdict === 'red' ? 'red' : 'neutral';
                    setFlight({ key: Date.now(), verdict, caption: `${e.repo}: ${word}` });
                }
                void refresh();
            },
            [refresh],
        ),
    );

    // a finished run's badge shows for a minute, then Vita goes back to idle
    const recent = last && now - last.at < 60000 ? last : null;
    const state: VitaMascotState = connected === false ? 'sleeping'
        : running > 0 ? 'working'
        : queued > 0 ? 'thinking'
            : recent?.verdict === 'green' ? 'success'
                : recent?.verdict === 'red' ? 'alert' : 'idle';
    const caption = connected === false ? 'Vita is offline — the eagles are asleep'
        : running > 0 ? `Testing — ${running} run${running === 1 ? '' : 's'} in progress`
        : queued > 0 ? `Planning — ${queued} run${queued === 1 ? '' : 's'} queued`
            : recent ? `Last run ${recent.verdict ?? 'finished'}` : 'Standing by';

    return { state, caption, flight, clearFlight: () => setFlight(null), repos, connected: connected !== false };
};
