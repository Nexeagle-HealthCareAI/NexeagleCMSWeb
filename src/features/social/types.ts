// CMS → Social (Facebook Page + Instagram): what the API sends and receives (CMS API: SocialController).
// Dates are ISO strings in UTC.

export type Channel = 'facebook' | 'instagram';
export type DmChannel = 'messenger' | 'instagram';
export type PostKind = 'Photo' | 'Carousel' | 'Video' | 'Reel' | 'Story' | 'Text' | 'Link';
export type DraftStatus = 'Draft' | 'AwaitingApproval' | 'SentBack' | 'Scheduled' | 'Publishing' | 'Published' | 'Failed' | 'Cancelled';
export type WhenMode = 'approved' | 'schedule' | 'queue';

export interface SocialAccount {
  accountId: string;
  name: string;
  pageId?: string | null;
  pageName?: string | null;
  igUserId?: string | null;
  igUsername?: string | null;
  adAccountId?: string | null;
  adAccountName?: string | null;
  currency: string;
  connected: boolean;
}

export interface SocialSetup extends SocialAccount {
  canEdit: boolean;
  appId?: string | null;
  hasAppSecret: boolean;
  hasToken: boolean;
  tokenHint?: string | null;
  verifyToken?: string | null;
  unreadable: boolean;
  canEncrypt: boolean;
  suggestedWebhookUrl: string;
  webhookUrl?: string | null;
  webhooksConnectedAt?: string | null;
  lastWebhookAt?: string | null;
  postsSyncedAt?: string | null;
  adsSyncedAt?: string | null;
  leadsCheckedAt?: string | null;
  syncError?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface SocialKeysSave { name?: string; appId?: string; appSecret?: string; token?: string; clearToken?: boolean }

export interface MetaPage { id: string; name: string; instagramId?: string | null; instagramUsername?: string | null }
export interface MetaAdAccount { id: string; name: string; currency?: string | null; status?: number | null }
export interface MetaAssets { userName?: string | null; pages: MetaPage[]; adAccounts: MetaAdAccount[]; permissions: string[] }

export type CheckState = 'ok' | 'warn' | 'fail' | 'todo';
export interface SocialCheck { key: string; label: string; state: CheckState; detail?: string | null }
export interface SocialPermission { for: string; permissions: string; state: 'granted' | 'missing' | 'unknown' }
export interface SocialChecks { items: SocialCheck[]; permissions: SocialPermission[]; ready: boolean }

// ── posts ────────────────────────────────────────────────────────────────────

export interface SocialPostQuery {
  accountId: string;
  channel?: Channel;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
  sort?: 'newest' | 'views' | 'interactions';
  page?: number;
  pageSize?: number;
}

export interface SocialPost {
  postId: string;
  channel: Channel;
  metaId: string;
  type: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
  publishedAt: string;
  fromCms: boolean;
  publishedBy?: string | null;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  statsAt?: string | null;
}

export interface SocialPostSummary {
  posts: number;
  facebookPosts: number;
  instagramPosts: number;
  views: number;
  previousViews?: number | null;
  interactions: number;
  newFacebookFollowers?: number | null;
  newInstagramFollowers?: number | null;
}

export interface SocialPostPage { items: SocialPost[]; total: number; summary: SocialPostSummary; syncedAt?: string | null }
export interface SocialDayStat { day: string; views?: number | null; likes?: number | null; comments?: number | null }
export interface SocialPostDetail { post: SocialPost; days: SocialDayStat[]; comments: SocialComment[]; metrics: Record<string, number> }

// ── compose ──────────────────────────────────────────────────────────────────

export interface SocialMediaRef { key: string; mime: string; name: string; size: number }

export interface SocialDraftSave {
  accountId: string;
  title: string;
  toFacebook: boolean;
  toInstagram: boolean;
  kind: PostKind;
  caption?: string | null;
  facebookCaption?: string | null;
  instagramCaption?: string | null;
  link?: string | null;
  media: SocialMediaRef[];
  whenMode: WhenMode;
  scheduledAt?: string | null;
  checklist: Record<string, boolean>;
  approverUserId?: string | null;
}

export interface SocialDraft extends Omit<SocialDraftSave, 'kind' | 'whenMode'> {
  draftId: string;
  kind: PostKind;
  whenMode: WhenMode;
  status: DraftStatus;
  approverName?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  sentBackNote?: string | null;
  facebookPostId?: string | null;
  instagramMediaId?: string | null;
  error?: string | null;
  publishedAt?: string | null;
  createdByUserId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialCalendarItem {
  draftId?: string | null;
  postId?: string | null;
  title: string;
  channels: Channel[];
  at: string;
  status: DraftStatus;
  error?: string | null;
}

export interface SocialSlot { slotId?: string | null; dayOfWeek: number; time: string; toFacebook: boolean; toInstagram: boolean }
export interface SocialPerson { userId: string; fullName: string }

// ── inbox ────────────────────────────────────────────────────────────────────

export type InboxView = 'open' | 'mine' | 'unassigned' | 'unread' | 'closed' | 'all';
export type InboxChannel = '' | 'messenger' | 'instagram' | 'comments';

export interface SocialConversation {
  kind: 'dm' | 'comment';
  id: string;
  channel: string;
  name: string;
  handle?: string | null;
  preview?: string | null;
  lastAt?: string | null;
  unread: number;
  status: string;
  assignedUserId?: string | null;
  assignedName?: string | null;
  windowClosesAt?: string | null;
  humanAgentUntil?: string | null;
  leadId?: string | null;
}

export interface SocialAttachment { type: string; url?: string | null; name?: string | null }

export interface SocialMessage {
  messageId: string;
  direction: 'In' | 'Out';
  text?: string | null;
  attachments: SocialAttachment[];
  status: string;
  error?: string | null;
  sentBy?: string | null;
  humanAgent: boolean;
  createdAt: string;
}

export interface SocialNote { noteId: string; author: string; text: string; createdAt: string }

export interface SocialThread {
  conversation: SocialConversation;
  messages: SocialMessage[];
  notes: SocialNote[];
  windowOpen: boolean;
  humanAgentOpen: boolean;
}

export interface SocialComment {
  commentId: string;
  channel: Channel;
  metaId: string;
  postMetaId: string;
  postCaption?: string | null;
  postPermalink?: string | null;
  postId?: string | null;
  parentMetaId?: string | null;
  authorName?: string | null;
  text?: string | null;
  fromUs: boolean;
  hidden: boolean;
  status: string;
  repliedBy?: string | null;
  privateReplyAt?: string | null;
  canPrivateReply: boolean;
  leadId?: string | null;
  createdAt: string;
  replies: SocialComment[];
}

export interface SocialMakeLead { name: string; phone?: string; email?: string; city?: string; interestedIn?: string; notes?: string }

// ── leads ────────────────────────────────────────────────────────────────────

export type LeadSource = '' | 'form' | 'messenger' | 'instagram' | 'comment';
export interface SocialLeadQuery { accountId: string; source?: LeadSource; formId?: string; page?: number; pageSize?: number }
export interface SocialLeadAnswer { name: string; value: string }

export interface SocialLead {
  socialLeadId: string;
  leadId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  source: string;
  formName?: string | null;
  adName?: string | null;
  campaignName?: string | null;
  platform?: string | null;
  isOrganic?: boolean | null;
  answers: SocialLeadAnswer[];
  receivedAt: string;
  stage?: string | null;
  owner?: string | null;
  inCrm: boolean;
}

export interface SocialLeadSummary { last7Days: number; fromForms7: number; fromChats7: number; notContacted: number; oldestNotContactedAt?: string | null; customers: number }

export interface SocialLeadForm { formId: string; name: string; status?: string | null; metaCount?: number | null; crmCount?: number | null; missing: number; checkedAt?: string | null }

export interface SocialLeadPage { items: SocialLead[]; total: number; summary: SocialLeadSummary; forms: SocialLeadForm[] }

// ── ads ──────────────────────────────────────────────────────────────────────

export type AdLevel = 'campaign' | 'adset' | 'ad';
export interface SocialAdRow {
  id: string;
  name: string;
  parentName?: string | null;
  status?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
  costPerLead?: number | null;
}
export interface SocialAdDay { day: string; spend: number; leads: number }
export interface SocialAds {
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
  costPerLead?: number | null;
  previousCostPerLead?: number | null;
  customers: number;
  days: SocialAdDay[];
  rows: SocialAdRow[];
  syncedAt?: string | null;
}
