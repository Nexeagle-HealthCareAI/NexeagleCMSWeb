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
    HOSPITALS: {
        GET_ALL: '/hospitals',
        GET_BY_ID: '/hospitals', // Usage: /hospitals/:id
        APPOINTMENT_STATS: '/hospitals', // Usage: /hospitals/:id/appointment-stats?from=&to= (GET)
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
    SUBSCRIPTIONS: {
        GET_ALL_REQUESTS: '/subscriptions/admin/payment-requests',
        APPROVE: '/subscriptions/approve-payment', // Usage: /subscriptions/approve-payment/:id
    },
    PLANS: {
        LIST: '/SubscriptionPlans',                   // ?application=EasyHMS|1Rad|All
    },
    CHAT: {
        HISTORY: '../chat/history', // ChatController is /api/chat (steps out of /v1). Usage: /chat/history/:sessionId
    }
};
