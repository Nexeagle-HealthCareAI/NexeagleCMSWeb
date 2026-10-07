import type { ArticlePayload, Contributor, HealthArticle, HistoryEntry, InviteContributorPayload, NavCounts, TopicDecision, TopicRequest } from '../types';

// In-memory stand-in used when VITE_HEALTH_WIKI_MOCK=true. Example data only; resets on reload.
const person = (c: Partial<Contributor> & Pick<Contributor, 'contributorId' | 'type' | 'fullName' | 'mobile' | 'status'>): Contributor => ({
  speciality: null, qualification: null, roleTitle: null, organisation: null,
  registrationNumber: null, registrationCouncil: null,
  enrolmentSource: 'INVITED', linkSentAt: null, rejectReason: null, ...c,
});

const seedContributors = (): Contributor[] => [
  person({ contributorId: 'c1', type: 'HOSPITAL_DOCTOR', fullName: 'Dr. Meera Nair', speciality: 'Endocrinologist', qualification: 'MBBS, MD, DM (Endocrinology)', mobile: '+91 98100 11001', registrationNumber: '48213', registrationCouncil: 'Delhi Medical Council', status: 'VERIFIED' }),
  person({ contributorId: 'c2', type: 'HOSPITAL_DOCTOR', fullName: 'Dr. Anil Kapoor', speciality: 'Neurosurgeon', qualification: 'MCh - Neurosurgery', mobile: '+91 98100 11002', registrationNumber: '31577', registrationCouncil: 'Karnataka Medical Council', status: 'VERIFIED' }),
  person({ contributorId: 'c3', type: 'HOSPITAL_DOCTOR', fullName: 'Dr. Rahul Sen', speciality: 'Cardiologist', qualification: 'MBBS, DM (Cardiology)', mobile: '+91 98100 11003', status: 'VERIFIED' }),
  person({ contributorId: 'c4', type: 'INDEPENDENT_DOCTOR', fullName: 'Dr. Kavita Rao', speciality: 'Cardiologist', qualification: 'MBBS, MD, DM (Cardiology)', mobile: '+91 98765 44127', registrationNumber: '52871', registrationCouncil: 'Maharashtra Medical Council', status: 'PENDING', linkSentAt: '3 Oct, 6:40 pm' }),
  person({ contributorId: 'c5', type: 'INDEPENDENT_DOCTOR', fullName: 'Dr. Imran Qureshi', speciality: 'General Physician', qualification: 'MBBS, MD (Medicine)', mobile: '+91 98911 22002', registrationNumber: '40116', registrationCouncil: 'Delhi Medical Council', status: 'VERIFIED', linkSentAt: '28 Sep, 11:05 am', enrolmentSource: 'SELF_ENROLLED' }),
  person({ contributorId: 'c6', type: 'INDEPENDENT_DOCTOR', fullName: 'Dr. Sunita Joshi', mobile: '+91 97000 33003', status: 'INVITED', linkSentAt: '4 Oct, 9:10 am' }),
  person({ contributorId: 'c7', type: 'WRITER', fullName: 'Rohan Mehta', roleTitle: 'Product manager', organisation: 'HealthTech India', mobile: '+91 98200 44004', status: 'VERIFIED', enrolmentSource: 'SELF_ENROLLED' }),
  person({ contributorId: 'c8', type: 'HEALTH_WORKER', fullName: 'Asha Verma', roleTitle: 'Community health worker', organisation: 'District hospital, Lucknow', mobile: '+91 98300 55005', status: 'VERIFIED' }),
  person({ contributorId: 'c9', type: 'WRITER', fullName: 'Neha Iyer', roleTitle: 'Health policy analyst', organisation: 'Independent', mobile: '+91 98400 66006', status: 'PENDING', enrolmentSource: 'SELF_ENROLLED' }),
  person({ contributorId: 'c10', type: 'STAFF', fullName: 'NexEagle content team', mobile: '+91 80749 06808', status: 'VERIFIED' }),
];
let contributors = seedContributors();

const now = () => new Date().toISOString();
const clock = () => new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(' at', ',');

const base = { coverImageUrl: null, coverImageAlt: null, disclosure: null, references: null };
const seedArticles = (): HealthArticle[] => [
  {
    ...base, slug: 'diabetes-type-2', type: 'MEDICAL', title: 'Understanding Type 2 Diabetes',
    description: 'A plain-language guide to symptoms, causes and management.',
    content: '## What is Type 2 Diabetes?\n\nYour body cannot use insulin well, so sugar builds up in your blood.\n\n## Common symptoms\n\n- Increased thirst\n- Frequent urination\n- **Slow-healing** wounds',
    relatedConditionSlug: 'diabetes', authorContributorId: 'c10', reviewerContributorId: 'c1', status: 'PUBLISHED', publishedAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z',
  },
  {
    ...base, slug: 'high-blood-pressure', type: 'MEDICAL', title: 'Living with High Blood Pressure',
    description: 'What the numbers mean, and daily habits that help.',
    content: '## Know your numbers\n\nA normal reading is below **120/80**.',
    relatedConditionSlug: 'hypertension', authorContributorId: 'c10', reviewerContributorId: 'c3', status: 'IN_REVIEW', publishedAt: null, updatedAt: '2026-10-01T08:00:00Z',
  },
  {
    ...base, slug: 'thyroid-basics', type: 'MEDICAL', title: 'Thyroid Basics',
    description: 'Hypo and hyperthyroidism explained.',
    content: '## Overview\n\nA butterfly-shaped gland in your neck.',
    relatedConditionSlug: 'thyroid', authorContributorId: 'c10', reviewerContributorId: 'c1', status: 'DRAFT', publishedAt: null, updatedAt: '2026-10-02T08:00:00Z',
    reviewerComment: 'Please add when to see a doctor and simplify the second paragraph.',
  },
  {
    ...base, slug: 'abdm-and-hospital-records', type: 'SECTOR_UPDATE', title: 'How ABDM Is Changing Hospital Records',
    description: 'What the Ayushman Bharat Digital Mission means for how hospitals store and share patient records.',
    content: '## What is changing\n\nHospitals are linking patient records to a national ID so that records can follow the patient.\n\n## What it means for hospitals\n\n- Digital records instead of paper files\n- Consent-based sharing between hospitals',
    relatedConditionSlug: null, authorContributorId: 'c7', reviewerContributorId: null, status: 'IN_REVIEW', publishedAt: null, updatedAt: '2026-10-03T08:00:00Z',
  },
];
let articles = seedArticles();


const seedTopics = (): TopicRequest[] => [
  { topicId: 't1', contributorId: 'c4', title: 'Recognising a silent heart attack', type: 'MEDICAL', outline: 'Symptoms in women and people with diabetes that are easy to miss, and when to go to an emergency room.', whyItMatters: 'Many patients wait because the pain is mild. A clear checklist could save lives.', conditionSlug: 'heart-disease', references: 'ICMR guidance on acute coronary syndrome', status: 'SUBMITTED', decisionReason: null, articleSlug: null, createdAt: '2026-10-05T09:00:00Z', updatedAt: '2026-10-05T09:00:00Z' },
  { topicId: 't2', contributorId: 'c7', title: 'Teleconsultation rules for hospitals in 2026', type: 'SECTOR_UPDATE', outline: 'A summary of what the latest telemedicine guidelines require from hospitals and platforms.', whyItMatters: 'Hospital administrators keep asking what changed.', conditionSlug: null, references: null, status: 'SUBMITTED', decisionReason: null, articleSlug: null, createdAt: '2026-10-04T11:30:00Z', updatedAt: '2026-10-04T11:30:00Z' },
  { topicId: 't3', contributorId: 'c8', title: 'Home care for a child with fever', type: 'MEDICAL', outline: 'Simple steps for parents before reaching a clinic.', whyItMatters: 'Parents in my district call us at night for this.', conditionSlug: null, references: null, status: 'NEEDS_DETAIL', decisionReason: 'Which age group does this cover, and which medicines would you mention?', articleSlug: null, createdAt: '2026-10-02T08:00:00Z', updatedAt: '2026-10-03T08:00:00Z' },
  { topicId: 't4', contributorId: 'c5', title: 'Managing blood sugar during Diwali', type: 'MEDICAL', outline: 'Sweets, fasting and medicine timing for people with diabetes.', whyItMatters: 'Seasonal and very searched.', conditionSlug: 'diabetes', references: null, status: 'ARTICLE_STARTED', decisionReason: null, articleSlug: 'diabetes-and-diwali', createdAt: '2026-09-28T08:00:00Z', updatedAt: '2026-09-30T08:00:00Z' },
  { topicId: 't5', contributorId: 'c7', title: 'Best apps for health', type: 'SECTOR_UPDATE', outline: 'A list of apps.', whyItMatters: 'Popular topic.', conditionSlug: null, references: null, status: 'DECLINED', decisionReason: 'Too broad and promotional. Pitch a specific trend with sources.', articleSlug: null, createdAt: '2026-09-25T08:00:00Z', updatedAt: '2026-09-26T08:00:00Z' },
];
let topics = seedTopics();

const CONDITIONS = ['diabetes', 'hypertension', 'thyroid', 'asthma', 'pcos', 'heart-disease', 'arthritis', 'migraine'];

const seedHistory = (): Record<string, HistoryEntry[]> => ({
  'diabetes-type-2': [
    { at: '2026-09-27T09:00:00Z', actor: 'NexEagle content team', action: 'Created draft', detail: null },
    { at: '2026-09-28T10:00:00Z', actor: 'NexEagle content team', action: 'Submitted for review', detail: 'Reviewer: Dr. Meera Nair' },
    { at: '2026-09-29T10:00:00Z', actor: 'Dr. Meera Nair', action: 'Approved and published', detail: null },
  ],
  'thyroid-basics': [
    { at: '2026-10-01T09:00:00Z', actor: 'NexEagle content team', action: 'Created draft', detail: null },
    { at: '2026-10-02T08:00:00Z', actor: 'Dr. Meera Nair', action: 'Requested changes', detail: 'Please add when to see a doctor and simplify the second paragraph.' },
  ],
});
let history = seedHistory();
const log = (slug: string, action: string, detail: string | null = null, actor = 'You') => {
  history[slug] = [...(history[slug] ?? []), { at: new Date().toISOString(), actor, action, detail }];
};

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
const find = (slug: string) => {
  const a = articles.find((x) => x.slug === slug);
  if (!a) throw new Error('Article not found');
  return a;
};
const findPerson = (id: string) => {
  const c = contributors.find((x) => x.contributorId === id);
  if (!c) throw new Error('Contributor not found');
  return c;
};

/** Test helper: put every in-memory list back to its starting data. */
export const resetMockHealthWiki = () => {
  contributors = seedContributors();
  articles = seedArticles();
  topics = seedTopics();
  history = seedHistory();
};

export const mockHealthWiki = {
  list: () => wait([...articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  get: async (slug: string) => wait({ ...find(slug) }),
  create: async (p: ArticlePayload) => {
    if (articles.some((x) => x.slug === p.slug)) throw new Error('An article with this slug already exists.');
    const a: HealthArticle = { ...p, slug: p.slug!, publishedAt: null, updatedAt: now() };
    articles = [a, ...articles];
    log(a.slug, 'Created draft');
    if (p.status === 'IN_REVIEW') log(a.slug, 'Submitted for review');
    return wait({ ...a });
  },
  update: async (slug: string, p: ArticlePayload) => {
    const a = find(slug);
    const wasInReview = a.status === 'IN_REVIEW';
    Object.assign(a, p, { slug, reviewerComment: null, updatedAt: now() });
    log(slug, p.status === 'IN_REVIEW' && !wasInReview ? 'Submitted for review' : 'Saved draft');
    return wait({ ...a });
  },
  /** CMS editor approves a SECTOR_UPDATE. */
  approveArticle: async (slug: string) => {
    const a = find(slug);
    if (a.type !== 'SECTOR_UPDATE' || a.status !== 'IN_REVIEW') throw new Error('Only a Sector update in review can be approved here.');
    Object.assign(a, { status: 'PUBLISHED', publishedAt: now(), updatedAt: now(), reviewerComment: null });
    log(slug, 'Approved and published');
    return wait({ ...a });
  },
  /** Withdraw an in-review article, or take a published one down. A reason is required. */
  returnToDraft: async (slug: string, reason: string) => {
    const a = find(slug);
    log(slug, a.status === 'PUBLISHED' ? 'Taken down' : 'Returned to draft', reason);
    Object.assign(a, { status: 'DRAFT', publishedAt: null, updatedAt: now(), reviewerComment: reason });
    return wait({ ...a });
  },
  uploadImage: (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(file);
    }),
  listContributors: () => wait(contributors.map((c) => ({ ...c }))),
  inviteContributor: async (p: InviteContributorPayload) => {
    const digits = p.mobile.replace(/\D/g, '');
    const mobile = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (contributors.some((c) => c.mobile === mobile)) throw new Error('A contributor with this number already exists.');
    const c = person({ contributorId: `c${contributors.length + 1}`, type: p.type, fullName: p.fullName, mobile, status: 'INVITED', linkSentAt: clock() });
    contributors = [...contributors, c];
    return wait({ ...c });
  },
  verifyContributor: async (id: string) => {
    const c = findPerson(id);
    Object.assign(c, { status: 'VERIFIED', rejectReason: null });
    return wait({ ...c });
  },
  rejectContributor: async (id: string, reason: string) => {
    const c = findPerson(id);
    Object.assign(c, { status: 'REJECTED', rejectReason: reason });
    return wait({ ...c });
  },
  /** Sends (or resends) the WhatsApp link, optionally for one article. */
  sendLink: async (id: string) => {
    const c = findPerson(id);
    c.linkSentAt = clock();
    return wait({ ...c });
  },
  listConditions: () => wait([...CONDITIONS]),
  articleHistory: async (slug: string) => {
    find(slug);
    return wait([...(history[slug] ?? [])].reverse());
  },
  listTopicRequests: () => wait([...topics].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  getTopicRequest: async (id: string) => {
    const t = topics.find((x) => x.topicId === id);
    if (!t) throw new Error('Topic request not found');
    return wait({ ...t });
  },
  /** Accept creates a draft assigned to the contributor; the other two keep the request open for the contributor to answer. */
  decideTopicRequest: async (id: string, d: TopicDecision) => {
    const t = topics.find((x) => x.topicId === id);
    if (!t) throw new Error('Topic request not found');
    if (t.status !== 'SUBMITTED') throw new Error('This request is already decided.');
    if (d.action === 'ACCEPT') {
      const slug = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200);
      if (!articles.some((a) => a.slug === slug)) {
        articles = [{ ...base, slug, type: t.type, title: t.title, description: '', content: `## ${t.title}\n\n${t.outline}`,
          relatedConditionSlug: t.conditionSlug, authorContributorId: t.contributorId, reviewerContributorId: null,
          status: 'DRAFT', publishedAt: null, updatedAt: now() }, ...articles];
        log(slug, 'Created draft from an accepted topic', t.title);
      }
      Object.assign(t, { status: 'ACCEPTED', articleSlug: slug, decisionReason: null, updatedAt: now() });
    } else if (d.action === 'DECLINE') {
      Object.assign(t, { status: 'DECLINED', decisionReason: d.reason, updatedAt: now() });
    } else {
      Object.assign(t, { status: 'NEEDS_DETAIL', decisionReason: d.message, updatedAt: now() });
    }
    return wait({ ...t });
  },
  navCounts: (): Promise<NavCounts> =>
    wait({ pendingContributors: contributors.filter((c) => c.status === 'PENDING').length, openTopics: topics.filter((t) => t.status === 'SUBMITTED').length }),
};
