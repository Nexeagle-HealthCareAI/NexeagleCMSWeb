import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';

// CMSAPI AgentMonitorController: decisions streamed from 1HMS-NLP-Router, the review queue the
// model learns from, and every model rebuild. Dates are India-time days.

export type AgentKind = 'route' | 'chat';

export interface NameCount { name: string; count: number }

export interface AgentDailyRow {
    date: string;
    total: number;
    answer: number;
    clarify: number;
    abstain: number;
    emergency: number;
    followUp: number;
    recommendation: number;
    avgConfidence: number | null;
    avgLatencyMs: number | null;
}

export interface AgentOverview {
    from: string;
    to: string;
    total: number;
    answered: number;
    clarified: number;
    abstained: number;
    emergencies: number;
    followUps: number;
    recommendations: number;
    reasonerUsed: number;
    degraded: number;
    avgConfidence: number | null;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    lastDecisionAt: string | null;
    byAgent: NameCount[];
    byCaller: NameCount[];
    topSpecialties: NameCount[];
    confidenceBuckets: NameCount[];
    modelVersionsInUse: NameCount[];
    daily: AgentDailyRow[];
}

export interface AgentDecisionItem {
    decisionId: string;
    occurredAt: string;
    agent: string;
    caller: string | null;
    decision: string;
    topSpecialtyId: string | null;
    topSpecialist: string | null;
    candidateIds: string | null;
    confidence: number | null;
    matchScore: number | null;
    isEmergency: boolean;
    usedReasoner: boolean;
    latencyMs: number | null;
    modelVersion: string | null;
    reviewText: string | null;
    notes: string | null;
}

export type LearningStatus = 'pending' | 'approved' | 'rejected' | 'awaiting' | 'learned';

export interface LearningItem {
    itemId: string;
    createdAt: string;
    lastSeenAt: string;
    occurrences: number;
    source: string;
    agent: string;
    queryText: string;
    predictedSpecialtyId: string | null;
    actualSpecialtyId: string | null;
    confidence: number | null;
    modelVersion: string | null;
    status: string;
    approvedSpecialtyId: string | null;
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    modelVersionLearned: string | null;
    learnedAt: string | null;
}

export interface WeekCount { weekStart: string; found: number; reviewed: number; learned: number }

export interface LearningSummary {
    pending: number;
    approved: number;
    rejected: number;
    awaitingRebuild: number;
    learned: number;
    pendingBySource: NameCount[];
    weekly: WeekCount[];
    lastScanAt: string | null;
    bookingCorrectionsFoundLastScan: number;
}

export interface ModelVersion {
    id: string;
    modelVersion: string | null;
    previousVersion: string | null;
    builtAt: string;
    triggerReason: string | null;
    promoted: boolean;
    verdict: string | null;
    trainingRows: number | null;
    cmsRows: number | null;
    learnedItems: number | null;
    validationRows: number | null;
    top1: number | null;
    top3: number | null;
    answered: number | null;
    answeredAccuracy: number | null;
    confidentlyWrong: number | null;
    abstain: number | null;
    clarify: number | null;
    emergencyFlagRate: number | null;
    prevTop1: number | null;
    prevConfidentlyWrong: number | null;
}

export interface RebuildStatus {
    state?: 'idle' | 'running' | 'done' | 'failed';
    step?: string;
    reason?: string;
    startedAt?: string;
    finishedAt?: string;
    promoted?: boolean;
    verdict?: string;
    error?: string;
}

export interface TelemetryStatus {
    enabled: boolean;
    pending?: number;
    sent?: number;
    dropped?: number;
    failedBatches?: number;
    lastError?: string | null;
    lastSentAt?: string | null;
}

export interface AgentServiceStatus {
    reachable: boolean;
    modelVersion: string | null;
    modelBuiltAt: string | null;
    trainingRows: number | null;
    reasoner: string | null;
    telemetry: TelemetryStatus | null;
    rebuild: RebuildStatus | null;
    validation: Record<string, number> | null;
    lastDecisionReceivedAt: string | null;
    error: string | null;
}

export interface Paged<T> {
    data: T[];
    pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number };
}

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

export const routerAgentsService = {
    status: async () => (await api.get<AgentServiceStatus>(API_ENDPOINTS.AGENT_MONITOR.STATUS)).data,
    overview: async (from: string, to: string, agent?: AgentKind, caller?: string) =>
        (await api.get<AgentOverview>(API_ENDPOINTS.AGENT_MONITOR.OVERVIEW, { params: clean({ from, to, agent, caller }) })).data,
    decisions: async (p: { page: number; limit: number; from: string; to: string; agent?: AgentKind; caller?: string; decision?: string }) =>
        (await api.get<Paged<AgentDecisionItem>>(API_ENDPOINTS.AGENT_MONITOR.DECISIONS, { params: clean(p) })).data,
    learningSummary: async () => (await api.get<LearningSummary>(API_ENDPOINTS.AGENT_MONITOR.LEARNING_SUMMARY)).data,
    learningItems: async (p: { page: number; limit: number; status?: LearningStatus; source?: string; search?: string }) =>
        (await api.get<Paged<LearningItem>>(API_ENDPOINTS.AGENT_MONITOR.LEARNING_ITEMS, { params: clean(p) })).data,
    review: async (itemId: string, action: 'approve' | 'reject', specialtyId?: string, note?: string) =>
        (await api.post<LearningItem>(`${API_ENDPOINTS.AGENT_MONITOR.LEARNING_ITEMS}/${itemId}/review`, { action, specialtyId, note })).data,
    scan: async () => (await api.post<{ found: number }>(API_ENDPOINTS.AGENT_MONITOR.LEARNING_SCAN, {})).data,
    models: async (limit = 50) => (await api.get<ModelVersion[]>(API_ENDPOINTS.AGENT_MONITOR.MODELS, { params: { limit } })).data,
    rebuild: async () => (await api.post<{ message: string }>(API_ENDPOINTS.AGENT_MONITOR.REBUILD, {})).data,
};

export const errorText = (e: unknown, fallback: string): string => {
    const r = (e as { response?: { status?: number; data?: unknown } })?.response;
    if (r?.status === 403) return 'You do not have permission for this.';
    const d = r?.data as { message?: string } | string | undefined;
    if (typeof d === 'string' && d) return d;
    if (d && typeof d === 'object' && d.message) return d.message;
    return fallback;
};
