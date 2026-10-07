export type ArticleStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  PUBLISHED: 'Published',
};

/** MEDICAL needs a verified doctor reviewer. SECTOR_UPDATE is approved by a CMS editor and is never medical advice. */
export type ArticleType = 'MEDICAL' | 'SECTOR_UPDATE';

export const TYPE_LABEL: Record<ArticleType, string> = {
  MEDICAL: 'Medical',
  SECTOR_UPDATE: 'Sector update',
};

export type ContributorType = 'HOSPITAL_DOCTOR' | 'INDEPENDENT_DOCTOR' | 'HEALTH_WORKER' | 'WRITER' | 'STAFF';

export const CONTRIBUTOR_TYPE_LABEL: Record<ContributorType, string> = {
  HOSPITAL_DOCTOR: 'Hospital doctor',
  INDEPENDENT_DOCTOR: 'Independent doctor',
  HEALTH_WORKER: 'Health worker',
  WRITER: 'Writer / technologist',
  STAFF: 'NexEagle staff',
};

export type ContributorStatus = 'INVITED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export const isDoctor = (t: ContributorType) => t === 'HOSPITAL_DOCTOR' || t === 'INDEPENDENT_DOCTOR';

/** Doctors are "verified" (registration checked); everyone else is "approved". */
export const contributorStatusLabel = (type: ContributorType, status: ContributorStatus) => {
  if (status === 'VERIFIED') return isDoctor(type) ? 'Verified' : 'Approved';
  if (status === 'PENDING') return isDoctor(type) ? 'Pending verification' : 'Pending approval';
  return status === 'INVITED' ? 'Invited' : 'Rejected';
};

/** Anyone who writes or reviews. Mobile and email are restricted and must never reach a public page. */
export interface Contributor {
  contributorId: string;
  type: ContributorType;
  fullName: string;
  speciality: string | null;
  qualification: string | null;
  roleTitle: string | null;
  organisation: string | null;
  mobile: string;
  registrationNumber: string | null;
  registrationCouncil: string | null;
  status: ContributorStatus;
  enrolmentSource: 'INVITED' | 'SELF_ENROLLED';
  /** Last WhatsApp link sent, display text from the API. */
  linkSentAt: string | null;
  rejectReason: string | null;
}

export interface InviteContributorPayload {
  fullName: string;
  /** 10-digit Indian mobile number, digits only. */
  mobile: string;
  type: Exclude<ContributorType, 'HOSPITAL_DOCTOR' | 'STAFF'>;
}

/** Health Wiki article as returned by the CMS API. `content` is markdown. */
export interface HealthArticle {
  slug: string;
  type: ArticleType;
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorContributorId: string | null;
  reviewerContributorId: string | null;
  status: ArticleStatus;
  /** Set when the reviewer or an editor sent the article back. */
  reviewerComment?: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

/** Fields the creator form can send. On create `slug` is required; on update it is the URL key. */
export interface ArticlePayload {
  slug?: string;
  type: ArticleType;
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorContributorId: string | null;
  reviewerContributorId: string | null;
  status: ArticleStatus;
}

/** Condition slugs the "Need a Specialist?" card on Doctor Dekho can link to. */
export const CONDITION_OPTIONS = [
  'diabetes',
  'hypertension',
  'thyroid',
  'asthma',
  'pcos',
  'heart-disease',
  'arthritis',
  'migraine',
];

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const NMC_REGISTER_URL = 'https://www.nmc.org.in/information-desk/indian-medical-register/';
