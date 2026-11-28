// Keywords (CMS API: KeywordsController, /api/v1/keywords). Shapes match CMSAPI.Application/Models/KeywordModels.cs.

export type Site = 'doctordekho' | 'nexeagle';
export type Lang = 'en' | 'hg' | 'hi' | 'bn' | 'other';
export type Opportunity = 'close' | 'gap' | 'lang' | 'ctr' | 'rising';
export type ContentKind = 'page' | 'article' | 'guide' | 'social' | 'whatsapp' | 'ad';
export type Stage = 'idea' | 'brief' | 'writing' | 'review' | 'ready' | 'published';

export interface KeywordWeights { demand: number; fit: number; close: number; value: number }

export interface KeywordSource {
  key: string; name: string; what: string; often: string;
  /** ok, warn (ran with a problem or not set up), off (not available yet). */
  state: 'ok' | 'warn' | 'off';
  detail?: string | null; error?: string | null; lastRunAt?: string | null; lastOkAt?: string | null; lastCount: number; canRun: boolean;
}

export interface KeywordOpportunity { kind: Opportunity; site: Site; topicId?: string | null; keywordId?: string | null; title: string; keywords: string[]; why: string; score: number }

export interface KeywordOverview {
  tracked: number; newThisWeek: number; impressions: number; previousImpressions: number; clicks: number;
  position?: number | null; previousPosition?: number | null; topicsWithPlan: number; published: number; inProgress: number;
  opportunities: KeywordOpportunity[];
  languages: { language: Lang; impressions: number; visitors: number; searches: number }[];
  rising: { keywordId: string; text: string; site: Site; sources: string; now: number; changePercent: number }[];
  sources: KeywordSource[];
  collectedAt?: string | null;
}

export interface KeywordQuery {
  site?: Site | ''; language?: string; intent?: string; city?: string; source?: string; q?: string; topicId?: string; ignored?: boolean;
  sort?: 'demand' | 'shown' | 'position' | 'rising' | 'newest'; page?: number; pageSize?: number;
}

export interface KeywordRow {
  keywordId: string; site: Site; text: string; language: Lang; intent: string; city?: string | null; topicId?: string | null; topicName?: string | null;
  status: 'active' | 'ignored'; sources: string; avgMonthlySearches?: number | null; impressions: number; clicks: number; position?: number | null;
  visitors: number; weeks: number[]; firstSeenAt: string;
}

export interface KeywordPage { items: KeywordRow[]; total: number; cities: string[] }

export interface KeywordDetail extends KeywordRow {
  competition?: string | null; competitionIndex?: number | null; lowBid?: number | null; highBid?: number | null; currency: string;
  months: { y: number; m: number; v: number }[]; page?: string | null; seenIn: { name: string; detail: string }[]; variants: KeywordRow[];
  languageByPerson: boolean; intentByPerson: boolean;
}

export interface KeywordUpdate { language?: Lang; intent?: string; city?: string; clearCity?: boolean; topicId?: string; clearTopic?: boolean; status?: 'active' | 'ignored' }

export interface TopicRow {
  topicId: string; site: Site; name: string; targetPage?: string | null; isSuggested: boolean; keywordCount: number;
  demand: Partial<Record<Lang, number>>; impressions: number; clicks: number; position?: number | null;
  reason?: Opportunity | null; why?: string | null; score: number; contentCount: number; publishedCount: number;
}

export interface TopicDetail extends TopicRow { notes?: string | null; keywords: KeywordRow[]; questions: string[]; content: ContentItem[] }

export interface TopicSave { site: Site; name: string; targetPage?: string | null; notes?: string | null; keywordIds?: string[] }

export interface Brief {
  mainKeywords: Partial<Record<Lang, string>>; outline?: string | null; page?: string | null; schema?: string | null;
  writer?: string | null; reviewer?: string | null; notes?: string | null; checklist: Record<string, boolean>;
}

export interface ContentResult { impressionsBefore: number; impressionsAfter: number; clicksBefore: number; clicksAfter: number; positionBefore?: number | null; positionAfter?: number | null; daysAfter: number }

export interface ContentItem {
  contentId: string; site: Site; topicId?: string | null; topicName?: string | null; kind: ContentKind; title: string; stage: Stage; languages: Lang[];
  brief: Brief; ownerUserId?: string | null; ownerName?: string | null; dueDate?: string | null; url?: string | null; publishedAt?: string | null;
  createdAt: string; updatedAt: string; result?: ContentResult | null;
}

export interface ContentSave {
  site: Site; topicId?: string | null; kind: ContentKind; title: string; stage: Stage; languages: Lang[]; brief?: Brief | null;
  ownerUserId?: string | null; dueDate?: string | null; url?: string | null;
}

export interface KeywordSetup {
  canEdit: boolean; seeds: Partial<Record<Site, string[]>>; competitorSites: Partial<Record<Site, string[]>>; extraCities: string[];
  weights: KeywordWeights; minVisitors: number; sources: KeywordSource[];
  googleAccounts: { site: Site; name: string; signedIn: boolean; hasSearchConsole: boolean; hasAds: boolean }[];
  cities: string[];
}

export interface SetupSave {
  seeds?: Partial<Record<Site, string[]>>; competitorSites?: Partial<Record<Site, string[]>>; extraCities?: string[]; weights?: KeywordWeights; minVisitors?: number;
}
