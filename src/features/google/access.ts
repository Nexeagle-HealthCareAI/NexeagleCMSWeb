// Who may do what in Google. The API enforces the same keys (GoogleController, script 37).

/** With VITE_GOOGLE_MOCK=true the section runs on example data in the browser, for reviewing screens without the API. */
export const GOOGLE_MOCK = import.meta.env.VITE_GOOGLE_MOCK === 'true';

/** Google Analytics numbers, pages and Google leads. */
export const GOOGLE_VIEW = 'google.view';
/** Google Ads spend, cost per lead and the comparison with Meta. */
export const GOOGLE_ADS = 'google.ads';
/** Sign in with Google, choose the accounts, the website tag, lead forms and results sent to Google. */
export const GOOGLE_CONNECT = 'google.connect';

export interface GoogleCan { view: boolean; ads: boolean; connect: boolean }

export const googleCan = (perms: string[]): GoogleCan => {
  const has = (p: string) => GOOGLE_MOCK || perms.includes(p);
  return { view: has(GOOGLE_VIEW), ads: has(GOOGLE_ADS), connect: has(GOOGLE_CONNECT) };
};

export const canViewGoogle = (perms: string[]): boolean => GOOGLE_MOCK || perms.includes(GOOGLE_VIEW);
