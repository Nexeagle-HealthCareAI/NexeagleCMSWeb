import { describe, expect, it } from 'vitest';
import { shouldReloadForStaleBuild } from './staleBuild';

describe('reloading once after a deploy replaced the code files', () => {
  it('reloads the first time', () => expect(shouldReloadForStaleBuild(1_000_000, null)).toBe(true));
  it('does not reload again within a minute (no loop)', () => expect(shouldReloadForStaleBuild(1_030_000, 1_000_000)).toBe(false));
  it('reloads again after a later deploy', () => expect(shouldReloadForStaleBuild(1_200_000, 1_000_000)).toBe(true));
});
