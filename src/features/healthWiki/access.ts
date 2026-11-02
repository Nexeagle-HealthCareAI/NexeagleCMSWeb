export const HEALTH_WIKI_PERMISSION = 'health-wiki.manage';

/** While the backend is not wired, VITE_HEALTH_WIKI_MOCK=true shows the feature to every signed-in user. */
export const HEALTH_WIKI_MOCK = import.meta.env.VITE_HEALTH_WIKI_MOCK === 'true';

export const canUseHealthWiki = (permissions: string[]) =>
  HEALTH_WIKI_MOCK || permissions.includes(HEALTH_WIKI_PERMISSION);
