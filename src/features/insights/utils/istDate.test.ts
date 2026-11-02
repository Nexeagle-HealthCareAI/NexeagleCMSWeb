import { describe, expect, it } from 'vitest';
import { istDate } from './istDate';

describe('istDate', () => {
    it('rolls over at 18:30 UTC', () => {
        expect(istDate(new Date('2026-10-19T18:29:00Z'))).toBe('2026-10-19');
        expect(istDate(new Date('2026-10-19T18:30:00Z'))).toBe('2026-10-20');
    });
    it('is ahead of UTC early in the UTC day', () => {
        expect(istDate(new Date('2026-10-19T00:10:00Z'))).toBe('2026-10-19');
    });
});
