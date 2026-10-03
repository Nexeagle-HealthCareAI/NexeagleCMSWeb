export type ArticleStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  PUBLISHED: 'Published',
};

/** Health Wiki article as returned by the CMS API. `content` is markdown. */
export interface HealthArticle {
  slug: string;
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorDoctorId: string | null;
  reviewerDoctorId: string | null;
  status: ArticleStatus;
  /** Set when the reviewing doctor sent the article back with changes requested. */
  reviewerComment?: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

/** Fields the creator form can send. On create `slug` is required; on update it is the URL key. */
export interface ArticlePayload {
  slug?: string;
  title: string;
  description: string;
  content: string;
  relatedConditionSlug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorDoctorId: string | null;
  reviewerDoctorId: string | null;
  status: ArticleStatus;
}

export interface DoctorOption {
  doctorId: string;
  fullName: string;
  specialty: string | null;
  qualification: string | null;
  registrationNumber: string | null;
  registrationCouncil: string | null;
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
