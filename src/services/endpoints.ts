export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
    },
    // Add other domains here as needed
    SYSTEM: {
        HEALTH: '../health', // Steps out of /v1 to /api/health
    },
    HOSPITALS: {
        GET_ALL: '/hospitals',
        GET_BY_ID: '/hospitals', // Usage: /hospitals/:id
    },
    DASHBOARD: {
        STATS: '/dashboard/stats',
    },
    // USERS: { ... },
};
