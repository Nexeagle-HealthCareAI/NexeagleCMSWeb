import axios from 'axios';
import { useAuthStore } from '../../../store/useAuthStore';

/**
 * Vita (AI agents) admin API. Vita checks the CMS login itself: it forwards this same CMS token
 * to CMSAPI /auth/me and requires the `dashboard.view` permission.
 *   dev:  https://vita-dev.nexeagle.com     prod: https://vita.nexeagle.com
 */
export const VITA_API_URL: string = import.meta.env.VITE_VITA_API_URL || 'https://vita-dev.nexeagle.com';

const vita = axios.create({ baseURL: `${VITA_API_URL}/v1/admin`, timeout: 20000 });

vita.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// CMS access tokens are short-lived. On a 401 from Vita, renew the CMS session once (HttpOnly
// refresh cookie, same as the main CMS api client) and replay the request with the new token.
let refreshing: Promise<boolean> | null = null;
vita.interceptors.response.use(undefined, async (error) => {
    const original = error.config;
    if (axios.isAxiosError(error) && error.response?.status === 401 && original && !original._vitaRetry) {
        original._vitaRetry = true;
        const ok = await (refreshing ??= useAuthStore.getState().silentRefresh().finally(() => (refreshing = null)));
        const token = useAuthStore.getState().token;
        if (ok && token) {
            original.headers.Authorization = `Bearer ${token}`;
            return vita(original);
        }
    }
    return Promise.reject(error);
});

export type Range = '1h' | '24h' | '7d' | '30d';

export interface WorkerInfo {
    id: string;
    uptimeS: number;
    lastSeenS: number;
    inflight: number;
    concurrency: number;
    processed: number;
    failed: number;
    llmModel: string | null;
    embedder: string | null;
}

export interface EvalScores {
    'hit@1'?: number;
    'hit@5'?: number;
    [k: string]: unknown;
}

export interface Health {
    status: 'ok' | 'degraded';
    checks: Record<'redis' | 'postgres', { ok: boolean; latencyMs?: number; error?: string }>;
    queue: { waiting: number | null; inProgress: number | null; oldestQueuedS?: number | null };
    workers: WorkerInfo[];
    activeSessions: number;
    knowledge: {
        buildId: string;
        sourceVersion: string;
        embedder: string;
        chunks: number;
        eval: EvalScores;
        activatedAt: string;
    } | null;
    llm: { configured: boolean; model: string | null };
    embedder: string;
    env: string;
    hmsMode: string;
    checkedAt: string;
}

export interface Kpis {
    turns: number;
    users: number;
    hospitals: number;
    conversations: number;
    done: number;
    failed: number;
    cancelled: number;
    inProgress: number;
    retried: number;
    answered: number;
    unanswered: number;
    jev: number;
    answeredRate: number | null;
    unansweredRate: number | null;
    jevRate: number | null;
    errorRate: number | null;
    cacheHitRate: number | null;
    llmAnswers: number;
    llmFallbacks: number;
    llmFallbackRate: number | null;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
    latencyAvgMs: number | null;
    latencyMaxMs: number | null;
    queueWaitP95Ms: number | null;
    tokensIn: number;
    tokensOut: number;
    thumbsUp: number;
    thumbsDown: number;
    satisfaction: number | null;
    feedbackRate: number | null;
    openGaps: number;
    openGapsInRange: number;
}

export interface SeriesPoint {
    at: string;
    turns: number;
    answered: number;
    unanswered: number;
    jev: number;
    failed: number;
    p95Ms: number | null;
}

export interface Overview {
    range: Range;
    since: string;
    bucket: 'minute' | 'hour' | 'day';
    health: Health;
    kpis: Kpis;
    series: SeriesPoint[];
    routes: { route: string; count: number; p50Ms: number | null; p95Ms: number | null; up: number; down: number }[];
    errors: { code: string; count: number; lastAt: string }[];
    docs: { docId: string; section: string; title: string; count: number; up: number; down: number }[];
    hospitals: {
        hospitalId: string;
        turns: number;
        users: number;
        answeredRate: number | null;
        unansweredRate: number | null;
        failed: number;
        lastAt: string;
    }[];
    languages: { lang: string; count: number }[];
    modes: { mode: string; count: number }[];
    topGaps: Gap[];
}

export interface Citation {
    ref?: string;
    docId: string;
    section: string;
    title?: string;
}

export interface TurnRow {
    turnId: string;
    conversationId: string;
    hospitalId: string;
    userId: string;
    status: string;
    mode: string;
    route: string | null;
    errorCode: string | null;
    attempts: number;
    createdAt: string;
    queueWaitMs: number | null;
    question: string | null;
    lang: string | null;
    screen: Record<string, string> | null;
    answerId: string | null;
    answer: string | null;
    citations: Citation[];
    model: string | null;
    latencyMs: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    rating: 'up' | 'down' | null;
    feedbackReason: string | null;
    feedbackComment: string | null;
}

export interface Gap {
    id: string;
    hospitalId?: string;
    question: string;
    reason: string;
    count: number;
    status?: string;
    lang: string | null;
    lastTurnId?: string | null;
    createdAt?: string;
    lastAskedAt: string;
}

export interface FeedbackRow {
    id: string;
    rating: 'up' | 'down';
    reason: string | null;
    comment: string | null;
    createdAt: string;
    hospitalId: string;
    turnId: string;
    conversationId: string;
    route: string | null;
    question: string | null;
    answer: string | null;
    citations: Citation[];
    latencyMs: number | null;
}

export interface KbBuild {
    id: string;
    sourceVersion: string;
    embedder: string;
    chunks: number;
    eval: EvalScores & {
        cases?: number;
        leaks?: number;
        irrelevant_rejected?: number;
        answerable_refused?: number;
    };
    status: string;
    createdAt: string;
    activatedAt: string | null;
}

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    citations: Citation[];
    latencyMs: number | null;
    route: string | null;
    status: string;
    createdAt: string;
}

export interface TurnFilters {
    range: Range;
    hospitalId?: string;
    route?: string;
    status?: string;
    rating?: 'up' | 'down' | 'none';
    q?: string;
    slowMs?: number;
    limit?: number;
    offset?: number;
}

const clean = <T extends object>(p: T) =>
    Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const vitaService = {
    overview: (range: Range, hospitalId?: string) =>
        vita.get<Overview>('/overview', { params: clean({ range, hospitalId }) }).then((r) => r.data),
    health: () => vita.get<Health>('/health').then((r) => r.data),
    turns: (f: TurnFilters) =>
        vita.get<{ total: number; items: TurnRow[] }>('/turns', { params: clean(f) }).then((r) => r.data),
    conversation: (id: string) =>
        vita.get<{ conversationId: string; messages: ConversationMessage[] }>(`/conversations/${id}`).then((r) => r.data),
    gaps: (status: 'open' | 'resolved' | 'ignored' | 'all', q?: string, hospitalId?: string) =>
        vita
            .get<{ byReason: { reason: string; questions: number; timesAsked: number }[]; items: Gap[] }>('/gaps', {
                params: clean({ status, q, hospitalId }),
            })
            .then((r) => r.data),
    setGapStatus: (id: string, status: 'open' | 'resolved' | 'ignored') =>
        vita.patch(`/gaps/${id}`, { status }).then((r) => r.data),
    feedback: (range: Range, rating?: 'up' | 'down', hospitalId?: string) =>
        vita
            .get<{ reasons: { rating: string; reason: string; count: number }[]; items: FeedbackRow[] }>('/feedback', {
                params: clean({ range, rating, hospitalId }),
            })
            .then((r) => r.data),
    kbBuilds: () =>
        vita
            .get<{ builds: KbBuild[]; activeDocs: { docId: string; chunks: number; sections: number }[] }>('/kb/builds')
            .then((r) => r.data),
};

/** Human message for a failed call (shown in the page, not just a toast). */
export const vitaError = (e: unknown): string => {
    if (axios.isAxiosError(e)) {
        const s = e.response?.status;
        if (!e.response) return `Cannot reach Vita at ${VITA_API_URL}. Check the URL, HTTPS certificate and CORS (VITA_CORS_ORIGINS).`;
        if (s === 401) return 'Vita did not accept your CMS login. Sign out and in again.';
        if (s === 403) return 'Your CMS role does not have the dashboard.view permission required by Vita.';
        if (s === 404) return 'The Vita admin API is switched off. Set VITA_CMS_API_URL on the Vita server.';
        if (s === 503) return 'Vita could not reach CMSAPI to check your login.';
        return `Vita returned an error (${s}).`;
    }
    return 'Unexpected error.';
};
