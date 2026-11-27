// CMS → Google: the API's shapes (CMSAPI.Application/Models/GoogleModels.cs). Dates are ISO strings; days "YYYY-MM-DD".

export type GoogleSite = 'nexeagle' | 'doctordekho';

export interface GoogleAccount {
  accountId: string;
  name: string;
  site?: string | null;
  ga4PropertyName?: string | null;
  adsAccountName?: string | null;
  searchConsoleSite?: string | null;
  currency: string;
  signedIn: boolean;
  hasAnalytics: boolean;
  hasAds: boolean;
}

export interface GoogleOutcome { stage: string; conversionActionId: string; conversionActionName?: string | null; value?: number | null }
export interface GoogleSiteEvent { name: string; label: string; isLead: boolean }

export interface GoogleSetup extends GoogleAccount {
  canEdit: boolean;
  canEncrypt: boolean;
  unreadable: boolean;
  clientId?: string | null;
  hasClientSecret: boolean;
  signedInEmail?: string | null;
  signedInAt?: string | null;
  ga4PropertyId?: string | null;
  adsCustomerId?: string | null;
  adsLoginCustomerId?: string | null;
  redirectUrl: string;
  measurementId?: string | null;
  adsConversionId?: string | null;
  eventLabels: Record<string, string>;
  siteEvents: GoogleSiteEvent[];
  leadWebhookUrl: string;
  leadKey?: string | null;
  lastLeadAt?: string | null;
  outcomes: GoogleOutcome[];
  lastOutcomeAt?: string | null;
  lastOutcomeError?: string | null;
  lastReadError?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface GoogleClientSave { name?: string; site?: string | null; clientId?: string; clientSecret?: string; signOut?: boolean }
export interface GoogleChoice { ga4PropertyId?: string | null; adsCustomerId?: string | null; searchConsoleSite?: string | null }
export interface GoogleTagSave { measurementId?: string | null; adsConversionId?: string | null; eventLabels?: Record<string, string> }

export interface GaProperty { propertyId: string; name: string; accountName?: string | null }
export interface GoogleAdsAccount { customerId: string; name: string; currency?: string | null; loginCustomerId?: string | null }
export interface GoogleConversionAction { id: string; name: string }
export interface GoogleDiscovery {
  signedInEmail?: string | null;
  properties: GaProperty[];
  adsAccounts: GoogleAdsAccount[];
  searchConsoleSites: string[];
  conversionActions: GoogleConversionAction[];
  /** Per part ("analytics", "ads", "searchConsole", "conversionActions"): why it could not be listed. */
  problems: Record<string, string>;
}

export type CheckState = 'ok' | 'warn' | 'fail' | 'todo';
export interface GoogleCheck { key: string; label: string; state: CheckState; detail?: string | null }
export interface GoogleChecks { ready: boolean; items: GoogleCheck[] }

export interface GoogleRange { accountId: string; from: string; to: string }

export interface GoogleDay { day: string; sessions: number; keyEvents: number }
export interface GoogleChannel { name: string; sessions: number; keyEvents: number }
export interface GoogleCampaign { name: string; sourceMedium: string; sessions: number; keyEvents: number }
export interface GoogleEvent { name: string; label: string; count: number; isLead: boolean }
export interface GoogleOverview {
  users: number;
  previousUsers?: number | null;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
  ownVisits?: number | null;
  days: GoogleDay[];
  channels: GoogleChannel[];
  campaigns: GoogleCampaign[];
  events: GoogleEvent[];
  readAt: string;
}

export interface GooglePage { path: string; sessions: number; engagedSessions: number; avgSeconds: number; keyEvents: number; contacts: number }
export interface GooglePages { siteUrl?: string | null; pages: GooglePage[]; readAt: string }
export interface GscRow { key: string; clicks: number; impressions: number; position: number }
export interface GooglePageDetail { path: string; sources: GoogleChannel[]; queries: GscRow[]; searchConsoleConnected: boolean }

export type AdsLevel = 'campaign' | 'adgroup' | 'keyword' | 'search';
export interface GoogleAdsRow {
  id: string; name: string; sub?: string | null; status?: string | null;
  spend: number; impressions: number; clicks: number; conversions: number;
  crmLeads?: number | null; costPerLead?: number | null;
}
export interface GooglePlatform {
  platform: 'google' | 'meta'; spend: number; leads: number; costPerLead?: number | null;
  reachedDemo: number; customers: number; costPerCustomer?: number | null;
}
export interface GoogleAds {
  currency: string;
  spend: number;
  dailyBudgets?: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  crmLeads: number;
  webLeads: number;
  formLeads: number;
  costPerLead?: number | null;
  previousCostPerLead?: number | null;
  customers: number;
  days: { day: string; spend: number }[];
  rows: GoogleAdsRow[];
  platforms: GooglePlatform[];
  readAt: string;
}

export type GoogleLeadSource = '' | 'web' | 'form';
export interface GoogleLeadQuery { accountId: string; source?: GoogleLeadSource; campaign?: string; page?: number; pageSize?: number }
export interface GoogleLead {
  googleLeadId: string;
  leadId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  source: 'web' | 'form';
  formName?: string | null;
  campaignName?: string | null;
  keyword?: string | null;
  fromGoogleAd: boolean;
  utmSource?: string | null;
  answers: { name: string; value: string }[];
  receivedAt: string;
  stage?: string | null;
  owner?: string | null;
  inCrm: boolean;
  sentStage?: string | null;
  sentAt?: string | null;
  sendError?: string | null;
}
export interface GoogleLeadSummary {
  last7Days: number; web7: number; forms7: number; notContacted: number; oldestNotContactedAt?: string | null;
  reachedDemoThisMonth: number; leadsThisMonth: number; sentThisMonth: number;
}
export interface GoogleLeadPage { items: GoogleLead[]; total: number; summary: GoogleLeadSummary; campaigns: string[] }
