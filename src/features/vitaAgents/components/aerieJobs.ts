import React from 'react';
import type { VitaRepoOverview, VitaRunVerdict } from '../types';

/**
 * The jobs the aerie shows, shared by the 3D scene and the flat fallback.
 * One job per queued/running run (from the overview counts), plus finished ones for a few seconds so the
 * verdict can be seen. Each job gets a stable work station (`slot`) and, while one is free, an eagle; both stay
 * with the job until it leaves the board, so nobody swaps places mid-flight.
 */
export type AerieJob = {
    key: string;
    repo: string;
    phase: 'queued' | 'running' | 'done';
    verdict?: VitaRunVerdict | null;
    doneAt?: number;
    slot?: number;
    eagle?: number;
};

export type EagleMood = 'home' | 'queued' | 'running' | 'green' | 'red' | 'neutral';

export const EAGLES = 3;
export const MAX_SLOTS = 6;
export const DONE_SHOW_MS = 9000;

export const latestVerdict = (r: VitaRepoOverview): VitaRunVerdict | null => {
    const runs = Object.values(r.last_runs ?? {}).filter(Boolean) as { verdict: VitaRunVerdict | null; started_at: string }[];
    runs.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return runs[0]?.verdict ?? null;
};

export const settle = (jobs: AerieJob[], now: number, slots: number): AerieJob[] => {
    const kept = jobs
        .filter((j) => j.phase !== 'done' || now - (j.doneAt ?? 0) < DONE_SHOW_MS)
        // a station that no longer fits (narrower screen) is given up, and its eagle goes home
        .map((j) => (j.slot !== undefined && j.slot >= slots ? { ...j, slot: undefined, eagle: undefined } : j));
    const usedSlots = new Set(kept.map((j) => j.slot).filter((s): s is number => s !== undefined));
    const usedEagles = new Set(kept.map((j) => j.eagle).filter((e): e is number => e !== undefined));
    return kept.map((j) => {
        let next = j;
        if (next.slot === undefined && next.phase !== 'done') {
            const free = Array.from({ length: slots }, (_, s) => s).find((s) => !usedSlots.has(s));
            if (free !== undefined) {
                usedSlots.add(free);
                next = { ...next, slot: free };
            }
        }
        if (next.slot !== undefined && next.eagle === undefined && next.phase !== 'done') {
            const free = Array.from({ length: EAGLES }, (_, e) => e).find((e) => !usedEagles.has(e));
            if (free !== undefined) {
                usedEagles.add(free);
                next = { ...next, eagle: free };
            }
        }
        return next;
    });
};

const same = (a: AerieJob[], b: AerieJob[]) => a.length === b.length && a.every((j, i) => j === b[i]);

export const useAerieJobs = (repos: VitaRepoOverview[], slots: number) => {
    const [jobs, setJobs] = React.useState<AerieJob[]>([]);
    React.useEffect(() => {
        const t = window.setInterval(() => setJobs((prev) => {
            const next = settle(prev, Date.now(), slots);
            return same(next, prev) ? prev : next;
        }), 1000);
        return () => window.clearInterval(t);
    }, [slots]);
    React.useEffect(() => {
        setJobs((prev) => {
            const byKey = new Map(prev.map((j) => [j.key, j]));
            const active: AerieJob[] = [];
            for (const r of repos) {
                const n = (r.running ?? 0) + (r.queued ?? 0);
                for (let i = 0; i < n; i++) {
                    const key = `${r.repo}#${i}`;
                    const phase = i < (r.running ?? 0) ? 'running' : 'queued';
                    const old = byKey.get(key);
                    active.push(old && old.phase !== 'done' ? (old.phase === phase ? old : { ...old, phase }) : { key, repo: r.repo, phase });
                }
            }
            const keys = new Set(active.map((j) => j.key));
            const at = Date.now();
            // jobs that just disappeared have finished: they stay at their station with the repo's latest verdict
            const finished = prev
                .filter((j) => !keys.has(j.key) && j.phase !== 'done')
                .map((j) => {
                    const r = repos.find((x) => x.repo === j.repo);
                    return { ...j, phase: 'done' as const, doneAt: at, verdict: r ? latestVerdict(r) : null };
                });
            const stillShown = prev.filter((j) => j.phase === 'done' && !keys.has(j.key));
            const next = settle([...active, ...stillShown, ...finished], at, slots);
            return same(next, prev) ? prev : next;
        });
    }, [repos, slots]);
    return jobs;
};

export const moodOf = (j: AerieJob | undefined): EagleMood =>
    !j ? 'home' : j.phase === 'done' ? (j.verdict === 'green' ? 'green' : j.verdict === 'red' ? 'red' : 'neutral') : j.phase;

export const captionOf = (jobs: AerieJob[], connected: boolean): string => {
    if (!connected) return 'The eagles are resting on the cliff — Vita is not connected yet.';
    const withEagle = jobs.filter((j) => j.eagle !== undefined);
    const busy = withEagle.filter((j) => j.phase !== 'done').length;
    const waiting = jobs.filter((j) => j.phase !== 'done' && j.eagle === undefined).length;
    if (withEagle.length === 0 && waiting === 0) return 'All eagles are home. Run a repo to call one to work.';
    if (busy === 0 && waiting === 0) return 'Work done — the eagles are reporting back, then flying home.';
    return `${busy} eagle${busy === 1 ? '' : 's'} at work${waiting > 0 ? ` · ${waiting} more job${waiting === 1 ? '' : 's'} waiting for a free eagle` : ''}.`;
};

export const phaseText = (j: AerieJob): string =>
    j.phase === 'queued' ? 'Queued' : j.phase === 'running' ? 'Testing…' : j.verdict === 'green' ? 'Passed' : j.verdict === 'red' ? 'Failed' : 'Finished';
