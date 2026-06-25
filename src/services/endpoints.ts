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
        USERS: '/users',                 // GET list, POST create; /users/:id GET/PUT; /users/:id/reset-password
        ROLES: '/roles',                 // GET list, POST create; /roles/:id PUT/DELETE
        PERMISSIONS: '/permissions',     // GET catalog
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
    SUBSCRIPTIONS: {
        GET_ALL_REQUESTS: '/subscriptions/admin/payment-requests',
        APPROVE: '/subscriptions/approve-payment', // Usage: /subscriptions/approve-payment/:id
    },
    ASSIST: {
        USAGE: '/assist/usage',                       // RadAI token usage & savings
    },
    CHAT: {
        HISTORY: '../chat/history', // ChatController is /api/chat (steps out of /v1). Usage: /chat/history/:sessionId
    }
};
