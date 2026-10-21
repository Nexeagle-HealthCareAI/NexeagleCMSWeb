import React from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '../../../store/useAuthStore';
import { VITA_HUB_URL, VITA_RUN_UPDATED } from '../services/vitaApi';
import type { Tone } from './format';
import type { VitaCaseStatus, VitaResultStatus, VitaRunEvent, VitaRunVerdict, VitaTrigger } from '../types';

/** Helpers shared by the Vita Test Agent pages (Overview, Runs, Cases). */

export const VITA_VIEW = 'vita.view';
export const VITA_MANAGE = 'vita.manage';
export const VITA_APPROVE = 'vita.approve';

export const verdictTone = (v: VitaRunVerdict | null | undefined, status?: string | null): Tone =>
    v === 'green' ? 'good' : v === 'red' ? 'bad' : v === 'neutral' ? 'warn' : status === 'running' || status === 'queued' ? 'warn' : 'neutral';

export const verdictLabel = (v: VitaRunVerdict | null | undefined, status?: string | null) =>
    v ? v.toUpperCase() : status === 'running' ? 'Running' : status === 'queued' ? 'Queued' : 'No run';

export const resultTone = (s: VitaResultStatus): Tone => (s === 'pass' ? 'good' : s === 'fail' ? 'bad' : s === 'error' ? 'warn' : 'neutral');

export const caseTone = (s: VitaCaseStatus): Tone => (s === 'active' ? 'good' : s === 'shadow' ? 'warn' : 'neutral');

export const TRIGGER_LABEL: Record<VitaTrigger, string> = {
    pr: 'PR gate',
    push: 'Push',
    nightly: 'Nightly',
    'prod-sanity': 'Prod sanity',
    manual: 'Manual',
    canary: 'Canary',
    digest: 'Weekly digest',
};

export const isRunActive = (status: string | null | undefined) => status === 'queued' || status === 'running';

/** The signed-in user's Vita permissions, read the way RequirePermission and the Sidebar do. */
export const useVitaAccess = () => {
    const permissions = useAuthStore((s) => s.permissions);
    return React.useMemo(
        () => ({
            canView: permissions.includes(VITA_VIEW),
            canManage: permissions.includes(VITA_MANAGE),
            canApprove: permissions.includes(VITA_APPROVE),
        }),
        [permissions]
    );
};

/**
 * Subscribes to /hubs/vita (VitaHub.cs) and calls onEvent for every "vita-run-updated" push. A failed connection is logged and
 * ignored: the pages also poll, so the hub only makes them faster. Same connection pattern as the CRM hub in Layout.tsx.
 */
export const useVitaHub = (onEvent: (e: VitaRunEvent) => void) => {
    // The latest callback, so one hub connection outlives re-renders (the connection effect runs once).
    const handler = React.useRef(onEvent);
    React.useEffect(() => {
        handler.current = onEvent;
    }, [onEvent]);

    React.useEffect(() => {
        const connection = new HubConnectionBuilder()
            .withUrl(VITA_HUB_URL, { accessTokenFactory: () => useAuthStore.getState().token ?? '' })
            .configureLogging(LogLevel.Warning)
            .withAutomaticReconnect()
            .build();

        connection.on(VITA_RUN_UPDATED, (e: VitaRunEvent) => handler.current(e));
        connection.start().catch((err) => console.warn('SignalR Vita connection failed (polling continues):', err));

        return () => {
            void connection.stop();
        };
    }, []);
};
