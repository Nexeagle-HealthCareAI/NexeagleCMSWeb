import axios, { type AxiosRequestConfig } from 'axios';
import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';
import type {
    VitaAddRepoRequest,
    VitaAddRepoResponse,
    VitaAuditEntry,
    VitaCase,
    VitaClassifierStatus,
    VitaCaseStatus,
    VitaControls,
    VitaControlsUpdate,
    VitaCoverage,
    VitaDigestPreview,
    VitaDigestSendResponse,
    VitaEnqueueRunRequest,
    VitaEnqueueRunResponse,
    VitaEscape,
    VitaEscapeRequest,
    VitaEscapeResponse,
    VitaGenerateRequest,
    VitaGenerateResponse,
    VitaEscapeVerifyRequest,
    VitaEscapeVerifyResponse,
    VitaGraphCounts,
    VitaLearnResponse,
    VitaLearning,
    VitaLesson,
    VitaModelVersion,
    VitaOverview,
    VitaRepo,
    VitaRepoSecrets,
    VitaResult,
    VitaRun,
    VitaRunDetail,
    VitaRunNowResponse,
    VitaSchedule,
    VitaScheduleCreate,
    VitaSchedulePatch,
    VitaSchedulePatchResponse,
    VitaSecretRotatedRequest,
    VitaSettingsRepo,
    VitaValidateResponse,
    VitaVerdictLabel,
} from '../types';

/**
 * Vita Test Agent, through the CMS API proxy (VitaController, /api/v1/vita/...). Unlike the "Vita Agents" assistant dashboard
 * (vitaService.ts, which talks to that server directly), the test agent is reached only through CMSAPI: the CMS login and the
 * vita.view / vita.manage / vita.approve permissions are checked there, and CMSAPI holds the service key.
 *
 * Every answer is { success, data } (or { success: false, message }); the screens work with `data`, unwrapped here.
 */
const enc = encodeURIComponent;
const V = API_ENDPOINTS.VITA;

// Polled routes must not be answered from the 30 s GET memo cache (utils/requestCache.ts).
const FRESH: AxiosRequestConfig = { headers: { 'Cache-Control': 'no-cache' } };

const data = <T,>(res: { data: { data: T } }): T => res.data.data;

export const vitaApi = {
    overview: async () => data<VitaOverview>(await api.get(V.OVERVIEW, FRESH)),
    repos: async () => data<VitaRepo[]>(await api.get(V.REPOS)),

    runs: async (repo: string, limit = 30) => data<VitaRun[]>(await api.get(`${V.RUNS}/${enc(repo)}`, { params: { limit }, ...FRESH })),
    run: async (repo: string, runId: string) => data<VitaRunDetail>(await api.get(`${V.RUNS}/${enc(repo)}/${enc(runId)}`, FRESH)),
    runResults: async (repo: string, runId: string, limit = 1000) =>
        data<VitaResult[]>(await api.get(`${V.RUNS}/${enc(repo)}/${enc(runId)}/results`, { params: { limit } })),
    // A human correction of the Judge (vita.approve); the CMS API fills in the actor.
    relabelResult: async (resultId: string, label: VitaVerdictLabel) =>
        data<{ ok: boolean }>(await api.post(`${V.RESULTS}/${enc(resultId)}/label`, { label })),
    enqueueRun: async (body: VitaEnqueueRunRequest) => data<VitaEnqueueRunResponse>(await api.post(V.RUNS_ENQUEUE, body)),

    cases: async (repo: string, status?: VitaCaseStatus | '', skill?: string) =>
        data<VitaCase[]>(await api.get(`${V.CASES}/${enc(repo)}`, { params: { status: status || undefined, skill: skill || undefined }, ...FRESH })),
    // The actor is the signed-in user; the CMS API fills it in from the token, the body carries only the reason.
    promoteCase: async (id: string, reason = '') => data<{ ok: boolean }>(await api.post(`${V.CASES}/${enc(id)}/promote`, { reason })),
    retireCase: async (id: string, reason = '') => data<{ ok: boolean }>(await api.post(`${V.CASES}/${enc(id)}/retire`, { reason })),

    graphCounts: async (repo: string) => data<VitaGraphCounts>(await api.get(`${V.GRAPH}/${enc(repo)}/counts`)),

    pauseGate: async (repo: string, reason = '') => data<unknown>(await api.post(`${V.GATE}/${enc(repo)}/pause`, { reason })),
    resumeGate: async (repo: string) => data<unknown>(await api.post(`${V.GATE}/${enc(repo)}/resume`, {})),

    schedules: async () => data<VitaSchedule[]>(await api.get(V.SCHEDULES, FRESH)),
    createSchedule: async (body: VitaScheduleCreate) => data<{ id: string; next_run_at: string | null }>(await api.post(V.SCHEDULES, body)),
    updateSchedule: async (id: string, body: VitaSchedulePatch) => data<VitaSchedulePatchResponse>(await api.patch(`${V.SCHEDULES}/${enc(id)}`, body)),
    runScheduleNow: async (id: string) => data<VitaRunNowResponse>(await api.post(`${V.SCHEDULES}/${enc(id)}/run-now`, {}, { timeout: 900_000 })),
    deleteSchedule: async (id: string) => data<{ ok: boolean }>(await api.delete(`${V.SCHEDULES}/${enc(id)}`)),

    // Settings tab. Adding / archiving repos and marking secrets rotated need vita.manage; PUT controls needs vita.approve and a reason.
    settingsRepos: async () => data<VitaSettingsRepo[]>(await api.get(V.SETTINGS_REPOS, FRESH)),
    // Discovery walks the repo checkout: give it longer than the default.
    addRepo: async (body: VitaAddRepoRequest) => data<VitaAddRepoResponse>(await api.post(V.REPOS, body, { timeout: 900_000 })),
    validateRepo: async (repo: string) => data<VitaValidateResponse>(await api.post(`${V.REPOS}/${enc(repo)}/validate`, {})),
    archiveRepo: async (repo: string, reason = '') => data<{ ok: boolean; schedules_disabled: string[] }>(await api.delete(`${V.REPOS}/${enc(repo)}`, { data: { reason } })),
    secrets: async (repo: string) => data<VitaRepoSecrets>(await api.get(`${V.REPOS}/${enc(repo)}/secrets`, FRESH)),
    markSecretRotated: async (repo: string, name: string, body: VitaSecretRotatedRequest = {}) =>
        data<{ ok: boolean }>(await api.post(`${V.REPOS}/${enc(repo)}/secrets/${enc(name)}/rotated`, body)),
    audit: async (repo?: string, limit = 100) => data<VitaAuditEntry[]>(await api.get(V.AUDIT, { params: { repo: repo || undefined, limit }, ...FRESH })),
    controls: async () => data<VitaControls>(await api.get(V.CONTROLS, FRESH)),
    updateControls: async (body: VitaControlsUpdate) => data<VitaControls>(await api.put(V.CONTROLS, body)),

    // Coverage + Case Generator. Generated cases are always shadow; the CMS API fills in the actor.
    coverage: async (repo: string) => data<VitaCoverage>(await api.get(`${V.COVERAGE}/${enc(repo)}`, FRESH)),
    generate: async (repo: string, body: VitaGenerateRequest = {}) =>
        data<VitaGenerateResponse>(await api.post(`${V.GENERATE}/${enc(repo)}`, body, { timeout: 90_000 })),
    escapes: async (repo: string) => data<VitaEscape[]>(await api.get(`${V.ESCAPES}/${enc(repo)}`, FRESH)),
    logEscape: async (repo: string, body: VitaEscapeRequest) =>
        data<VitaEscapeResponse>(await api.post(`${V.ESCAPES}/${enc(repo)}`, body, { timeout: 90_000 })),
    // Runs every case of the escape against the broken and the fixed build (PR stacks): minutes, not seconds.
    verifyEscape: async (repo: string, id: string, body: VitaEscapeVerifyRequest) =>
        data<VitaEscapeVerifyResponse>(await api.post(`${V.ESCAPES}/${enc(repo)}/${enc(id)}/verify`, body, { timeout: 900_000 })),

    // Learner. Approve/revert need vita.approve, "Learn now" needs vita.manage; the CMS API fills in the actor.
    learning: async (repo: string) => data<VitaLearning>(await api.get(`${V.LEARNING}/${enc(repo)}`, FRESH)),
    applyLesson: async (id: string) => data<{ ok: boolean; lesson: VitaLesson }>(await api.post(`${V.LESSONS}/${enc(id)}/apply`, {})),
    revertLesson: async (id: string) => data<{ ok: boolean; lesson: VitaLesson }>(await api.post(`${V.LESSONS}/${enc(id)}/revert`, {})),
    learnNow: async (repo: string, applyAuto = true) =>
        data<VitaLearnResponse>(await api.post(`${V.LEARN}/${enc(repo)}`, { apply_auto: applyAuto }, { timeout: 900_000 })),

    // Verdict classifier (view; promote / retire need vita.approve) and the weekly digest (vita.manage).
    classifier: async () => data<VitaClassifierStatus>(await api.get(V.CLASSIFIER, FRESH)),
    promoteClassifier: async (id: string, reason = '') =>
        data<VitaModelVersion>(await api.post(`${V.CLASSIFIER}/${enc(id)}/promote`, { reason })),
    retireClassifier: async (id: string, reason = '') =>
        data<VitaModelVersion>(await api.post(`${V.CLASSIFIER}/${enc(id)}/retire`, { reason })),
    digestPreview: async (days = 7) => data<VitaDigestPreview>(await api.get(V.DIGEST, { params: { days }, ...FRESH })),
    digestSend: async () => data<VitaDigestSendResponse>(await api.post(`${V.DIGEST}/send`, {}, { timeout: 900_000 })),
};

/** SignalR hub for run updates (VitaHub.cs): same origin as the API, outside the /api/v1 prefix, JWT with vita.view. */
export const VITA_HUB_URL = (api.defaults.baseURL ?? '').replace(/\/api\/v1\/?$/, '') + '/hubs/vita';
/** Event name shared with CMSAPI/Hubs/VitaHub.cs. Change both together. */
export const VITA_RUN_UPDATED = 'vita-run-updated';

/** Message to show for a failed call: the CMS API's own message when it sends one. */
export const vitaApiError = (e: unknown, fallback: string): string => {
    if (axios.isAxiosError(e)) {
        const message = (e.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
        if (!e.response) return 'Cannot reach the CMS API.';
        if (e.response.status === 403) return 'Your CMS role does not have the permission this needs.';
    }
    return (e as { message?: string })?.message || fallback;
};
