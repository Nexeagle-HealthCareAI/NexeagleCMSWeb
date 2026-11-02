/**
 * Vita Test Agent types. The CMS API (VitaController) passes Vita's JSON through unchanged, so the keys are Vita's own
 * snake_case names (vita/core/types.py, vita/api/app.py). Keep in sync with those files.
 */

// 'digest' is schedule-only (the weekly digest job); it is not offered as a manual run trigger
export type VitaTrigger = 'pr' | 'push' | 'nightly' | 'prod-sanity' | 'manual' | 'canary' | 'digest';
export type VitaTarget = 'pr' | 'dev' | 'prod';
export type VitaRunVerdict = 'green' | 'red' | 'neutral';
export type VitaRunStatus = 'queued' | 'running' | 'done' | 'failed';
export type VitaResultStatus = 'pass' | 'fail' | 'error' | 'skip';
export type VitaCaseStatus = 'shadow' | 'active' | 'retired';
export type VitaCaseOrigin = 'human' | 'generated' | 'seed' | 'escape' | 'mutant';
export type VitaOracleKind = 'contract' | 'property' | 'invariant' | 'metamorphic' | 'differential' | 'golden';
export type VitaVerdictLabel = 'bug' | 'flaky' | 'environment' | 'bad-test';

export const TRIGGERS: VitaTrigger[] = ['pr', 'push', 'nightly', 'prod-sanity', 'manual', 'canary'];
export const CASE_STATUSES: VitaCaseStatus[] = ['shadow', 'active', 'retired'];

/** Free-form run summary: counts written by the orchestrator (pass/fail/error/skip, cases_total, meter, graph, ...). */
export interface VitaRunSummary {
    pass?: number;
    fail?: number;
    error?: number;
    skip?: number;
    cases_total?: number;
    cases_new?: number;
    bugs?: number;
    flaky?: number;
    meter?: Record<string, unknown>;
    graph?: Record<string, number>;
    [k: string]: unknown;
}

/** One row of GET /runs/{repo} (Store.recent_runs). */
export interface VitaRun {
    id: string;
    trigger: VitaTrigger;
    target: VitaTarget | string;
    sha: string | null;
    verdict: VitaRunVerdict | null;
    status: VitaRunStatus | string | null;
    branch: string | null;
    pr_number: number | null;
    started_at: string;
    finished_at?: string | null;
    summary: VitaRunSummary;
}

/** GET /runs/{repo}/{run_id}: status + verdict + summary + the Markdown report once the run is done. */
export interface VitaRunDetail {
    run_id: string;
    repo?: string;
    status: VitaRunStatus;
    verdict: VitaRunVerdict | null;
    summary: VitaRunSummary;
    report_md: string | null;
    started_at?: string;
    finished_at?: string | null;
}

/** One row of GET /runs/{repo}/{run_id}/results (Store.results_for_run). */
export interface VitaResult {
    id: string;
    case_id: string;
    case_title?: string;
    skill: string;
    status: VitaResultStatus;
    message: string;
    fingerprint: string;
    duration_ms: number | null;
    verdict?: { label: VitaVerdictLabel; confidence: number; explanation: string } | null;
}

export interface VitaOracle {
    kind: VitaOracleKind;
    params: Record<string, unknown>;
}

/** One row of GET /cases/{repo} (TestCase.model_dump). */
export interface VitaCase {
    id: string;
    repo: string;
    skill: string;
    title: string;
    oracle: VitaOracle;
    spec: Record<string, unknown>;
    status: VitaCaseStatus;
    origin: VitaCaseOrigin;
    graph_nodes: string[];
    tags: string[];
    created_at: string;
}

/** GET /repos: one onboarded repo (has a vita.yaml). */
export interface VitaRepo {
    repo: string;
    app?: string;
    kind?: string;
    skills?: string[];
    targets?: string[];
    manifest_path?: string;
    default_target?: string;
    gate_paused?: boolean;
}

/** GET /overview: per-repo summary for the Overview cards. */
export interface VitaRepoOverview {
    repo: string;
    kind?: string;
    manifest_path?: string;
    gate_paused?: boolean;
    /** Last run per trigger: trigger -> { run_id, verdict, status, started_at }. */
    last_runs: Partial<Record<VitaTrigger, { run_id: string; verdict: VitaRunVerdict | null; status?: VitaRunStatus | string | null; started_at: string } | null>>;
    open_failures: number;
    flaky_count: number;
    cases: Partial<Record<VitaCaseStatus, number>>;
    running?: number;
    queued?: number;
}

export interface VitaOverview {
    repos: VitaRepoOverview[];
    generated_at?: string;
}

/** POST /runs/enqueue body. Either manifest_path or repo identifies the manifest; the rest mirrors RunRequest in app.py. */
export interface VitaEnqueueRunRequest {
    manifest_path?: string;
    repo?: string;
    trigger: VitaTrigger;
    target: VitaTarget;
    changed_files?: string[];
    base_url?: string | null;
    baseline_url?: string | null;
    branch?: string | null;
    sha?: string | null;
    pr_number?: number | null;
    rebuild_graph?: boolean;
}

export interface VitaEnqueueRunResponse {
    run_id: string;
    status: VitaRunStatus;
}

/** POST /schedules/{id}/run-now. status "skipped" (run_id null) when the repo's gate is paused for a pr/push schedule. */
export interface VitaRunNowResponse {
    run_id: string | null;
    status: 'queued' | 'skipped';
    repo?: string;
    reason?: string;
}

/** One row of GET /schedules (Store.schedules). Times are UTC from Vita; the cron is evaluated in IST (Asia/Kolkata). */
export interface VitaSchedule {
    id: string;
    repo: string;
    name: string;
    /** 5-field cron (minute hour day-of-month month day-of-week), IST. */
    cron: string;
    trigger: VitaTrigger;
    target: VitaTarget | string;
    enabled: boolean;
    last_run_at?: string | null;
    next_run_at?: string | null;
    created_by?: string | null;
}

/** POST /schedules body (ScheduleIn in app.py; the CMS API passes it through). */
export interface VitaScheduleCreate {
    repo: string;
    name: string;
    cron: string;
    trigger: VitaTrigger;
    target: VitaTarget;
    enabled?: boolean;
}

/** PATCH /schedules/{id} body; the CMS API adds the actor. */
export interface VitaSchedulePatch {
    enabled?: boolean;
    cron?: string;
}

export interface VitaSchedulePatchResponse {
    ok: boolean;
    id: string;
    changed: Partial<Pick<VitaSchedule, 'cron' | 'enabled'>>;
    next_run_at: string | null;
}

/** What /hubs/vita pushes ("vita-run-updated"): Vita's event payload, relayed unchanged by VitaController.Events. */
export interface VitaRunEvent {
    repo: string;
    run_id: string;
    status: VitaRunStatus;
    verdict?: VitaRunVerdict | null;
    trigger?: VitaTrigger;
    summary?: VitaRunSummary;
}

export const GRAPH_COUNT_KEYS = ['endpoint', 'handler', 'table', 'migration', 'ui_route', 'permission', 'service', 'file', 'case', 'edges'] as const;
export type VitaGraphCounts = Partial<Record<(typeof GRAPH_COUNT_KEYS)[number], number>>;

// ---- Coverage, Case Generator, escapes (vita/store/db.py coverage(), vita/api/app.py /coverage /generate /escapes) ----

export interface VitaNodeCoverage {
    covered: number;
    uncovered: number;
    total: number;
}

export interface VitaUncoveredEndpoint {
    id: string;
    method: string;
    route: string;
    auth?: string | null;
    permissions?: string[];
}

export interface VitaUncoveredTable {
    id: string;
    name: string;
    schema?: string;
}

/** GET /coverage/{repo} (Store.coverage). */
export interface VitaCoverage {
    repo: string;
    graph_built: boolean;
    /** node type (endpoint, table, handler, permission, migration, ...) -> counts. */
    nodes: Record<string, VitaNodeCoverage>;
    uncovered_endpoints: VitaUncoveredEndpoint[];
    /** Endpoints whose only cases are api-contract ones (no authz / property case yet). */
    contract_only_endpoints: { id: string; method: string; route: string }[];
    uncovered_tables: VitaUncoveredTable[];
    /** Permission keys endpoints require that no case references. */
    permissions_untested: string[];
    /** skill pack -> cases by status. */
    packs: Record<string, Partial<Record<VitaCaseStatus, number>> & { total: number }>;
    origins: Partial<Record<VitaCaseOrigin, number>>;
    cases_total: number;
}

/** POST /generate/{repo} body. The CMS API sets actor from the signed-in user. */
export interface VitaGenerateRequest {
    targets?: string[];
    max_cases?: number;
}

export interface VitaDroppedCase {
    title: string;
    reasons: string[];
}

export interface VitaGenerateResponse {
    generated: number;
    stored: number;
    /** model: System 2 proposed; fallback: deterministic templates (no model); none: nothing to do. */
    source: 'model' | 'fallback' | 'none';
    note: string;
    targets: string[];
    dropped: VitaDroppedCase[];
    cases: VitaCase[];
}

export type VitaEscapeStatus = 'open' | 'linked' | 'closed';

/** One row of GET /escapes/{repo}: a bug that reached users. */
export interface VitaEscape {
    id: string;
    repo: string;
    title: string;
    description: string;
    sha: string | null;
    reported_by: string;
    linked_case_id: string | null;
    status: VitaEscapeStatus;
    created_at: string;
    /** Set by POST /escapes/{repo}/{id}/verify: the build that shipped the bug and the one that fixed it. */
    broken_sha?: string | null;
    fixed_sha?: string | null;
}

export interface VitaEscapeRequest {
    title: string;
    description: string;
    sha?: string | null;
}

export interface VitaEscapeResponse {
    escape: VitaEscape;
    case_ids: string[];
    generated: number;
    dropped: VitaDroppedCase[];
    source: VitaGenerateResponse['source'];
    note: string;
}

// ---- Learner, escape verification, agent evals (vita/agents/learner.py, escape_loop.py, vita/evals/runner.py) ----

export type VitaLessonKind = 'quarantine' | 'promote' | 'risk' | 'judge_example';
export type VitaLessonStatus = 'pending' | 'applied' | 'reverted';

/** One VitaLessons row. payload depends on kind (case status change, risk update, relabelled verdict). */
export interface VitaLesson {
    id: string;
    repo: string;
    kind: VitaLessonKind;
    /** case id (quarantine/promote), repo (risk) or result id (judge_example). */
    subject: string;
    status: VitaLessonStatus;
    /** true: the Learner applies it on its own (shadow-only changes, risk map, human relabels); false: needs vita.approve. */
    auto_apply: boolean;
    payload: {
        case_id?: string;
        title?: string;
        skill?: string;
        from_status?: VitaCaseStatus;
        to_status?: VitaCaseStatus;
        flips?: number;
        pass_streak?: number;
        reason?: string;
        raise?: string[];
        before?: Record<string, number>;
        after?: Record<string, number>;
        result_id?: string;
        case_title?: string | null;
        message?: string;
        model_label?: VitaVerdictLabel;
        human_label?: VitaVerdictLabel;
        dismissed?: boolean;
        /** true when the Learner applied it on its own (nightly or "Learn now"), false for a person's approval. */
        auto_applied?: boolean;
        [k: string]: unknown;
    };
    /** Run ids the lesson was mined from (also written to VitaAuditLog.justified_by when applied). */
    justified_by: string[];
    created_at: string;
    applied_at: string | null;
    applied_by: string | null;
}

export interface VitaRiskEntry {
    node_id: string;
    score: number;
    updated_at: string;
}

export interface VitaEvalCheck {
    name: string;
    value: number;
    op: '>=' | '<=';
    threshold: number;
    /** false: a model-only metric measured on the deterministic fallback (shown as a baseline). */
    enforced: boolean;
    passed: boolean;
    note?: string;
}

/** Latest VitaEvalRuns row (`vita eval`). */
export interface VitaEvalRun {
    id: string;
    at: string;
    suite: string;
    /** groq | none (deterministic fallback). */
    provider: string;
    passed: boolean;
    enforced: boolean;
    metrics: Record<string, number | Record<string, unknown>>;
    checks: VitaEvalCheck[];
    prompt_version?: string;
}

/** GET /learning/{repo}. */
export interface VitaLearning {
    repo: string;
    lessons: Record<VitaLessonStatus, VitaLesson[]>;
    /** Applied lessons the Learner applied itself (payload.auto_applied). */
    auto_applied: VitaLesson[];
    counts: { pending: number; applied: number; reverted: number; pending_needs_approval: number };
    /** Top 20 graph nodes by risk (the Planner runs their cases first within the impacted tier). */
    risk_map: VitaRiskEntry[];
    eval: VitaEvalRun | null;
    judge_agreement: number | null;
    thresholds: Record<string, { op: string; value: number }>;
}

/** POST /learn/{repo}: what one mining pass found. */
export interface VitaLearnResponse {
    report: {
        repo: string;
        results_seen: number;
        runs_seen: number;
        lessons_new: { id: string; kind: VitaLessonKind; subject: string; auto_apply: boolean }[];
        flaky_with_change: { case_id: string; title: string }[];
        [k: string]: unknown;
    };
    applied: string[];
    stale: { id: string; reason: string }[];
}

export interface VitaEscapeVerifyRequest {
    broken_sha: string;
    fixed_sha: string;
}

/** POST /escapes/{repo}/{id}/verify. verified -> ACTIVE (origin escape); rejected -> retired; inconclusive -> unchanged. */
export interface VitaEscapeVerifyResponse {
    escape_id: string;
    status: VitaEscapeStatus;
    broken_sha: string;
    fixed_sha: string;
    cases: {
        case_id: string;
        title: string;
        outcome: 'verified' | 'rejected' | 'inconclusive';
        reason: string;
        broken: { status: VitaResultStatus; message: string };
        fixed: { status: VitaResultStatus; message: string };
    }[];
    kept: string[];
    retired: string[];
    inconclusive: string[];
    note?: string;
}

// ---- Settings tab (vita/api/settings_routes.py; controls from app.py) ----

export type VitaRepoStatus = 'active' | 'paused' | 'archived';

/** GET /settings/repos. */
export interface VitaSettingsRepo {
    repo: string;
    app: string;
    kind: string;
    status: VitaRepoStatus;
    gate_paused: boolean;
    archived: boolean;
    manifest_path: string;
    skills: string[];
    targets: string[];
    secrets: string[];
    budgets: { pr_minutes?: number; pr_tokens_inr?: number; nightly_minutes?: number };
    updated_at: string | null;
    schedules: number;
}

/** POST /repos body ("Add repo"); the CMS API adds the actor. */
export interface VitaAddRepoRequest {
    manifest_path: string;
    /** Repo checkout, when vita.yaml is not at the repo root (e.g. examples/<repo>.vita.yaml). */
    source_root?: string;
}

export interface VitaAddRepoResponse {
    ok: boolean;
    repo: string;
    app: string;
    kind: string;
    skills: string[];
    targets: string[];
    secrets: string[];
    manifest_path: string;
    source_root: string | null;
    /** false: the repo was onboarded before (re-added / refreshed). */
    created: boolean;
    graph: VitaGraphCounts & Record<string, number>;
    discovery_error: string | null;
}

export interface VitaValidateResponse {
    repo: string;
    manifest_path: string;
    ok: boolean;
    problems: string[];
    /** The file differs from what was onboarded (null when it cannot be loaded). */
    changed_since_onboarding: boolean | null;
}

export type VitaSecretFlag = 'never_recorded' | 'rotation_overdue' | 'expiring_soon' | 'expired' | 'not_in_env';

/** One secret NAME with its rotation metadata. Values are never stored in or returned by Vita. */
export interface VitaSecret {
    name: string;
    /** In the manifest's secrets list (false: tracked by hand, e.g. a deploy PAT). */
    declared: boolean;
    /** Set in the Vita server's own environment (repo secrets usually live in GitHub instead). */
    present: boolean;
    last_rotated_at: string | null;
    rotated_by: string | null;
    expires_at: string | null;
    note: string | null;
    age_days: number | null;
    days_to_expiry: number | null;
    flags: VitaSecretFlag[];
    /** red: rotated > 90 days ago, expired or expiring within 30 days; amber: never recorded. */
    level: 'ok' | 'amber' | 'red';
}

export interface VitaRepoSecrets {
    repo: string;
    rotate_after_days: number;
    expiry_warn_days: number;
    secrets: VitaSecret[];
}

export interface VitaSecretRotatedRequest {
    /** ISO date (yyyy-mm-dd) or datetime. */
    expires_at?: string | null;
    note?: string;
}

/** GET /audit row. */
export interface VitaAuditEntry {
    id: number;
    at: string;
    actor: string;
    action: string;
    subject: string;
    reason: string;
    detail: Record<string, unknown>;
}

/** GET /controls (app.py). */
export interface VitaControls {
    kill_switch: { on: boolean; actor?: string | null; reason?: string | null; at?: string | null };
    /** repo -> PR budget. */
    budgets: Record<string, { pr_tokens_inr: number; pr_minutes: number }>;
    models: { plan: string; judge: string; classify: string };
    monthly_inr_cap: number | null;
}

/** PUT /controls body: any subset of the sections plus a mandatory reason. The CMS API sets the actor. */
export interface VitaControlsUpdate {
    reason: string;
    kill_switch?: { on: boolean; reason?: string };
    budgets?: VitaControls['budgets'];
    models?: Partial<VitaControls['models']>;
    monthly_inr_cap?: number | null;
}
