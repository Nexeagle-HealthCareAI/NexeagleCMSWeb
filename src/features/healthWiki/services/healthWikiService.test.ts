import { beforeEach, describe, expect, it, vi } from 'vitest';

// The CMS API passes the EasyHMS answer through unchanged: lists are wrapped, and a change comes back as a result that holds the record.
const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../../services/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) } }));
const toast = { success: vi.fn(), warning: vi.fn() };
vi.mock('sonner', () => ({ toast }));

const load = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_HEALTH_WIKI_MOCK', 'false');
  return import('./healthWikiService');
};

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); toast.success.mockReset(); toast.warning.mockReset();
});

describe('healthWikiService against the real API shapes', () => {
  it('reads the article list out of { articles }', async () => {
    get.mockResolvedValue({ data: { success: true, data: { articles: [{ slug: 'a' }, { slug: 'b' }] } } });
    const { healthWikiService } = await load();
    expect((await healthWikiService.list()).map((a) => a.slug)).toEqual(['a', 'b']);
  });

  it('still accepts a plain array', async () => {
    get.mockResolvedValue({ data: { success: true, data: [{ slug: 'a' }] } });
    const { healthWikiService } = await load();
    expect(await healthWikiService.list()).toHaveLength(1);
  });

  it('returns the saved article from a save result', async () => {
    post.mockResolvedValue({ data: { success: true, data: { success: true, slug: 'new', status: 'DRAFT', article: { slug: 'new', status: 'DRAFT', title: 'T' } } } });
    const { healthWikiService } = await load();
    const saved = await healthWikiService.create({} as never);
    expect(saved.slug).toBe('new');
    expect(saved.status).toBe('DRAFT');
  });

  it('returns the contributor from a verify result', async () => {
    post.mockResolvedValue({ data: { success: true, data: { success: true, contributor: { contributorId: 'c1', status: 'VERIFIED' } } } });
    const { healthWikiService } = await load();
    expect((await healthWikiService.verifyContributor('c1')).status).toBe('VERIFIED');
  });

  it('keeps the link of an invite so it can be copied when WhatsApp did not deliver it', async () => {
    post.mockResolvedValue({ data: { success: true, data: { success: true, contributor: { contributorId: 'c1', fullName: 'Dr A' }, link: 'https://dd/contribute/invite/tok', linkDelivered: false } } });
    const { healthWikiService, announceLink } = await load();
    const r = await healthWikiService.inviteContributor({ fullName: 'Dr A', mobile: '9876543210', type: 'INDEPENDENT_DOCTOR' });
    expect(r.contributorId).toBe('c1');
    announceLink(r, 'Dr A');
    expect(toast.warning).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('just confirms when WhatsApp delivered the link', async () => {
    const { announceLink } = await load();
    announceLink({ contributorId: 'c1', link: 'https://x', linkDelivered: true } as never, 'Dr A');
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
