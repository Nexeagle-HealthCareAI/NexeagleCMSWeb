import type { ArticlePayload, DoctorOption, HealthArticle } from '../types';

// In-memory stand-in used when VITE_HEALTH_WIKI_MOCK=true. Example data only; resets on reload.
const DOCTORS: DoctorOption[] = [
  { doctorId: 'd1', fullName: 'Dr. Meera Nair', specialty: 'Endocrinologist', qualification: 'MBBS, MD, DM (Endocrinology)', registrationNumber: '48213', registrationCouncil: 'Delhi Medical Council' },
  { doctorId: 'd2', fullName: 'Dr. Anil Kapoor', specialty: 'Neurosurgeon', qualification: 'MCh - Neurosurgery', registrationNumber: '31577', registrationCouncil: 'Karnataka Medical Council' },
  { doctorId: 'd3', fullName: 'Dr. Rahul Sen', specialty: 'Cardiologist', qualification: 'MBBS, DM (Cardiology)', registrationNumber: null, registrationCouncil: null },
];

const now = () => new Date().toISOString();

let articles: HealthArticle[] = [
  {
    slug: 'diabetes-type-2', title: 'Understanding Type 2 Diabetes',
    description: 'A plain-language guide to symptoms, causes and management.',
    content: '## What is Type 2 Diabetes?\n\nYour body cannot use insulin well, so sugar builds up in your blood.\n\n## Common symptoms\n\n- Increased thirst\n- Frequent urination\n- **Slow-healing** wounds',
    relatedConditionSlug: 'diabetes', coverImageUrl: null, coverImageAlt: null,
    authorDoctorId: 'd1', reviewerDoctorId: 'd1', status: 'PUBLISHED', publishedAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z',
  },
  {
    slug: 'high-blood-pressure', title: 'Living with High Blood Pressure',
    description: 'What the numbers mean, and daily habits that help.',
    content: '## Know your numbers\n\nA normal reading is below **120/80**.',
    relatedConditionSlug: 'hypertension', coverImageUrl: null, coverImageAlt: null,
    authorDoctorId: 'd3', reviewerDoctorId: 'd3', status: 'IN_REVIEW', publishedAt: null, updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    slug: 'thyroid-basics', title: 'Thyroid Basics',
    description: 'Hypo and hyperthyroidism explained.',
    content: '## Overview\n\nA butterfly-shaped gland in your neck.',
    relatedConditionSlug: 'thyroid', coverImageUrl: null, coverImageAlt: null,
    authorDoctorId: 'd1', reviewerDoctorId: 'd1', status: 'DRAFT', publishedAt: null, updatedAt: '2026-10-02T08:00:00Z',
    reviewerComment: 'Please add when to see a doctor and simplify the second paragraph.',
  },
];

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));

export const mockHealthWiki = {
  list: () => wait([...articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  get: async (slug: string) => {
    const a = articles.find((x) => x.slug === slug);
    if (!a) throw new Error('Article not found');
    return wait({ ...a });
  },
  create: async (p: ArticlePayload) => {
    if (articles.some((x) => x.slug === p.slug)) throw new Error('An article with this slug already exists.');
    const a: HealthArticle = { ...p, slug: p.slug!, publishedAt: null, updatedAt: now() };
    articles = [a, ...articles];
    return wait({ ...a });
  },
  update: async (slug: string, p: ArticlePayload) => {
    const i = articles.findIndex((x) => x.slug === slug);
    if (i < 0) throw new Error('Article not found');
    articles[i] = { ...articles[i], ...p, slug, reviewerComment: null, updatedAt: now() };
    return wait({ ...articles[i] });
  },
  uploadImage: (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(file);
    }),
  listDoctors: () => wait([...DOCTORS]),
};
