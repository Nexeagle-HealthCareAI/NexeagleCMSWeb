import { describe, expect, it } from 'vitest';
import type { ItemType, WorkItem } from './types';
import { allowedParentTypes, buildTree, childTypesFor, describeChange, initialsOf, isOverdue, parentRequired } from './workMeta';

let n = 0;
function item(itemType: ItemType, title: string, parentId: string | null = null, extra: Partial<WorkItem> = {}): WorkItem {
  n += 1;
  return {
    workItemId: `w${n}`, projectId: 'p', key: `HMS-${n}`, number: n, itemType, title, status: 'ToDo', statusName: 'To do', statusCategory: 'ToDo', priority: 'Medium', storyPoints: null,
    assigneeUserId: null, assigneeName: null, reporterUserId: null, reporterName: null, parentId, parentKey: null, parentTitle: null, parentType: null,
    sprintId: null, labels: [], startDate: null, dueDate: null, isBlocked: false, blockedReason: null, rank: n, childCount: 0, doneChildCount: 0,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', completedAt: null, ...extra,
  };
}

describe('hierarchy rules', () => {
  it('follows epic, feature, story/task/bug, subtask', () => {
    expect(allowedParentTypes('Epic')).toEqual([]);
    expect(allowedParentTypes('Feature')).toEqual(['Epic']);
    expect(allowedParentTypes('Bug')).toEqual(['Feature', 'Epic']);
    expect(allowedParentTypes('Subtask')).toEqual(['Story', 'Task', 'Bug']);
    expect(parentRequired('Subtask')).toBe(true);
    expect(parentRequired('Story')).toBe(false);
  });

  it('offers only the types that fit under a parent', () => {
    expect(childTypesFor('Epic')).toEqual(['Feature', 'Story', 'Task', 'Bug']);
    expect(childTypesFor('Task')).toEqual(['Subtask']);
    expect(childTypesFor('Subtask')).toEqual([]);
  });
});

describe('buildTree', () => {
  const epic = item('Epic', 'Billing');
  const story = item('Story', 'Add lab tests', epic.workItemId);
  const sub = item('Subtask', 'Search box', story.workItemId);
  const loose = item('Task', 'Price list');
  const all = [epic, story, sub, loose];
  const everything = new Set(all.map(i => i.workItemId));

  it('puts children under their parents with the right depth', () => {
    const rows = buildTree(all, everything, new Set());
    expect(rows.map(r => [r.item.title, r.depth])).toEqual([['Billing', 0], ['Add lab tests', 1], ['Search box', 2], ['Price list', 0]]);
    expect(rows[0].hasChildren).toBe(true);
    expect(rows[2].hasChildren).toBe(false);
  });

  it('hides what sits under a collapsed item', () => {
    const rows = buildTree(all, everything, new Set([epic.workItemId]));
    expect(rows.map(r => r.item.title)).toEqual(['Billing', 'Price list']);
  });

  it('keeps the parents of a match, and drops the rest', () => {
    const rows = buildTree(all, new Set([sub.workItemId]), new Set());
    expect(rows.map(r => r.item.title)).toEqual(['Billing', 'Add lab tests', 'Search box']);
  });

  it('shows an item at the top when its parent is not in the list', () => {
    const orphan = item('Subtask', 'Orphan', 'gone');
    expect(buildTree([orphan], new Set([orphan.workItemId]), new Set())[0].depth).toBe(0);
  });
});

describe('small helpers', () => {
  it('writes history as a sentence', () => {
    expect(describeChange('status', 'To do', 'In progress')).toBe('changed the status from To do to In progress');
    expect(describeChange('startDate', null, '2026-12-01')).toBe('set the start date to 2026-12-01');
    expect(describeChange('assignee', null, 'Asha Rao')).toBe('set the assignee to Asha Rao');
    expect(describeChange('dueDate', '2026-12-01', null)).toBe('cleared the due date');
    expect(describeChange('created', null, 'Bug')).toBe('created this bug');
    expect(describeChange('blocked', null, 'Waiting for finance')).toBe('marked this blocked: Waiting for finance');
  });

  it('makes initials', () => {
    expect(initialsOf('Asha Rao')).toBe('AR');
    expect(initialsOf('Bilal')).toBe('B');
    expect(initialsOf('')).toBe('?');
  });

  it('knows when an item is late', () => {
    const today = new Date(2026, 10, 21);
    expect(isOverdue(item('Task', 'a', null, { dueDate: '2026-11-20' }), today)).toBe(true);
    expect(isOverdue(item('Task', 'b', null, { dueDate: '2026-11-21' }), today)).toBe(false);
    expect(isOverdue(item('Task', 'c', null, { dueDate: '2026-11-01', status: 'Done', statusCategory: 'Done' }), today)).toBe(false);
  });
});
