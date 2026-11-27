// Who may do what in Social. The API enforces the same keys (SocialController, script 36).

/** With VITE_SOCIAL_MOCK=true the section runs on example data in the browser, for reviewing screens without the API. */
export const SOCIAL_MOCK = import.meta.env.VITE_SOCIAL_MOCK === 'true';

export const SOCIAL_VIEW = 'social.view';
/** Answer messages and comments, make leads from them. */
export const SOCIAL_REPLY = 'social.reply';
/** Write posts and send them for approval. */
export const SOCIAL_COMPOSE = 'social.compose';
/** Approve and publish posts, set the queue. */
export const SOCIAL_PUBLISH = 'social.publish';
/** See ad spend and cost per lead. */
export const SOCIAL_ADS = 'social.ads';
/** Enter the Meta keys, choose the Page and accounts, connect webhooks. */
export const SOCIAL_CONNECT = 'social.connect';

export interface SocialCan { view: boolean; reply: boolean; compose: boolean; publish: boolean; ads: boolean; connect: boolean }

export const socialCan = (perms: string[]): SocialCan => {
  const has = (p: string) => SOCIAL_MOCK || perms.includes(p);
  return { view: has(SOCIAL_VIEW), reply: has(SOCIAL_REPLY), compose: has(SOCIAL_COMPOSE), publish: has(SOCIAL_PUBLISH), ads: has(SOCIAL_ADS), connect: has(SOCIAL_CONNECT) };
};

export const canViewSocial = (perms: string[]): boolean => SOCIAL_MOCK || perms.includes(SOCIAL_VIEW);
