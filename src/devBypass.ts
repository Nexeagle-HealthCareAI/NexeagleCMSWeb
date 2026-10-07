import { useAuthStore } from './store/useAuthStore';

/**
 * Local UI work only. With `npm run dev` and VITE_DEV_BYPASS_LOGIN=true the app starts signed in as a
 * fake admin, so screens can be reviewed without a working login. `import.meta.env.DEV` is false in a
 * production build, so this is removed there and can never be switched on in a deployed app.
 * Calls to the real API still fail with 401 in this mode; use it with VITE_HEALTH_WIKI_MOCK=true.
 */
export const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === 'true';

export function applyDevBypass() {
  if (!DEV_BYPASS) return;
  useAuthStore.setState({
    user: { id: 'dev-bypass', email: 'dev@localhost', name: 'Local reviewer', role: 'Administrator' },
    token: 'dev-bypass-token',
    permissions: ['dashboard.view', 'health-wiki.manage'],
    mustChangePassword: false,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
  console.warn('[dev] Login bypass is ON. You are signed in as a fake admin; real API calls will return 401.');
}
