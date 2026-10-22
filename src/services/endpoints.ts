export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REFRESH: '/auth/refresh',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
        CHANGE_PASSWORD: '/auth/change-password',
        REQUEST_OTP: '/auth/request-otp',
        LOGIN_OTP: '/auth/login-otp',
        FORGOT_PASSWORD: '/auth/forgot-password',
        RESET_PASSWORD: '/auth/reset-password',
    },
    ADMIN: {
        USERS: '/users',
        ASSIGNEES: '/users/assignees',   // GET id + name of active users (marketing.view)                 // GET list, POST create; /users/:id GET/PUT; /users/:id/reset-password
        ROLES: '/roles',                 // GET list, POST create; /roles/:id PUT/DELETE
        PERMISSIONS: '/permissions',     // GET catalog
    },
    HOSPITALS: {
        GET_ALL: '/hospitals',
        GET_BY_ID: '/hospitals', // Usage: /hospitals/:id
        APPOINTMENT_STATS: '/hospitals', // Usage: /hospitals/:id/appointment-stats?from=&to= (GET)
        ARCHIVE: '/hospitals', // Usage: /hospitals/:id/archive (PATCH)
        RESTORE: '/hospitals', // Usage: /hospitals/:id/restore (PATCH)
    },
    DATA_MIGRATION: {
        BATCHES: '/data-migration/batches',
        // Usage: /data-migration/batches/:id (GET)
        //        /data-migration/batches/:id/column-mapping (PUT)
        //        /data-migration/batches/:id/transform (POST)
        //        /data-migration/batches/:id/rows?page=&limit=&status= (GET)
        //        /data-migration/batches/:id/doctor-map (PUT)
    },
    DOCTORS: {
        GET_ALL: '/doctors',
        GET_DETAIL: '/doctors', // Usage: /doctors/:doctorId (GET)
        UPDATE_MARKETING: '/doctors', // Usage: /doctors/:doctorId/marketing (PUT)
        BULK_UPDATE_MARKETING: '/doctors/bulk/marketing', // PUT
    },
    DASHBOARD: {
        STATS: '/dashboard/stats',
    },
    HOSPITAL_OPERATIONS: {
        SUMMARY: '/hospital-operations/summary', // ?fromDate=&toDate=
    },
    FREE_TIER_SETTINGS: {
        GLOBAL: '/free-tier-settings/global',           // GET | PUT
        HOSPITALS: '/free-tier-settings/hospitals',      // GET | PUT /:hospitalId
    },
    RAD_HOSPITALS: {
        LIST: '/rad-hospitals',                          // GET
    },
    NIGHT_JOBS: {
        LIST: '/night-jobs',                             // GET
        SET_ACTIVE: '/night-jobs',                        // PUT /:jobName/active
        RUNS: '/night-jobs/runs',                          // GET ?take=
        RUN_NOW: '/night-jobs',                            // POST /:jobName/run-now
    },
    SUBSCRIPTIONS: {
        GET_ALL_REQUESTS: '/subscriptions/admin/payment-requests',
        APPROVE: '/subscriptions/approve-payment', // Usage: /subscriptions/approve-payment/:id
    },
    PLANS: {
        LIST: '/SubscriptionPlans',                   // ?application=EasyHMS|1Rad|All
    },
    INSIGHTS: {
        SITE_VISITS: '/insights/site-visits',         // ?from=&to=&site=
        PATIENT_LOGINS: '/insights/patient-logins',   // ?page=&limit=&search=&sortBy=&sortDir=
        APPOINTMENTS: '/insights/appointments',       // ?page=&limit=&from=&to=&search=&sortBy=&sortDir=&source=
        AUTH_FUNNEL: '/insights/auth-funnel',                     // ?from=&to=
        AUTH_FUNNEL_ATTEMPTS: '/insights/auth-funnel/attempts',   // ?page=&limit=&from=&to=&search=
        BOOKING_FUNNEL: '/insights/booking-funnel',               // ?from=&to=
        SEARCHES: '/insights/searches',                           // ?page=&limit=&from=&to=&search=&sortBy=&sortDir=
    },
    MARKETING: {
        DEMO_LOGINS: '/marketing/demo-logins',              // ?page=&limit=
        DEMO_LOGINS_STATS: '/marketing/demo-logins/stats',
        LEADS: '/marketing/leads',                          // GET ?stage=&priority=&assignedToUserId=&search=&page=&limit= | POST
        LEAD_DETAIL: '/marketing/leads',                    // Usage: /marketing/leads/:id  (GET | PUT | DELETE)
        LEAD_FOLLOWUPS: '/marketing/leads',                 // Usage: /marketing/leads/:id/followups (POST)
    },
    AGENT_MONITOR: {
        STATUS: '/agent-monitor/status',
        OVERVIEW: '/agent-monitor/overview',                       // ?from=&to=&agent=&caller=
        DECISIONS: '/agent-monitor/decisions',                     // ?page=&limit=&from=&to=&agent=&caller=&decision=
        LEARNING_SUMMARY: '/agent-monitor/learning/summary',
        LEARNING_ITEMS: '/agent-monitor/learning/items',           // ?page=&limit=&status=&source=&search= ; POST /:id/review
        LEARNING_SCAN: '/agent-monitor/learning/scan',             // POST
        MODELS: '/agent-monitor/models',                           // ?limit=
        REBUILD: '/agent-monitor/models/rebuild',                  // POST
    },
    VITA: {
        // Vita Test Agent, through the CMS API proxy (VitaController). See features/vitaAgents/services/vitaApi.ts.
        OVERVIEW: '/vita/overview',
        REPOS: '/vita/repos',
        RUNS: '/vita/runs',
        RUNS_ENQUEUE: '/vita/runs/enqueue',
        CASES: '/vita/cases',
        GRAPH: '/vita/graph',
        GATE: '/vita/gate',
        SCHEDULES: '/vita/schedules',
        SETTINGS_REPOS: '/vita/settings/repos',
        AUDIT: '/vita/audit',
        CONTROLS: '/vita/controls',
        COVERAGE: '/vita/coverage',
        GENERATE: '/vita/generate',
        ESCAPES: '/vita/escapes',
        LEARNING: '/vita/learning',
        LESSONS: '/vita/lessons',
        LEARN: '/vita/learn',
        RESULTS: '/vita/results',
        CLASSIFIER: '/vita/classifier',
        DIGEST: '/vita/digest',
    },
    SYMPTOM_ROUTER: {
        TRAINING_EXAMPLES: '/symptom-router/training-examples',   // GET ?page=&limit=&specialist=&search= | POST | PUT /:id | DELETE /:id
        FEEDBACK_LOG: '/symptom-router/feedback-log',             // ?page=&limit=&from=&to=&correctionsOnly=
        MODEL_INFO: '/symptom-router/model-info',
        RETRAIN: '/symptom-router/retrain',                       // POST
    },
    CHAT: {
        HISTORY: '../chat/history', // ChatController is /api/chat (steps out of /v1). Usage: /chat/history/:sessionId
        SESSIONS: '../chat/sessions', // ?page=&limit=&from=&to=&search=
    }
};
