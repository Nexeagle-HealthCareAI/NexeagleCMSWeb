export const REFRESH_EVENT = 'health-wiki-counts-refresh';

/** Ask the section tabs to reload their numbers, for example after a contributor is verified. */
export const refreshNavCounts = () => window.dispatchEvent(new Event(REFRESH_EVENT));
