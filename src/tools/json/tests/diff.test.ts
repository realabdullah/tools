import { describe, expect, it } from 'vitest';
import { buildDiffRows, deepEqual, diffJson, expandedForChanges, type DiffNode } from '../lib/diff';
import type { JsonValue } from '../lib/types';

const find = (node: DiffNode, path: string): DiffNode | null => {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = find(child, path);
    if (found) return found;
  }
  return null;
};

const at = (node: DiffNode, path: string): DiffNode => {
  const found = find(node, path);
  if (!found) throw new Error(`no node at ${path}`);
  return found;
};

describe('deepEqual', () => {
  it('compares structurally, not by reference', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: '1' })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('diffJson on objects', () => {
  it('reports identical documents as unchanged', () => {
    const { root, summary } = diffJson({ a: 1 }, { a: 1 });
    expect(root.differs).toBe(false);
    expect(root.status).toBe('unchanged');
    expect(summary).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it('classifies added, removed and changed keys', () => {
    const { root, summary } = diffJson(
      { keep: 1, drop: 2, edit: 3 },
      { keep: 1, edit: 4, gain: 5 },
    );

    expect(at(root, '$.keep').status).toBe('unchanged');
    expect(at(root, '$.drop').status).toBe('removed');
    expect(at(root, '$.gain').status).toBe('added');
    expect(at(root, '$.edit')).toMatchObject({ status: 'changed', left: 3, right: 4 });
    expect(summary).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it('keeps the left document’s key order and appends new keys', () => {
    const { root } = diffJson({ b: 1, a: 1 }, { a: 1, c: 1 });
    expect(root.children.map((child) => child.label)).toEqual(['b', 'a', 'c']);
  });

  it('counts an added subtree once, not per descendant', () => {
    const { summary } = diffJson({}, { added: { a: 1, b: { c: 2 } } });
    expect(summary).toEqual({ added: 1, removed: 0, changed: 0 });
  });

  it('marks every node inside an added subtree', () => {
    const { root } = diffJson({}, { added: { a: 1 } });
    expect(at(root, '$.added.a')).toMatchObject({ status: 'added', right: 1, left: undefined });
  });

  it('treats a type change as a change', () => {
    const { root } = diffJson({ a: [1] }, { a: { '0': 1 } });
    expect(at(root, '$.a').status).toBe('changed');
  });
});

describe('diffJson on arrays', () => {
  it('anchors identical elements so an insertion is one addition', () => {
    const { root, summary } = diffJson(['a', 'b', 'c'], ['a', 'x', 'b', 'c']);
    expect(summary).toEqual({ added: 1, removed: 0, changed: 0 });
    expect(root.children.map((child) => child.status)).toEqual([
      'unchanged',
      'added',
      'unchanged',
      'unchanged',
    ]);
  });

  it('reports a deletion as one removal', () => {
    const { summary } = diffJson([1, 2, 3], [1, 3]);
    expect(summary).toEqual({ added: 0, removed: 1, changed: 0 });
  });

  it('pairs an edited element instead of reporting a delete and an add', () => {
    const left: JsonValue = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' },
    ];
    const right: JsonValue = [
      { id: 1, name: 'Ada Lovelace' },
      { id: 2, name: 'Grace' },
    ];
    const { root, summary } = diffJson(left, right);

    expect(summary).toEqual({ added: 0, removed: 0, changed: 1 });
    expect(at(root, '$[0].name')).toMatchObject({
      status: 'changed',
      left: 'Ada',
      right: 'Ada Lovelace',
    });
    expect(at(root, '$[0].id').status).toBe('unchanged');
  });

  it('survives an edit and an insertion together', () => {
    const { summary } = diffJson([1, 2, 3], [1, 99, 3, 4]);
    expect(summary.added).toBe(1);
    expect(summary.changed).toBe(1);
  });

  it('falls back to positional comparison on very large arrays', () => {
    const left: JsonValue = Array.from({ length: 600 }, (_, index) => index);
    const right: JsonValue = Array.from({ length: 600 }, (_, index) =>
      index === 599 ? -1 : index,
    );
    const { summary } = diffJson(left, right);
    expect(summary.changed).toBe(1);
  });

  it('handles an empty side', () => {
    expect(diffJson([], [1, 2]).summary).toEqual({ added: 2, removed: 0, changed: 0 });
    expect(diffJson([1, 2], []).summary).toEqual({ added: 0, removed: 2, changed: 0 });
  });
});

describe('diff rendering model', () => {
  const { root } = diffJson({ same: 1, edited: { deep: 'a' } }, { same: 1, edited: { deep: 'b' } });

  it('opens the paths that changed', () => {
    const expanded = expandedForChanges(root);
    expect(expanded.has('$')).toBe(true);
    expect(expanded.has('$.edited')).toBe(true);
  });

  it('can hide everything that did not change', () => {
    const expanded = expandedForChanges(root);
    const all = buildDiffRows(root, expanded, false).map((row) => row.path);
    const changed = buildDiffRows(root, expanded, true).map((row) => row.path);

    expect(all).toContain('$.same');
    expect(changed).not.toContain('$.same');
    expect(changed).toEqual(['$', '$.edited', '$.edited.deep']);
  });

  it('reports nothing but the root when the documents match', () => {
    const identical = diffJson({ a: 1 }, { a: 1 });
    expect(buildDiffRows(identical.root, new Set(['$']), true)).toEqual([]);
  });
});
