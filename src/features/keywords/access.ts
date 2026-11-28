// Who may do what in Keywords. The API enforces the same keys (KeywordsController, script 38).

/** With VITE_KEYWORDS_MOCK=true the section runs on example data in the browser, for reviewing screens without the API. */
export const KEYWORDS_MOCK = import.meta.env.VITE_KEYWORDS_MOCK === 'true';

/** See keywords, topics, the content plan and Setup. */
export const KEYWORDS_VIEW = 'keywords.view';
/** Correct keywords, make and merge topics, plan content. */
export const KEYWORDS_EDIT = 'keywords.edit';
/** Change seed lists, competitor sites, weights and the privacy threshold; run a collection now. */
export const KEYWORDS_CONNECT = 'keywords.connect';

export interface KeywordsCan { view: boolean; edit: boolean; connect: boolean }

export const keywordsCan = (perms: string[]): KeywordsCan => {
  const has = (p: string) => KEYWORDS_MOCK || perms.includes(p);
  return { view: has(KEYWORDS_VIEW), edit: has(KEYWORDS_EDIT), connect: has(KEYWORDS_CONNECT) };
};

export const canViewKeywords = (perms: string[]): boolean => KEYWORDS_MOCK || perms.includes(KEYWORDS_VIEW);
