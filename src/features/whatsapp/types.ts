// What the CMS API's WhatsApp section sends and receives (CMSAPI WhatsAppMarketingModels.cs).

export type OptIn = 'Unknown' | 'OptedIn' | 'OptedOut';
export type ChatView = 'open' | 'mine' | 'unassigned' | 'unread' | 'closed' | 'all';

export interface WaChat {
  contactId: string;
  phone: string;
  displayPhone: string;
  name?: string | null;
  profileName?: string | null;
  source: string;
  optIn: OptIn;
  tags: string[];
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  chatStatus: 'Open' | 'Closed';
  assignedUserId?: string | null;
  assignedName?: string | null;
  /** When the 24-hour reply window closes; null when it is closed. */
  windowClosesAt?: string | null;
}

export interface WaContact extends WaChat {
  leadId?: string | null;
  optInSource?: string | null;
  optInBy?: string | null;
  optInAt?: string | null;
  optOutAt?: string | null;
  optOutReason?: string | null;
  attributes: Record<string, string>;
  lastInboundAt?: string | null;
  createdAt: string;
}

export interface WaMessage {
  messageId: string;
  direction: 'In' | 'Out';
  type: string;
  body?: string | null;
  hasMedia: boolean;
  mediaMime?: string | null;
  mediaName?: string | null;
  templateName?: string | null;
  broadcastId?: string | null;
  status: string;
  statusAt?: string | null;
  errorText?: string | null;
  sentBy?: string | null;
  cost: number;
  createdAt: string;
}

export interface WaNote {
  noteId: string;
  author: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface WaThread {
  contact: WaContact;
  messages: WaMessage[];
  notes: WaNote[];
  windowOpen: boolean;
}

export interface WaAgent { userId: string; fullName: string; photoVersion?: string | null }

export interface WaContactQuery { search?: string; optIn?: string; source?: string; tag?: string; page?: number; pageSize?: number }
export interface WaContactPage { items: WaContact[]; total: number; allTags: string[] }

export interface WaSaveContact {
  phone: string;
  name?: string | null;
  tags?: string[];
  attributes?: Record<string, string>;
  optIn?: OptIn;
  optInSource?: string | null;
}

export interface WaImportRow { phone: string; name?: string; tags?: string[]; attributes?: Record<string, string>; optedIn?: boolean }
export interface WaImportResult { added: number; updated: number; skipped: number; problems: string[] }
export interface WaImportCommon { allOptedIn: boolean; optInSource?: string; tags?: string[] }

export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';

export interface WaButton { type: ButtonType; text?: string; url?: string; urlExample?: string; phone?: string; example?: string }

export interface WaTemplate {
  templateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejectedReason?: string | null;
  qualityScore?: string | null;
  parameterFormat: string;
  headerFormat: HeaderFormat;
  headerText?: string | null;
  body: string;
  footer?: string | null;
  buttons: WaButton[];
  headerVariables: string[];
  bodyVariables: string[];
  urlButtonVariable: boolean;
  hasSampleMedia: boolean;
  updatedAt: string;
}

export interface WaSaveTemplate {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY';
  headerFormat: HeaderFormat;
  headerText?: string;
  headerExample?: string;
  body: string;
  bodyExamples: Record<string, string>;
  footer?: string;
  buttons: WaButton[];
}

export interface WaVariableValue { from: 'name' | 'phone' | 'attribute' | 'text'; attribute?: string; text?: string }

export interface WaAudience { tags: string[]; sources: string[]; contactIds: string[] }

export interface WaBroadcastRequest {
  name: string;
  templateId: string;
  variables: Record<string, WaVariableValue>;
  headerMediaUrl?: string;
  audience: WaAudience;
  scheduledAt?: string | null;
}

export interface WaBroadcastPreview {
  matched: number;
  willSend: number;
  notOptedIn: number;
  optedOut: number;
  estimatedCost: number;
  currency: string;
  spentThisMonth: number;
  committed: number;
  monthlyBudget?: number | null;
  overBudget: boolean;
  samples: string[];
}

export type BroadcastStatus = 'Draft' | 'AwaitingApproval' | 'Scheduled' | 'Sending' | 'Paused' | 'Done' | 'Cancelled';

export interface WaBroadcast {
  broadcastId: string;
  name: string;
  templateId: string;
  templateName: string;
  category: string;
  status: BroadcastStatus;
  pausedReason?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  recipients: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replied: number;
  estimatedCost: number;
  actualCost: number;
  currency: string;
  createdBy?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface WaRecipient { contactId: string; displayPhone: string; name?: string | null; status: string; error?: string | null; sentAt?: string | null }

export interface WaProfile {
  about?: string | null;
  address?: string | null;
  description?: string | null;
  email?: string | null;
  websites: string[];
  vertical?: string | null;
  pictureUrl?: string | null;
}

export interface WaNumber {
  connected: boolean;
  problem?: string | null;
  displayPhone?: string | null;
  verifiedName?: string | null;
  nameStatus?: string | null;
  quality?: string | null;
  messagingLimit?: string | null;
  throughput?: string | null;
}

export interface WaRate { country: string; category: string; rate: number; currency: string; updatedAt?: string }

export interface WaSettings { monthlyBudget?: number | null; currency: string; sendPerSecond: number; rates: WaRate[] }

export interface WaSpendDay { date: string; marketing: number; utility: number; authentication: number; service: number; total: number; charged: number; free: number }
export interface WaSpendBroadcast { broadcastId: string; name: string; cost: number; delivered: number }
export interface WaSpend {
  from: string;
  to: string;
  currency: string;
  total: number;
  spentThisMonth: number;
  committed: number;
  monthlyBudget?: number | null;
  days: WaSpendDay[];
  byCategory: Record<string, number>;
  byBroadcast: WaSpendBroadcast[];
}
export interface WaMetaSpendDay { date: string; category: string; volume: number; cost: number }

export interface WaSetup {
  canEdit: boolean;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  appId?: string | null;
  hasAccessToken: boolean;
  accessTokenHint?: string | null;
  tokenSource: 'cms' | 'server' | 'none';
  hasAppSecret: boolean;
  verifyToken?: string | null;
  hasVerifyToken: boolean;
  unreadable: boolean;
  canEncrypt: boolean;
  suggestedWebhookUrl: string;
  webhookUrl?: string | null;
  webhookConnectedAt?: string | null;
  lastWebhookAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface WaSetupSave {
  phoneNumberId?: string;
  wabaId?: string;
  appId?: string;
  accessToken?: string;
  appSecret?: string;
  clearAccessToken?: boolean;
  clearAppSecret?: boolean;
}

export interface WaSetupCheck { key: string; label: string; state: 'ok' | 'warn' | 'fail' | 'todo'; detail?: string | null }
export interface WaSetupChecks { items: WaSetupCheck[]; ready: boolean }
