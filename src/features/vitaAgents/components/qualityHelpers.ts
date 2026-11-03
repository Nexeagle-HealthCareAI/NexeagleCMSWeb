import type { VitaAgentStep, VitaBaseline, VitaBaselineItem } from '../types';

/** Pure helpers for the Agents / Known findings screens (kept out of the component files for fast refresh and tests). */

export type StepNode = VitaAgentStep & { children: StepNode[] };

/** A run's steps as a tree: help requests (parent_id) nested under the step that asked, in order. */
export const threadSteps = (steps: VitaAgentStep[]): StepNode[] => {
    const byId = new Map<string, StepNode>(steps.map((s) => [s.id, { ...s, children: [] }]));
    const roots: StepNode[] = [];
    for (const s of steps) {
        const n = byId.get(s.id)!;
        const parent = s.parent_id ? byId.get(s.parent_id) : undefined;
        if (parent) parent.children.push(n);
        else roots.push(n);
    }
    return roots;
};

/** The baseline file without the lines that now pass (what to commit). */
export const withoutFixed = (b: VitaBaseline): string => {
    const keep = b.items.filter((i) => i.state !== 'fixed');
    const bySkill = new Map<string, VitaBaselineItem[]>();
    keep.forEach((i) => bySkill.set(i.skill, [...(bySkill.get(i.skill) ?? []), i]));
    const lines = [
        `# Vita baseline for ${b.repo}: findings that existed when Vita was switched on. Listed cases still run and`,
        '# are reported, but cannot fail the gate. Delete a line when it is fixed (Vita says which ones pass).',
        '',
    ];
    [...bySkill.keys()].sort().forEach((skill) => {
        const items = bySkill.get(skill)!;
        lines.push(`# ${skill}: ${items.length}`, ...items.map((i) => `${i.skill} | ${i.title}`), '');
    });
    return lines.join('\n');
};
