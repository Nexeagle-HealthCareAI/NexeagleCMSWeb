import { describe, expect, it } from 'vitest';
import { threadSteps, withoutFixed } from './qualityHelpers';
import type { VitaAgentStep, VitaBaseline } from '../types';

const step = (id: string, agent: string, parent_id: string | null = null): VitaAgentStep => ({
    id, run_id: 'run_1', seq: 0, agent, title: agent, mode_used: 'rules', fallback_reason: null, replayable: true, error: null,
    tokens: 0, ms: 1, started_at: null, parent_id, requested_by: parent_id ? 'judge' : null, kind: parent_id ? 'retry' : null,
});

describe('threadSteps', () => {
    it('nests help requests under the step that asked, in order', () => {
        const roots = threadSteps([step('a', 'planner'), step('b', 'judge'), step('c', 'executor', 'b'), step('d', 'planner', 'b'), step('e', 'gate')]);
        expect(roots.map((r) => r.id)).toEqual(['a', 'b', 'e']);
        expect(roots[1].children.map((c) => c.id)).toEqual(['c', 'd']);
    });
    it('keeps a step whose parent was not recorded at the top level', () => {
        expect(threadSteps([step('x', 'executor', 'missing')]).map((r) => r.id)).toEqual(['x']);
    });
});

describe('withoutFixed', () => {
    it('drops the lines that now pass and keeps the file format', () => {
        const b: VitaBaseline = {
            repo: '1HMSDatabase', file: '/opt/vita/repos/1HMSDatabase/vita-baseline.txt', exists: true, listed: 3,
            counts: { fixed: 1, 'still failing': 2 }, by_skill: { 'db-guard': 2, 'authz-fuzz': 1 },
            items: [
                { skill: 'db-guard', title: 'rollback-pair: a', case_id: 'c1', state: 'fixed', last: null },
                { skill: 'db-guard', title: 'rollback-pair: b', case_id: 'c2', state: 'still failing', last: null },
                { skill: 'authz-fuzz', title: 'unlisted-permission: GET /x', case_id: 'c3', state: 'still failing', last: null },
            ],
        };
        const text = withoutFixed(b);
        expect(text).not.toContain('rollback-pair: a');
        expect(text).toContain('db-guard | rollback-pair: b');
        expect(text.indexOf('# authz-fuzz: 1')).toBeLessThan(text.indexOf('# db-guard: 1'));
    });
});
